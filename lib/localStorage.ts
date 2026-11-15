import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, habitsApi, entriesApi, badgesApi, focusSessionsApi, Habit, HabitEntry, Badge, FocusSession } from './api';

// Storage Keys
const STORAGE_KEYS = {
  HABITS: '@focusflow_local_habits',
  ENTRIES: '@focusflow_local_entries',
  BADGES: '@focusflow_local_badges',
  FOCUS_SESSIONS: '@focusflow_local_focus_sessions',
  SYNC_QUEUE: '@focusflow_sync_queue',
  LAST_SYNC: '@focusflow_last_sync_timestamp',
};

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

class LocalStorageManager {
  private isSyncing = false;

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

  async upsertLocalHabit(habit: Habit): Promise<Habit[]> {
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
  }

  async removeLocalHabit(habitId: string): Promise<Habit[]> {
    const habits = await this.getLocalHabits();
    const updated = habits.filter((h) => h.id !== habitId);
    await this.saveLocalHabits(updated);
    return updated;
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

  async upsertLocalEntry(entry: {
    habitId: string;
    entryDate: string;
    completed: boolean;
    value?: number | null;
    notes?: string | null;
  }): Promise<HabitEntry[]> {
    const entries = await this.getLocalEntries();
    const dateFormatted = entry.entryDate.includes('T') ? entry.entryDate.split('T')[0] : entry.entryDate;
    const index = entries.findIndex(
      (e) => e.habitId === entry.habitId && (e.entryDate.split('T')[0] === dateFormatted)
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
        id: `local-entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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

  async addLocalBadge(badgeName: string): Promise<Badge[]> {
    const badges = await this.getLocalBadges();
    const alreadyExists = badges.some((b) => b.name === badgeName);
    if (alreadyExists) return badges;

    const newBadge: Badge = {
      name: badgeName,
      awardedAt: new Date().toISOString(),
    };
    const updated = [...badges, newBadge];
    await this.saveLocalBadges(updated);
    return updated;
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
    const queue = await this.getSyncQueue();
    // Coalesce rapid toggles for the same habit & date
    if (type === 'TOGGLE_ENTRY') {
      const existingIdx = queue.findIndex(
        (a) =>
          a.type === 'TOGGLE_ENTRY' &&
          a.payload.habitId === payload.habitId &&
          a.payload.entryDate === payload.entryDate
      );
      if (existingIdx >= 0) {
        queue[existingIdx].payload = payload;
        queue[existingIdx].createdAt = Date.now();
        await this.saveSyncQueue(queue);
        this.triggerSync();
        return;
      }
    }

    const action: SyncAction = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };
    queue.push(action);
    await this.saveSyncQueue(queue);
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

  async processSyncQueue(): Promise<void> {
    if (this.isSyncing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[LocalStorage Sync] Offline: Holding sync queue.');
      return;
    }

    const queue = await this.getSyncQueue();
    if (queue.length === 0) return;

    this.isSyncing = true;
    console.log(`[LocalStorage Sync] Processing ${queue.length} pending actions...`);

    const remainingQueue: SyncAction[] = [];
    const idMap: Record<string, string> = {}; // Maps temp client IDs to server assigned IDs

    for (const action of queue) {
      try {
        switch (action.type) {
          case 'CREATE_HABIT': {
            const serverHabit = await habitsApi.create(action.payload.data);
            if (action.payload.tempId && serverHabit.id) {
              idMap[action.payload.tempId] = serverHabit.id;
              // Update local storage habit ID
              const habits = await this.getLocalHabits();
              const updated = habits.map((h) => (h.id === action.payload.tempId ? serverHabit : h));
              await this.saveLocalHabits(updated);

              // Update any local entries that referenced the temp ID
              const entries = await this.getLocalEntries();
              const updatedEntries = entries.map((e) =>
                e.habitId === action.payload.tempId ? { ...e, habitId: serverHabit.id } : e
              );
              await this.saveLocalEntries(updatedEntries);
            }
            break;
          }
          case 'UPDATE_HABIT': {
            const habitId = idMap[action.payload.id] || action.payload.id;
            await habitsApi.update(habitId, action.payload.data);
            break;
          }
          case 'DELETE_HABIT': {
            const habitId = idMap[action.payload.id] || action.payload.id;
            // Only call server if it was a real server ID
            if (!habitId.startsWith('temp-')) {
              await habitsApi.delete(habitId);
            }
            break;
          }
          case 'ARCHIVE_HABIT': {
            const habitId = idMap[action.payload.id] || action.payload.id;
            if (!habitId.startsWith('temp-')) {
              await habitsApi.archive(habitId);
            }
            break;
          }
          case 'RESTORE_HABIT': {
            const habitId = idMap[action.payload.id] || action.payload.id;
            if (!habitId.startsWith('temp-')) {
              await habitsApi.restore(habitId);
            }
            break;
          }
          case 'TOGGLE_ENTRY': {
            let habitId = idMap[action.payload.habitId] || action.payload.habitId;
            // If the habit is STILL a temp ID, we cannot sync yet. Keep in remaining queue.
            if (habitId.startsWith('temp-')) {
              remainingQueue.push(action);
              continue;
            }
            await entriesApi.toggle(
              habitId,
              action.payload.entryDate,
              action.payload.completed,
              action.payload.value,
              action.payload.notes
            );
            break;
          }
          case 'AWARD_BADGE': {
            // Best effort - if server returns 405 or 404, we don't fail, badge is already recorded locally
            try {
              await badgesApi.awardBadge(action.payload.name, action.payload.metadata);
            } catch (err: any) {
              if (err?.response?.status === 405 || err?.response?.status === 404) {
                console.log(`[LocalStorage Sync] Server does not support badge POST (${err?.response?.status}), kept in local storage.`);
              } else {
                throw err;
              }
            }
            break;
          }
          case 'CREATE_FOCUS': {
            const habitId = action.payload.habitId ? (idMap[action.payload.habitId] || action.payload.habitId) : undefined;
            await focusSessionsApi.create({ ...action.payload, habitId });
            break;
          }
        }
      } catch (err: any) {
        console.warn(`[LocalStorage Sync] Error executing action ${action.type}:`, err?.message || err);
        action.retryCount += 1;
        // Don't discard immediately; keep for retry up to 5 times
        if (action.retryCount <= 5) {
          remainingQueue.push(action);
        } else {
          console.error(`[LocalStorage Sync] Dropping action ${action.type} after 5 failed attempts.`);
        }
      }
    }

    await this.saveSyncQueue(remainingQueue);
    this.isSyncing = false;
    console.log(`[LocalStorage Sync] Sync cycle finished. Remaining in queue: ${remainingQueue.length}`);
  }
}

export const localStorage = new LocalStorageManager();
