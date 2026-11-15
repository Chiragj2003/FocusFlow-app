import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { habitsApi, entriesApi, badgesApi, focusSessionsApi, Habit, HabitEntry, Badge } from './api';

// Storage Keys
const STORAGE_KEYS = {
  HABITS: '@focusflow_local_habits',
  ENTRIES: '@focusflow_local_entries',
  BADGES: '@focusflow_local_badges',
  FOCUS_SESSIONS: '@focusflow_local_focus_sessions',
  SYNC_QUEUE: '@focusflow_sync_queue',
  LAST_SYNC: '@focusflow_last_sync_timestamp',
};

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
      const keep = local.filter(
        (h) =>
          !remoteIds.has(h.id) &&
          (isTempId(h.id) || (active !== undefined && h.active !== active))
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

  async enqueueAction(type: SyncActionType, payload: any): Promise<void> {
    await this.withLock(async () => {
      const queue = await this.getSyncQueue();

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
  private async runAction(action: SyncAction, idMap: Record<string, string>): Promise<ActionOutcome> {
    const resolve = (id: string) => idMap[id] || id;

    switch (action.type) {
      case 'CREATE_HABIT': {
        const serverHabit = await habitsApi.create(action.payload.data);
        const tempId: string | undefined = action.payload.tempId;
        if (tempId && serverHabit?.id) {
          idMap[tempId] = serverHabit.id;
          await this.withLock(async () => {
            const habits = await this.getLocalHabits();
            await this.saveLocalHabits(habits.map((h) => (h.id === tempId ? serverHabit : h)));

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
      const idMap: Record<string, string> = {}; // temp client IDs -> server IDs (this cycle)

      // Re-read the queue every iteration so actions added while we were
      // sending are seen, and never overwrite the queue with a stale copy.
      while (true) {
        const queue = await this.getSyncQueue();
        const action = queue.find((a) => !attempted.has(a.id));
        if (!action) break;
        attempted.add(action.id);

        let outcome: ActionOutcome;
        try {
          outcome = await this.runAction(action, idMap);
        } catch (err) {
          outcome = this.outcomeForError(action, err);
        }

        if (outcome === 'done') sentSomething = true;
        if (outcome === 'drop') {
          console.error(`[LocalStorage Sync] Dropping action ${action.type} (${action.id}).`);
        }

        if (outcome === 'done' || outcome === 'drop' || outcome === 'retry') {
          await this.withLock(async () => {
            const current = await this.getSyncQueue();
            const idx = current.findIndex((a) => a.id === action.id);
            if (idx < 0) return;

            // A coalesced toggle may have replaced the payload while we were sending.
            // In that case keep it so the newer value is sent next cycle.
            const changedMeanwhile =
              current[idx].createdAt !== action.createdAt ||
              JSON.stringify(current[idx].payload) !== JSON.stringify(action.payload);

            if (outcome === 'retry') {
              if (!changedMeanwhile) current[idx].retryCount = action.retryCount + 1;
            } else if (!changedMeanwhile) {
              current.splice(idx, 1);
            } else {
              this.syncRequested = true;
            }
            await this.saveSyncQueue(current);
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
