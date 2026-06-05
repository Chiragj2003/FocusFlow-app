import AsyncStorage from '@react-native-async-storage/async-storage';
import { challengesApi, entriesApi, focusSessionsApi, habitsApi, type Challenge, type FocusSession, type FocusStats, type Habit, type HabitEntry, type InsightsSummary, type StreakData, type UserChallenge } from './api';

const STORAGE_KEYS = {
  HABITS: '@focusflow_habits',
  ENTRIES: '@focusflow_entries',
  FOCUS_SESSIONS: '@focusflow_focus_sessions',
  CHALLENGES: '@focusflow_challenges',
  USER_CHALLENGES: '@focusflow_user_challenges',
  IS_GUEST: '@focusflow_is_guest',
};

// Generate unique IDs
const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Format date in local timezone (YYYY-MM-DD)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper functions (not using 'this')
async function getAllHabits(active?: boolean): Promise<Habit[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.HABITS);
  const habits: Habit[] = data ? JSON.parse(data) : [];

  if (active === undefined) return habits;
  return habits.filter(h => h.active === active);
}

async function getAllEntries(): Promise<HabitEntry[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
  return data ? JSON.parse(data) : [];
}

// Guest mode helpers
export const guestStorage = {
  async isGuestMode(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.IS_GUEST);
    return value === 'true';
  },

  async setGuestMode(isGuest: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, isGuest ? 'true' : 'false');
  },

  async clearGuestData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.HABITS,
      STORAGE_KEYS.ENTRIES,
      STORAGE_KEYS.IS_GUEST,
    ]);
  },
};

// Local Habits API
export const localHabitsApi = {
  getAll: getAllHabits,

  async create(habit: {
    title: string;
    description?: string;
    color?: string;
    category?: string;
    goalType: 'binary' | 'duration' | 'quantity';
    goalTarget?: number;
    unit?: string;
  }): Promise<Habit> {
    const habits = await getAllHabits();

    const titleNormalized = habit.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = habits.some(
      h => h.active && h.title.trim().toLowerCase().replace(/\s+/g, ' ') === titleNormalized
    );
    if (isDuplicate) {
      throw new Error('A habit with this name already exists');
    }

    const now = new Date().toISOString();

    const newHabit: Habit = {
      id: generateId(),
      userId: 'guest',
      title: habit.title,
      description: habit.description || null,
      category: habit.category || null,
      color: habit.color || '#f97316',
      goalType: habit.goalType,
      goalTarget: habit.goalTarget || null,
      unit: habit.unit || null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    habits.push(newHabit);
    await AsyncStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    return newHabit;
  },

  async update(id: string, data: Partial<Habit>): Promise<Habit> {
    const habits = await getAllHabits();
    const index = habits.findIndex(h => h.id === id);

    if (index === -1) throw new Error('Habit not found');

    habits[index] = {
      ...habits[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    return habits[index];
  },

  async delete(id: string): Promise<void> {
    const habits = await getAllHabits();
    const filtered = habits.filter(h => h.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(filtered));

    // Also delete related entries
    const entries = await getAllEntries();
    const filteredEntries = entries.filter(e => e.habitId !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(filteredEntries));
  },

  async archive(id: string): Promise<Habit> {
    return localHabitsApi.update(id, { active: false });
  },

  async restore(id: string): Promise<Habit> {
    return localHabitsApi.update(id, { active: true });
  },
};

// Local Entries API
export const localEntriesApi = {
  getAll: getAllEntries,

  async getByDateRange(startDate: string, endDate: string): Promise<HabitEntry[]> {
    const entries = await getAllEntries();
    return entries.filter(e => e.entryDate >= startDate && e.entryDate <= endDate);
  },

  async toggle(
    habitId: string,
    entryDate: string,
    completed: boolean,
    value?: number,
    notes?: string
  ): Promise<HabitEntry> {
    const entries = await getAllEntries();
    const existingIndex = entries.findIndex(
      e => e.habitId === habitId && e.entryDate === entryDate
    );
    const now = new Date().toISOString();

    if (existingIndex !== -1) {
      // Update existing entry
      entries[existingIndex] = {
        ...entries[existingIndex],
        completed,
        value: value ?? entries[existingIndex].value,
        notes: notes ?? entries[existingIndex].notes,
        updatedAt: now,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      return entries[existingIndex];
    } else {
      // Create new entry
      const newEntry: HabitEntry = {
        id: generateId(),
        habitId,
        userId: 'guest',
        entryDate,
        completed,
        value: value ?? null,
        notes: notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      entries.push(newEntry);
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      return newEntry;
    }
  },
};

// Local Insights API
export const localInsightsApi = {
  async getSummary(): Promise<InsightsSummary> {
    const habits = await getAllHabits(true);
    const entries = await getAllEntries();

    // Get last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEntries = entries.filter(e => {
      const entryDate = new Date(e.entryDate);
      return entryDate >= thirtyDaysAgo && entryDate <= today;
    });

    // Calculate overall completion
    const completedEntries = recentEntries.filter(e => e.completed);
    const totalPossible = habits.length * 30;
    const overallCompletionRate = totalPossible > 0
      ? completedEntries.length / totalPossible
      : 0;

    // Top habits
    const topHabits = habits.map(habit => {
      const habitEntries = recentEntries.filter(e => e.habitId === habit.id);
      const completedCount = habitEntries.filter(e => e.completed).length;
      return {
        habitId: habit.id,
        title: habit.title,
        color: habit.color,
        completionRate: completedCount / 30,
        completedCount,
        totalDays: 30,
      };
    }).sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);

    // Weekly data
    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDateLocal(date);
      const dayEntries = entries.filter(e => e.entryDate === dateStr);
      const completed = dayEntries.filter(e => e.completed).length;

      weekly.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        completed,
        total: habits.length,
        rate: habits.length > 0 ? completed / habits.length : 0,
      });
    }

    return {
      overallCompletionRate,
      totalCompleted: completedEntries.length,
      totalPossible,
      topHabits,
      weekly,
    };
  },

  async getStreaks(): Promise<StreakData> {
    const habits = await getAllHabits(true);
    const entries = await getAllEntries();

    // Calculate streaks for each habit
    const streaksByHabit = habits.map(habit => {
      const habitEntries = entries
        .filter(e => e.habitId === habit.id && e.completed)
        .map(e => e.entryDate)
        .sort()
        .reverse();

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      const today = new Date();
      const checkDate = new Date(today);

      // Calculate current streak
      for (let i = 0; i < 365; i++) {
        const dateStr = formatDateLocal(checkDate);
        if (habitEntries.includes(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          // Allow for today not being completed yet
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        } else {
          break;
        }
      }

      // Calculate longest streak
      const sortedDates = [...habitEntries].sort();
      for (const date of sortedDates) {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = formatDateLocal(nextDate);

        if (habitEntries.includes(nextDateStr)) {
          tempStreak++;
        } else {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 0;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;

      return {
        habitId: habit.id,
        title: habit.title,
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
      };
    });

    // Overall current streak (all habits completed)
    let overallCurrentStreak = 0;

    if (habits.length > 0) {
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = formatDateLocal(checkDate);

        const dayEntries = entries.filter(e => e.entryDate === dateStr && e.completed);
        if (dayEntries.length >= habits.length) {
          overallCurrentStreak++;
        } else if (i === 0) {
          continue;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak: overallCurrentStreak,
      longestStreak: Math.max(
        overallCurrentStreak,
        ...streaksByHabit.map(s => s.longestStreak),
        0
      ),
      streaksByHabit,
    };
  },
};

// Local Badges API (simplified for guest mode)
export const localBadgesApi = {
  async getAll(): Promise<{ name: string; awardedAt: string }[]> {
    const streaks = await localInsightsApi.getStreaks();
    const insights = await localInsightsApi.getSummary();
    const badges: { name: string; awardedAt: string }[] = [];
    const now = new Date().toISOString();

    // First Habit badge
    const habits = await getAllHabits();
    if (habits.length > 0) {
      badges.push({ name: 'First Habit', awardedAt: habits[0].createdAt });
    }

    // Streak badges
    if (streaks.currentStreak >= 3) {
      badges.push({ name: '3 Day Streak', awardedAt: now });
    }
    if (streaks.currentStreak >= 7) {
      badges.push({ name: 'Week Warrior', awardedAt: now });
    }
    if (streaks.currentStreak >= 30) {
      badges.push({ name: 'Monthly Master', awardedAt: now });
    }

    // Completion badges
    if (insights.totalCompleted >= 10) {
      badges.push({ name: '10 Completions', awardedAt: now });
    }
    if (insights.totalCompleted >= 50) {
      badges.push({ name: '50 Completions', awardedAt: now });
    }
    if (insights.totalCompleted >= 100) {
      badges.push({ name: 'Century Club', awardedAt: now });
    }

    return badges;
  },
};

// Export local data for syncing when user signs up
export const exportLocalData = async () => {
  const habits = await getAllHabits();
  const entries = await getAllEntries();
  const focusSessions = await getAllFocusSessions();
  const userChallenges = await localChallengesApi.getUserChallenges();
  return { habits, entries, focusSessions, userChallenges };
};

// Sync local storage offline-created data with backend when signed in
export const syncLocalStorageWithBackend = async (): Promise<void> => {
  try {
    const habitsData = await AsyncStorage.getItem(STORAGE_KEYS.HABITS);
    const entriesData = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
    const focusSessionsData = await AsyncStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS);
    const userChallengesData = await AsyncStorage.getItem(STORAGE_KEYS.USER_CHALLENGES);

    const localHabits: Habit[] = habitsData ? JSON.parse(habitsData) : [];
    const localEntries: HabitEntry[] = entriesData ? JSON.parse(entriesData) : [];
    const localFocusSessions: FocusSession[] = focusSessionsData ? JSON.parse(focusSessionsData) : [];
    const localUserChallenges: UserChallenge[] = userChallengesData ? JSON.parse(userChallengesData) : [];

    // Filter only those that are truly local-only (ID starts with local_)
    const habitsToSync = localHabits.filter(h => h.id.startsWith('local_'));
    const entriesToSync = localEntries.filter(e => e.id.startsWith('local_'));
    const focusSessionsToSync = localFocusSessions.filter(s => s.id.startsWith('local_'));
    const userChallengesToSync = localUserChallenges.filter(c => c.id.startsWith('local_'));

    if (
      habitsToSync.length === 0 &&
      entriesToSync.length === 0 &&
      focusSessionsToSync.length === 0 &&
      userChallengesToSync.length === 0
    ) {
      return; // Nothing to sync
    }

    console.log(`[Sync] Starting sync: ${habitsToSync.length} habits, ${entriesToSync.length} entries, ${focusSessionsToSync.length} focus sessions, ${userChallengesToSync.length} challenges`);

    // Map to keep track of old local ID -> new DB ID mapping
    const habitIdMap: Record<string, string> = {};

    // 1. Sync habits
    for (const localHabit of habitsToSync) {
      try {
        const created = await habitsApi.create({
          title: localHabit.title,
          description: localHabit.description || undefined,
          color: localHabit.color,
          category: localHabit.category || undefined,
          goalType: localHabit.goalType,
          goalTarget: localHabit.goalTarget || undefined,
          unit: localHabit.unit || undefined,
        });

        // Store mapping
        habitIdMap[localHabit.id] = created.id;

        // If the habit was archived, archive it in backend too
        if (!localHabit.active) {
          await habitsApi.archive(created.id);
        }

        console.log(`[Sync] Synced habit "${localHabit.title}": ${localHabit.id} -> ${created.id}`);
      } catch (error) {
        console.error(`[Sync] Failed to sync habit "${localHabit.title}":`, error);
      }
    }

    // 2. Sync entries
    for (const localEntry of entriesToSync) {
      try {
        // Resolve habit ID if it was created locally
        const resolvedHabitId = habitIdMap[localEntry.habitId] || localEntry.habitId;

        // Skip if the habit was local-only but failed to sync
        if (resolvedHabitId.startsWith('local_')) {
          console.warn(`[Sync] Skipping entry sync for unresolved habit ID: ${resolvedHabitId}`);
          continue;
        }

        await entriesApi.toggle(
          resolvedHabitId,
          localEntry.entryDate,
          localEntry.completed,
          localEntry.value || undefined,
          localEntry.notes || undefined
        );

        console.log(`[Sync] Synced entry for habit ${resolvedHabitId} on ${localEntry.entryDate}`);
      } catch (error) {
        console.error(`[Sync] Failed to sync entry for habit ${localEntry.habitId}:`, error);
      }
    }

    // 3. Sync focus sessions
    const syncedFocusSessionIds = new Set<string>();
    for (const localSession of focusSessionsToSync) {
      try {
        const resolvedHabitId = localSession.habitId ? (habitIdMap[localSession.habitId] || localSession.habitId) : undefined;
        if (resolvedHabitId?.startsWith('local_')) {
          console.warn(`[Sync] Skipping focus session for unresolved habit ID: ${resolvedHabitId}`);
          continue;
        }

        await focusSessionsApi.create({
          habitId: resolvedHabitId,
          duration: localSession.duration,
          notes: localSession.notes || undefined,
          completedAt: localSession.completedAt,
        });
        syncedFocusSessionIds.add(localSession.id);
        console.log(`[Sync] Synced focus session ${localSession.id}`);
      } catch (error) {
        console.error(`[Sync] Failed to sync focus session ${localSession.id}:`, error);
      }
    }

    // 4. Sync joined challenges
    const syncedUserChallengeIds = new Set<string>();
    for (const localChallenge of userChallengesToSync) {
      // Skip mock challenges from guest mode
      if (!localChallenge.challengeId.includes('-')) {
        syncedUserChallengeIds.add(localChallenge.id);
        console.log(`[Sync] Skipped mock challenge ${localChallenge.challengeId}`);
        continue;
      }
      
      try {
        await challengesApi.join(localChallenge.challengeId);
        syncedUserChallengeIds.add(localChallenge.id);
        console.log(`[Sync] Synced challenge ${localChallenge.challengeId}`);
      } catch (error: any) {
        if (error?.response?.status === 409) {
          syncedUserChallengeIds.add(localChallenge.id);
          console.log(`[Sync] Challenge ${localChallenge.challengeId} already exists in backend`);
        } else {
          console.error(`[Sync] Failed to sync challenge ${localChallenge.challengeId}:`, error);
        }
      }
    }

    // 5. Clean up local storage
    const updatedHabits = localHabits.filter(h => !h.id.startsWith('local_') || habitIdMap[h.id]);
    // Replace temporary IDs with real ones in the storage
    const normalizedHabits = updatedHabits.map(h => {
      if (h.id.startsWith('local_') && habitIdMap[h.id]) {
        return { ...h, id: habitIdMap[h.id] };
      }
      return h;
    });

    // Remove synced entries
    const remainingEntries = localEntries.filter(e => !e.id.startsWith('local_'));
    const remainingFocusSessions = localFocusSessions.filter(s => !syncedFocusSessionIds.has(s.id));
    const remainingUserChallenges = localUserChallenges.filter(c => !syncedUserChallengeIds.has(c.id));

    await AsyncStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(normalizedHabits));
    await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(remainingEntries));
    await AsyncStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(remainingFocusSessions));
    await AsyncStorage.setItem(STORAGE_KEYS.USER_CHALLENGES, JSON.stringify(remainingUserChallenges));
    await guestStorage.setGuestMode(false);

    console.log('[Sync] Synchronization completed successfully!');
  } catch (err) {
    console.error('[Sync] Error during synchronization:', err);
  }
};

// Helper functions for focus sessions
async function getAllFocusSessions(): Promise<FocusSession[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS);
  return data ? JSON.parse(data) : [];
}

// Local Focus Sessions API
export const localFocusSessionsApi = {
  async getAll(): Promise<FocusSession[]> {
    return getAllFocusSessions();
  },

  async getStats(): Promise<FocusStats> {
    const sessions = await getAllFocusSessions();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const totalMinutes = sessions.reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);
    const todaySessions = sessions.filter(s => s.completedAt.startsWith(today));
    const todayMinutes = todaySessions.reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);
    const weekSessions = sessions.filter(s => s.completedAt >= weekAgoStr);
    const weekMinutes = weekSessions.reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);
    const longestSession = sessions.length > 0 ? Math.max(...sessions.map(s => s.duration)) : 0;

    return {
      totalSessions: sessions.length,
      totalMinutes,
      todayMinutes,
      weekMinutes,
      averageSessionLength: sessions.length > 0 ? Math.floor(totalMinutes / sessions.length) : 0,
      longestSession: Math.floor(longestSession / 60),
    };
  },

  async create(session: { habitId?: string; duration: number; notes?: string }): Promise<FocusSession> {
    const sessions = await getAllFocusSessions();
    const now = new Date().toISOString();

    const newSession: FocusSession = {
      id: generateId(),
      userId: 'guest',
      habitId: session.habitId || null,
      duration: session.duration,
      completedAt: now,
      notes: session.notes || null,
      createdAt: now,
    };

    sessions.push(newSession);
    await AsyncStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(sessions));
    return newSession;
  },

  async delete(id: string): Promise<void> {
    const sessions = await getAllFocusSessions();
    const filtered = sessions.filter(s => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(filtered));
  },
};

// Default challenges for guest mode
const defaultChallenges: Challenge[] = [
  {
    id: 'challenge_1',
    title: '7-Day Streak',
    description: 'Complete all habits for 7 consecutive days',
    type: 'streak',
    target: 7,
    duration: 7,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reward: 100,
    active: true,
  },
  {
    id: 'challenge_2',
    title: 'Focus Master',
    description: 'Complete 60 minutes of focused work',
    type: 'focus',
    target: 60,
    duration: 7,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reward: 75,
    active: true,
  },
  {
    id: 'challenge_3',
    title: 'Habit Builder',
    description: 'Complete 20 habit entries',
    type: 'completion',
    target: 20,
    duration: 14,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reward: 150,
    active: true,
  },
];

// Local Challenges API
export const localChallengesApi = {
  async getAll(): Promise<Challenge[]> {
    return defaultChallenges;
  },

  async getUserChallenges(): Promise<UserChallenge[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_CHALLENGES);
    return data ? JSON.parse(data) : [];
  },

  async join(challengeId: string): Promise<UserChallenge> {
    const userChallenges = await this.getUserChallenges();
    const challenge = defaultChallenges.find(c => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found');

    const existing = userChallenges.find(uc => uc.challengeId === challengeId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const newUserChallenge: UserChallenge = {
      id: generateId(),
      challengeId,
      userId: 'guest',
      progress: 0,
      completed: false,
      completedAt: null,
      joinedAt: now,
      challenge,
    };

    userChallenges.push(newUserChallenge);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_CHALLENGES, JSON.stringify(userChallenges));
    return newUserChallenge;
  },

  async getProgress(challengeId: string): Promise<{ progress: number; completed: boolean }> {
    const userChallenges = await this.getUserChallenges();
    const challenge = defaultChallenges.find(c => c.id === challengeId);
    if (!challenge) return { progress: 0, completed: false };

    const userChallenge = userChallenges.find(uc => uc.challengeId === challengeId);
    if (!userChallenge) return { progress: 0, completed: false };

    // Calculate progress based on challenge type
    let progress = 0;

    if (challenge.type === 'streak') {
      const streaks = await localInsightsApi.getStreaks();
      progress = Math.min(streaks.currentStreak, challenge.target);
    } else if (challenge.type === 'focus') {
      const stats = await localFocusSessionsApi.getStats();
      progress = Math.min(stats.weekMinutes, challenge.target);
    } else if (challenge.type === 'completion') {
      const insights = await localInsightsApi.getSummary();
      progress = Math.min(insights.totalCompleted, challenge.target);
    }

    const completed = progress >= challenge.target;

    // Update stored progress
    if (userChallenge.progress !== progress || userChallenge.completed !== completed) {
      userChallenge.progress = progress;
      userChallenge.completed = completed;
      if (completed && !userChallenge.completedAt) {
        userChallenge.completedAt = new Date().toISOString();
      }
      await AsyncStorage.setItem(STORAGE_KEYS.USER_CHALLENGES, JSON.stringify(userChallenges));
    }

    return { progress, completed };
  },
};
