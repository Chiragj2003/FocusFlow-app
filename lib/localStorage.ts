import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { toast } from './celebrate';
import { habitsApi, entriesApi, badgesApi, focusSessionsApi, Habit, HabitEntry, Badge } from './api';

// Storage Keys
const STORAGE_KEYS = {
  HABITS: '@focusflow_local_habits',
  ENTRIES: '@focusflow_local_entries',
  BADGES: '@focusflow_local_badges',
  FOCUS_SESSIONS: '@focusflow_local_focus_sessions',
  SYNC_QUEUE: '@focusflow_sync_queue',
  LAST_SYNC: '@focusflow_last_sync_timestamp',
  ID_MAP: '@focusflow_temp_id_map',
  OWNER: '@focusflow_local_owner',
  RECENT_CREATES: '@focusflow_recent_creates',
  HABIT_REMINDERS: '@focusflow_habit_reminders',
};

/** How long a freshly synced habit is kept even if the server list doesn't show it yet. */
const RECENT_CREATE_GRACE_MS = 10 * 60 * 1000;

const MAX_RETRIES = 5;

export type SyncActionType =
  | 'CREATE_HABIT'
  | 'UPDATE_HABIT'
  | 'DELETE_HABIT'
  | 'ARCHIVE_HABIT'
  | 'RESTORE_HABIT'
  | 'TOGGLE_ENTRY'
  | 'AWARD_BADGE'
  | 'CREATE_FOCUS';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: any;
  createdAt: number;
  retryCount: number;
}

type SyncListener = () => void;

/** What to do with an action after trying to send it. */
type ActionOutcome =
  | 'done' // sent (or nothing to send) -> remove from queue
  | 'wait' // blocked (e.g. habit still has a temp ID) -> leave untouched
  | 'retry' // failed, try again in a later cycle
  | 'drop' // permanently failed -> remove from queue
  | 'stop'; // offline / not authenticated -> leave untouched and end this cycle

const isTempId = (id: unknown): boolean => typeof id === 'string' && id.startsWith('temp-');

/** True if a queued action points at the given habit id. */
const referencesHabit = (a: SyncAction, habitId: string): boolean =>
  a.payload?.id === habitId || a.payload?.habitId === habitId || a.payload?.tempId === habitId;

/** Returns the payload with any temp habit ids replaced using the map. */
const remapPayload = (payload: any, map: Record<string, string>): any => {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };
  if (typeof next.id === 'string' && map[next.id]) next.id = map[next.id];
  if (typeof next.habitId === 'string' && map[next.habitId]) next.habitId = map[next.habitId];
  return next;
};

class LocalStorageManager {
  private isSyncing = false;
  private syncRequested = false;
  private syncListeners = new Set<SyncListener>();
  private lockChain: Promise<unknown> = Promise.resolve();

  /**
   * Runs read-modify-write operations on AsyncStorage one at a time, so two
   * concurrent writers can never overwrite each other's changes.
   * Never call another locked method from inside `fn` (it would deadlock).
   */
  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lockChain.then(fn, fn);
    this.lockChain = run.catch(() => undefined);
    return run;
  }

  private currentUserId: string | null = null;

  /**
   * Binds on-device data to the signed-in user. Pass null on sign-out to pause syncing.
   * If the device holds data from a different user, it is wiped first.
   * Resolves to true when data was wiped.
   */
  setCurrentUser(userId: string | null): Promise<boolean> {
    if (!userId) {
      this.currentUserId = null;
      return Promise.resolve(false);
    }
    return this.withLock(async () => {
      let cleared = false;
      const owner = await AsyncStorage.getItem(STORAGE_KEYS.OWNER);
      if (owner && owner !== userId) {
        console.log('[LocalStorage] Different user signed in: clearing previous user data.');
        await this.removeAllKeys();
        cleared = true;
      }
      // Data from before owner tracking existed is adopted by the first user.
      await AsyncStorage.setItem(STORAGE_KEYS.OWNER, userId);
      this.currentUserId = userId;
      return cleared;
    });
  }

  private async removeAllKeys(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  }

  /** Wipes all local habits, entries, badges, the sync queue and the owner tag. Use on sign-out. */
  clearAll(): Promise<void> {
    this.currentUserId = null;
    this.syncRequested = false;
    return this.withLock(() => this.removeAllKeys());
  }

  /** Subscribe to "a sync cycle sent something to the server". Returns an unsubscribe fn. */
  onSyncComplete(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private notifySyncComplete() {
    this.syncListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.warn('[LocalStorage Sync] Sync listener failed:', e);
      }
    });
  }

  // ==========================================
  // HABITS LOCAL STORAGE
  // ==========================================

  async getLocalHabits(): Promise<Habit[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HABITS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[LocalStorage] Failed to load habits:', e);
      return [];
    }
  }

  async saveLocalHabits(habits: Habit[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save habits:', e);
    }
  }

  upsertLocalHabit(habit: Habit): Promise<Habit[]> {
    return this.withLock(async () => {
      const habits = await this.getLocalHabits();
      const index = habits.findIndex((h) => h.id === habit.id);
      let updated: Habit[];
      if (index >= 0) {
        updated = [...habits];
        updated[index] = { ...updated[index], ...habit, updatedAt: new Date().toISOString() };
      } else {
        updated = [habit, ...habits];
      }
      await this.saveLocalHabits(updated);
      return updated;
    });
  }

  /**
   * Stores habits fetched from the server. Keeps unsynced temp habits, and when
   * `active` filtered the fetch, keeps local habits of the other state
   * (so fetching active habits doesn't wipe archived ones from the device).
   */
  mergeRemoteHabits(remote: Habit[], active?: boolean): Promise<Habit[]> {
    return this.withLock(async () => {
      const local = await this.getLocalHabits();
      const remoteIds = new Set(remote.map((h) => h.id));
      // Habits created moments ago may not be in the server's list yet
      // (replica/cache lag). Keep them for a grace period so they don't vanish.
      const recent = await this.getRecentCreates();
      const now = Date.now();
      const keep = local.filter(
        (h) =>
          !remoteIds.has(h.id) &&
          (isTempId(h.id) ||
            (active !== undefined && h.active !== active) ||
            (recent[h.id] !== undefined && now - recent[h.id] < RECENT_CREATE_GRACE_MS))
      );
      const merged = [...keep, ...remote];
      await this.saveLocalHabits(merged);
      return merged;
    });
  }

  removeLocalHabit(habitId: string): Promise<Habit[]> {
    return this.withLock(async () => {
      const habits = await this.getLocalHabits();
      const updated = habits.filter((h) => h.id !== habitId);
      await this.saveLocalHabits(updated);
      return updated;
    });
  }

  // ==========================================
  // ENTRIES LOCAL STORAGE
  // ==========================================

  async getLocalEntries(): Promise<HabitEntry[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[LocalStorage] Failed to load entries:', e);
      return [];
    }
  }

  async saveLocalEntries(entries: HabitEntry[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save entries:', e);
    }
  }

  /**
   * Stores entries fetched from the server. Entries with a toggle still waiting
   * in the sync queue keep their local value so the UI doesn't flip back.
   */
  mergeRemoteEntries(remote: HabitEntry[]): Promise<HabitEntry[]> {
    return this.withLock(async () => {
      const key = (habitId: string, date: string) => `${habitId}_${String(date).split('T')[0]}`;
      const local = await this.getLocalEntries();
      const queue = await this.getSyncQueue();
      const pendingKeys = new Set(
        queue
          .filter((a) => a.type === 'TOGGLE_ENTRY')
          .map((a) => key(a.payload.habitId, a.payload.entryDate))
      );

      const map = new Map<string, HabitEntry>();
      local.forEach((e) => map.set(key(e.habitId, e.entryDate), e));
      remote.forEach((e) => {
        const k = key(e.habitId, e.entryDate);
        if (!pendingKeys.has(k)) map.set(k, e);
      });

      const merged = Array.from(map.values());
      await this.saveLocalEntries(merged);
      return merged;
    });
  }

  upsertLocalEntry(entry: {
    habitId: string;
    entryDate: string;
    completed: boolean;
    value?: number | null;
    notes?: string | null;
  }): Promise<HabitEntry[]> {
    return this.withLock(async () => {
      const entries = await this.getLocalEntries();
      const dateFormatted = entry.entryDate.includes('T') ? entry.entryDate.split('T')[0] : entry.entryDate;
      const index = entries.findIndex(
        (e) => e.habitId === entry.habitId && e.entryDate.split('T')[0] === dateFormatted
      );

      let updated: HabitEntry[];
      const nowIso = new Date().toISOString();

      if (index >= 0) {
        updated = [...entries];
        updated[index] = {
          ...updated[index],
          completed: entry.completed,
          value: entry.value !== undefined ? entry.value : updated[index].value,
          notes: entry.notes !== undefined ? entry.notes : updated[index].notes,
          updatedAt: nowIso,
        };
      } else {
        const newEntry: HabitEntry = {
          id: `local-entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          habitId: entry.habitId,
          userId: 'current-user',
          entryDate: dateFormatted,
          completed: entry.completed,
          value: entry.value ?? null,
          notes: entry.notes ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        updated = [...entries, newEntry];
      }
      await this.saveLocalEntries(updated);
      return updated;
    });
  }

  // ==========================================
  // BADGES LOCAL STORAGE
  // ==========================================

  async getLocalBadges(): Promise<Badge[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BADGES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[LocalStorage] Failed to load badges:', e);
      return [];
    }
  }

  async saveLocalBadges(badges: Badge[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BADGES, JSON.stringify(badges));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save badges:', e);
    }
  }

  addLocalBadge(badgeName: string): Promise<Badge[]> {
    return this.withLock(async () => {
      const badges = await this.getLocalBadges();
      if (badges.some((b) => b.name === badgeName)) return badges;

      const updated = [...badges, { name: badgeName, awardedAt: new Date().toISOString() }];
      await this.saveLocalBadges(updated);
      return updated;
    });
  }

  // ==========================================
  // SYNC QUEUE (Offline -> Online Replay)
  // ==========================================

  async getSyncQueue(): Promise<SyncAction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[LocalStorage] Failed to load sync queue:', e);
      return [];
    }
  }

  async saveSyncQueue(queue: SyncAction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save sync queue:', e);
    }
  }

  // ==========================================
  // PER-HABIT REMINDER TIMES (habitId -> "HH:MM"), device only
  // ==========================================

  async getHabitReminders(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HABIT_REMINDERS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  setHabitReminder(habitId: string, time: string | null): Promise<void> {
    return this.withLock(async () => {
      const map = await this.getHabitReminders();
      if (time) map[habitId] = time;
      else delete map[habitId];
      await AsyncStorage.setItem(STORAGE_KEYS.HABIT_REMINDERS, JSON.stringify(map));
    });
  }

  // ==========================================
  // RECENTLY CREATED HABITS (server id -> synced at)
  // ==========================================

  private async getRecentCreates(): Promise<Record<string, number>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_CREATES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private async addRecentCreate(serverId: string): Promise<void> {
    const recent = await this.getRecentCreates();
    const now = Date.now();
    // Drop expired entries so the map stays small
    for (const id of Object.keys(recent)) {
      if (now - recent[id] > RECENT_CREATE_GRACE_MS) delete recent[id];
    }
    recent[serverId] = now;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_CREATES, JSON.stringify(recent));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save recent creates:', e);
    }
  }

  // ==========================================
  // TEMP ID -> SERVER ID MAP (persisted)
  // ==========================================

  async getIdMap(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ID_MAP);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('[LocalStorage] Failed to load id map:', e);
      return {};
    }
  }

  private async saveIdMap(map: Record<string, string>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ID_MAP, JSON.stringify(map));
    } catch (e) {
      console.warn('[LocalStorage] Failed to save id map:', e);
    }
  }

  async enqueueAction(type: SyncActionType, rawPayload: any): Promise<void> {
    await this.withLock(async () => {
      const queue = await this.getSyncQueue();
      // The UI may still hold a temp id for a habit that already synced.
      const payload = type === 'CREATE_HABIT' ? rawPayload : remapPayload(rawPayload, await this.getIdMap());

      // Deleting a habit that never reached the server: cancel its pending
      // create and everything that depends on it, send nothing.
      if (type === 'DELETE_HABIT' && isTempId(payload.id)) {
        const hasPendingCreate = queue.some((a) => a.type === 'CREATE_HABIT' && a.payload.tempId === payload.id);
        if (hasPendingCreate) {
          await this.saveSyncQueue(queue.filter((a) => !referencesHabit(a, payload.id)));
          return;
        }
      }

      // Coalesce rapid toggles for the same habit & date
      if (type === 'TOGGLE_ENTRY') {
        const existing = queue.find(
          (a) =>
            a.type === 'TOGGLE_ENTRY' &&
            a.payload.habitId === payload.habitId &&
            a.payload.entryDate === payload.entryDate
        );
        if (existing) {
          existing.payload = payload;
          existing.createdAt = Date.now();
          existing.retryCount = 0;
          await this.saveSyncQueue(queue);
          return;
        }
      }

      queue.push({
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        payload,
        createdAt: Date.now(),
        retryCount: 0,
      });
      await this.saveSyncQueue(queue);
    });
    this.triggerSync();
  }

  /**
   * Best effort: send pending changes now (e.g. right before sign-out).
   * Waits for a running cycle, then runs one more. Gives up after `timeoutMs`.
   */
  async flush(timeoutMs = 8000): Promise<void> {
    const work = (async () => {
      while (this.isSyncing) await new Promise((r) => setTimeout(r, 100));
      await this.processSyncQueue();
    })();
    await Promise.race([work, new Promise((r) => setTimeout(r, timeoutMs))]);
  }

  triggerSync() {
    // Run in background without throwing
    setTimeout(() => {
      this.processSyncQueue().catch((err) => {
        console.warn('[LocalStorage Sync] Background sync cycle caught error:', err);
      });
    }, 500);
  }

  /** Classifies a failed request: offline/auth problems pause the queue, bad requests are dropped. */
  private outcomeForError(action: SyncAction, err: any): ActionOutcome {
    const status: number | undefined = err?.response?.status;
    console.warn(`[LocalStorage Sync] Error executing action ${action.type}:`, status ?? err?.message ?? err);

    // No response at all = offline / timeout. Don't burn retries, try again later.
    if (status === undefined) return 'stop';
    // Not signed in yet / token problem. Wait for auth instead of dropping data.
    if (status === 401 || status === 403) return 'stop';
    // Server will never accept this request (validation error, gone, ...).
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'drop';
    // 5xx / 408 / 429: retry a few times.
    return action.retryCount + 1 >= MAX_RETRIES ? 'drop' : 'retry';
  }

  /** Sends one action to the server. `idMap` maps temp habit IDs created during this cycle. */
  private async runAction(
    action: SyncAction,
    idMap: Record<string, string>,
    cycleUser: string
  ): Promise<ActionOutcome> {
    const resolve = (id: string) => idMap[id] || id;

    switch (action.type) {
      case 'CREATE_HABIT': {
        const serverHabit = await habitsApi.create(action.payload.data);
        const tempId: string | undefined = action.payload.tempId;
        if (tempId && serverHabit?.id) {
          idMap[tempId] = serverHabit.id;
          await this.withLock(async () => {
            // Signed out / switched user while the request was in flight: local data is gone.
            if (this.currentUserId !== cycleUser) return;
            const queue = await this.getSyncQueue();

            // User deleted the habit while this create was in flight:
            // it now exists on the server, so delete it there too.
            if (!queue.some((a) => a.id === action.id)) {
              queue.push({
                id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'DELETE_HABIT',
                payload: { id: serverHabit.id },
                createdAt: Date.now(),
                retryCount: 0,
              });
              await this.saveSyncQueue(queue);
              return;
            }

            // Persist the mapping and rewrite queued actions to the server id.
            const map = await this.getIdMap();
            map[tempId] = serverHabit.id;
            await this.saveIdMap(map);
            await this.saveSyncQueue(
              queue.map((a) => (a.id === action.id ? a : { ...a, payload: remapPayload(a.payload, map) }))
            );

            const habits = await this.getLocalHabits();
            await this.saveLocalHabits(habits.map((h) => (h.id === tempId ? serverHabit : h)));
            await this.addRecentCreate(serverHabit.id);

            // Carry a reminder set on the temp habit over to the real id
            const reminders = await this.getHabitReminders();
            if (reminders[tempId]) {
              reminders[serverHabit.id] = reminders[tempId];
              delete reminders[tempId];
              await AsyncStorage.setItem(STORAGE_KEYS.HABIT_REMINDERS, JSON.stringify(reminders));
            }

            const entries = await this.getLocalEntries();
            await this.saveLocalEntries(
              entries.map((e) => (e.habitId === tempId ? { ...e, habitId: serverHabit.id } : e))
            );
          });
        }
        return 'done';
      }
      case 'UPDATE_HABIT': {
        const habitId = resolve(action.payload.id);
        if (isTempId(habitId)) return 'wait';
        await habitsApi.update(habitId, action.payload.data);
        return 'done';
      }
      case 'DELETE_HABIT': {
        const habitId = resolve(action.payload.id);
        if (isTempId(habitId)) return 'wait';
        await habitsApi.delete(habitId);
        return 'done';
      }
      case 'ARCHIVE_HABIT': {
        const habitId = resolve(action.payload.id);
        if (isTempId(habitId)) return 'wait';
        await habitsApi.archive(habitId);
        return 'done';
      }
      case 'RESTORE_HABIT': {
        const habitId = resolve(action.payload.id);
        if (isTempId(habitId)) return 'wait';
        await habitsApi.restore(habitId);
        return 'done';
      }
      case 'TOGGLE_ENTRY': {
        const habitId = resolve(action.payload.habitId);
        if (isTempId(habitId)) return 'wait';
        await entriesApi.toggle(
          habitId,
          action.payload.entryDate,
          action.payload.completed,
          action.payload.value,
          action.payload.notes
        );
        return 'done';
      }
      case 'AWARD_BADGE': {
        // Best effort - badge is already recorded locally
        try {
          await badgesApi.awardBadge(action.payload.name, action.payload.metadata);
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 405 || status === 404) {
            console.log(`[LocalStorage Sync] Server does not support badge POST (${status}), kept in local storage.`);
            return 'done';
          }
          throw err;
        }
        return 'done';
      }
      case 'CREATE_FOCUS': {
        const habitId = action.payload.habitId ? resolve(action.payload.habitId) : undefined;
        if (isTempId(habitId)) return 'wait';
        await focusSessionsApi.create({ ...action.payload, habitId });
        return 'done';
      }
      default:
        return 'drop';
    }
  }

  async processSyncQueue(): Promise<void> {
    // Never sync without a known signed-in owner (prevents cross-account uploads).
    const cycleUser = this.currentUserId;
    if (!cycleUser) return;
    if (this.isSyncing) {
      // Something was queued mid-cycle; run another cycle when this one ends.
      this.syncRequested = true;
      return;
    }
    this.isSyncing = true;
    let sentSomething = false;

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('[LocalStorage Sync] Offline: Holding sync queue.');
        return;
      }

      const attempted = new Set<string>();
      const idMap: Record<string, string> = await this.getIdMap(); // temp client IDs -> server IDs

      // Re-read the queue every iteration so actions added while we were
      // sending are seen, and never overwrite the queue with a stale copy.
      while (true) {
        if (this.currentUserId !== cycleUser) break; // signed out mid-cycle
        const queue = await this.getSyncQueue();
        const action = queue.find((a) => !attempted.has(a.id));
        if (!action) break;
        attempted.add(action.id);

        let outcome: ActionOutcome;
        let failure: any = null;
        try {
          outcome = await this.runAction(action, idMap, cycleUser);
        } catch (err) {
          failure = err;
          outcome = this.outcomeForError(action, err);
        }

        if (outcome === 'done') sentSomething = true;
        if (outcome === 'drop') {
          console.error(`[LocalStorage Sync] Dropping action ${action.type} (${action.id}).`);
        }

        if (outcome === 'done' || outcome === 'drop' || outcome === 'retry') {
          await this.withLock(async () => {
            if (this.currentUserId !== cycleUser) return;
            const current = await this.getSyncQueue();
            const idx = current.findIndex((a) => a.id === action.id);
            if (idx < 0) return;

            // A coalesced toggle may have replaced the payload while we were sending.
            // In that case keep it so the newer value is sent next cycle.
            const changedMeanwhile =
              current[idx].createdAt !== action.createdAt ||
              JSON.stringify(current[idx].payload) !== JSON.stringify(action.payload);

            let next = current;
            if (outcome === 'retry') {
              if (!changedMeanwhile) current[idx].retryCount = action.retryCount + 1;
            } else if (!changedMeanwhile) {
              next = current.filter((a) => a.id !== action.id);
            } else {
              this.syncRequested = true;
            }

            // The server permanently rejected a new habit: actions that depend
            // on its temp id can never be sent, so remove them and the local copy.
            if (outcome === 'drop' && action.type === 'CREATE_HABIT' && action.payload?.tempId) {
              const tempId = action.payload.tempId;
              next = next.filter((a) => !referencesHabit(a, tempId));
              const habits = await this.getLocalHabits();
              const rejected = habits.find((h) => h.id === tempId);
              await this.saveLocalHabits(habits.filter((h) => h.id !== tempId));
              // Tell the user instead of letting the habit silently disappear.
              const serverMsg = failure?.response?.data?.error || failure?.response?.data?.message;
              toast({
                tone: 'error',
                message: `Couldn’t save “${rejected?.title ?? action.payload?.data?.title ?? 'habit'}”${
                  serverMsg ? `: ${serverMsg}` : '. Please try again.'
                }`,
              });
            }
            await this.saveSyncQueue(next);
          });
        }

        if (outcome === 'wait') {
          // Waiting on a temp habit id. If no create for it is queued and it
          // was never mapped, it can never be sent: drop it instead of
          // leaving it stuck in the queue forever.
          await this.withLock(async () => {
            if (this.currentUserId !== cycleUser) return;
            const current = await this.getSyncQueue();
            const map = await this.getIdMap();
            const tempId = [action.payload?.id, action.payload?.habitId].find(isTempId) as string | undefined;
            if (!tempId || map[tempId]) return;
            const hasCreate = current.some((a) => a.type === 'CREATE_HABIT' && a.payload?.tempId === tempId);
            if (!hasCreate) {
              console.error(`[LocalStorage Sync] Dropping orphaned ${action.type} for unknown habit ${tempId}.`);
              await this.saveSyncQueue(current.filter((a) => a.id !== action.id));
            }
          });
        }

        if (outcome === 'stop') {
          console.log('[LocalStorage Sync] Offline or not authenticated: pausing sync.');
          break;
        }
      }
    } finally {
      this.isSyncing = false;
      const remaining = (await this.getSyncQueue()).length;
      console.log(`[LocalStorage Sync] Sync cycle finished. Remaining in queue: ${remaining}`);
      if (sentSomething) this.notifySyncComplete();
      if (this.syncRequested) {
        this.syncRequested = false;
        this.triggerSync();
      }
    }
  }
}

export const localStorage = new LocalStorageManager();
