import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flameForStreak, milestoneImage } from '@/components/ui/StreakFlame';
import { celebrate } from './celebrate';
import { safeHabitColor } from './habitColor';
import { messages } from './messages';
import { notificationsManager } from './notifications';
import { localStorage } from './localStorage';
import {
  badgesApi,
  challengesApi,
  entriesApi,
  focusSessionsApi,
  habitsApi,
  insightsApi,
  type HabitEntry,
  type Habit,
  type Badge,
} from './api';

// Query keys
export const queryKeys = {
  habits: ['habits'] as const,
  habitsActive: ['habits', 'active'] as const,
  habitsArchived: ['habits', 'archived'] as const,
  entries: (start: string, end: string) => ['entries', start, end] as const,
  insights: ['insights'] as const,
  streaks: ['streaks'] as const,
  badges: ['badges'] as const,
  focusSessions: ['focusSessions'] as const,
  focusStats: ['focusStats'] as const,
  challenges: ['challenges'] as const,
  challengeProgress: (id: string) => ['challengeProgress', id] as const,
};

// Debounce timer for insights and streaks invalidation
let debounceInvalidateTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedInvalidateInsights(queryClient: ReturnType<typeof useQueryClient>) {
  if (debounceInvalidateTimeout) {
    clearTimeout(debounceInvalidateTimeout);
  }
  debounceInvalidateTimeout = setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.insights });
    queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
  }, 2500);
}

// =====================
// HABITS HOOKS - Mobile-First Local Storage Priority
// =====================

// Stable function reference so React Query can memoize the selected result
function withSafeColors(habits: Habit[] | undefined): Habit[] {
  return (habits || []).map((h) => {
    const color = safeHabitColor(h.color);
    return color === h.color ? h : { ...h, color };
  });
}

export function useHabits(active?: boolean) {
  return useQuery({
    queryKey: active === undefined ? queryKeys.habits : active ? queryKeys.habitsActive : queryKeys.habitsArchived,
    queryFn: async () => {
      try {
        const remote = await habitsApi.getAll(active);
        if (remote && Array.isArray(remote)) {
          // Merge with any unsynced local temporary habits
          const merged = await localStorage.mergeRemoteHabits(remote, active);
          return merged.filter((h) => (active === undefined ? true : h.active === active));
        }
        return remote;
      } catch (err) {
        console.warn('[useHabits] Network unavailable, returning mobile local storage habits.');
        const local = await localStorage.getLocalHabits();
        return local.filter((h) => (active === undefined ? true : h.active === active));
      }
    },
    // Display-safe colors (no white/black habits, so ticks and dots stay visible)
    select: withSafeColors,
    staleTime: 60 * 1000, // 60 seconds stale time
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (habit: {
      title: string;
      description?: string;
      color?: string;
      category?: string;
      goalType: 'binary' | 'duration' | 'quantity';
      goalTarget?: number;
      unit?: string;
    }) => {
      // Local-first: onMutate saves the habit and queues CREATE_HABIT.
      // The sync queue is the only path to the server (avoids duplicate creates).
      return habit;
    },
    onMutate: async (newHabit) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      await queryClient.cancelQueries({ queryKey: queryKeys.habitsActive });

      const previousHabits = queryClient.getQueryData(queryKeys.habits);
      const previousHabitsActive = queryClient.getQueryData(queryKeys.habitsActive);

      // Create a temporary client-side ID
      const tempId = `temp-${Date.now()}`;
      const optimisticHabit: Habit = {
        id: tempId,
        userId: 'current-user',
        title: newHabit.title,
        description: newHabit.description ?? null,
        category: newHabit.category ?? null,
        color: newHabit.color ?? '#f97316',
        goalType: newHabit.goalType,
        goalTarget: newHabit.goalTarget ?? null,
        unit: newHabit.unit ?? null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save to mobile local storage immediately
      await localStorage.upsertLocalHabit(optimisticHabit);

      // 2. Queue for background sync
      await localStorage.enqueueAction('CREATE_HABIT', { tempId, data: newHabit });

      // 3. Optimistically update TanStack Query cache
      queryClient.setQueryData(queryKeys.habits, (old: any) =>
        old ? [optimisticHabit, ...old] : [optimisticHabit]
      );
      queryClient.setQueryData(queryKeys.habitsActive, (old: any) =>
        old ? [optimisticHabit, ...old] : [optimisticHabit]
      );

      return { previousHabits, previousHabitsActive, tempId };
    },
    onError: (err) => {
      console.warn('[useCreateHabit] Failed to save habit locally:', err);
    },
    onSuccess: () => {
      // Temp ID -> server ID swap happens in the sync queue; queries are
      // invalidated when a sync cycle finishes (see AuthTokenProvider).
      // First habit is a natural moment to ask for reminder permission (once).
      notificationsManager.askOnceIfRemindersEnabled();
      notificationsManager.updateScheduledReminders('habit created', 5000);
    },
  });
}

export function useGenerateHabitsWithAI() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      return habitsApi.generateWithAI(prompt);
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_vars: { id: string; data: Parameters<typeof habitsApi.update>[1] }) => {
      // Queued in onMutate; the sync queue sends it to the server.
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // 1. Update in local storage
      const habits = await localStorage.getLocalHabits();
      const target = habits.find((h) => h.id === id);
      if (target) {
        await localStorage.upsertLocalHabit({ ...target, ...data } as Habit);
      }

      // 2. Queue sync
      await localStorage.enqueueAction('UPDATE_HABIT', { id, data });

      // 3. Optimistically update query caches
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) =>
          h.id === id ? { ...h, ...data, updatedAt: new Date().toISOString() } : h
        );
      });

      return { previousHabits };
    },
    onSuccess: () => {
      notificationsManager.updateScheduledReminders('habit updated', 3000);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string) => {
      // Queued in onMutate; the sync queue sends it to the server.
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // 1. Remove from local storage
      await localStorage.removeLocalHabit(id);

      // 2. Queue sync
      await localStorage.enqueueAction('DELETE_HABIT', { id });

      // 3. Optimistically remove from all query caches
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((h: any) => h.id !== id);
      });

      return { previousHabits };
    },
    onSuccess: () => {
      notificationsManager.updateScheduledReminders('habit deleted', 3000);
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string) => {
      // Queued in onMutate; the sync queue sends it to the server.
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Local storage update & sync queue
      const habits = await localStorage.getLocalHabits();
      const target = habits.find((h) => h.id === id);
      if (target) {
        await localStorage.upsertLocalHabit({ ...target, active: false });
      }
      await localStorage.enqueueAction('ARCHIVE_HABIT', { id });

      // Optimistically update
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) =>
          h.id === id ? { ...h, active: false, updatedAt: new Date().toISOString() } : h
        );
      });

      return { previousHabits };
    },
    onSuccess: () => {
      notificationsManager.updateScheduledReminders('habit archived', 3000);
    },
  });
}

export function useRestoreHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string) => {
      // Queued in onMutate; the sync queue sends it to the server.
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Local storage update & sync queue
      const habits = await localStorage.getLocalHabits();
      const target = habits.find((h) => h.id === id);
      if (target) {
        await localStorage.upsertLocalHabit({ ...target, active: true });
      }
      await localStorage.enqueueAction('RESTORE_HABIT', { id });

      // Optimistically set active to true
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) =>
          h.id === id ? { ...h, active: true, updatedAt: new Date().toISOString() } : h
        );
      });

      return { previousHabits };
    },
    onSuccess: () => {
      notificationsManager.updateScheduledReminders('habit restored', 5000);
    },
  });
}

// =====================
// ENTRIES HOOKS - Mobile-First Local Storage Priority
// =====================

export function useEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.entries(startDate, endDate),
    queryFn: async () => {
      try {
        const data = await entriesApi.getByDateRange(startDate, endDate);
        const normalized = data.map((e) => ({
          ...e,
          entryDate: typeof e.entryDate === 'string' ? e.entryDate.split('T')[0] : formatDate(e.entryDate),
        }));

        // Merge with local mobile storage entries (unsynced toggles win)
        const merged = await localStorage.mergeRemoteEntries(normalized);

        return merged.filter((e) => {
          const d = e.entryDate.split('T')[0];
          return d >= startDate && d <= endDate;
        });
      } catch (err) {
        console.warn('[useEntries] Network unavailable, returning mobile local storage entries.');
        const local = await localStorage.getLocalEntries();
        return local.filter((e) => {
          const d = e.entryDate.split('T')[0];
          return d >= startDate && d <= endDate;
        });
      }
    },
    staleTime: 30 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useToggleEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      habitId,
      entryDate,
      completed,
      value,
      notes,
    }: {
      habitId: string;
      entryDate: string;
      completed: boolean;
      value?: number;
      notes?: string;
    }) => {
      // Local-first: onMutate saves the entry and queues TOGGLE_ENTRY.
      // The sync queue is the only path to the server (avoids double requests).
      return {
        id: `local-${Date.now()}`,
        habitId,
        userId: 'current-user',
        entryDate,
        completed,
        value: value ?? null,
        notes: notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as HabitEntry;
    },
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['entries'] });

      // 1. Immediately persist to Mobile Local Storage
      await localStorage.upsertLocalEntry({
        habitId: newEntry.habitId,
        entryDate: newEntry.entryDate,
        completed: newEntry.completed,
        value: newEntry.value,
        notes: newEntry.notes,
      });

      // 2. Queue for background sync to web
      await localStorage.enqueueAction('TOGGLE_ENTRY', newEntry);

      // 3. Optimistically update TanStack Query cache
      queryClient.setQueriesData({ queryKey: ['entries'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;

        const existingIndex = old.findIndex(
          (e: any) => e.habitId === newEntry.habitId && e.entryDate === newEntry.entryDate
        );

        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = {
            ...updated[existingIndex],
            completed: newEntry.completed,
            value: newEntry.value !== undefined ? newEntry.value : updated[existingIndex].value,
            notes: newEntry.notes !== undefined ? newEntry.notes : updated[existingIndex].notes,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        } else {
          return [
            ...old,
            {
              id: `temp-entry-${Date.now()}`,
              habitId: newEntry.habitId,
              userId: 'current-user',
              entryDate: newEntry.entryDate,
              completed: newEntry.completed,
              value: newEntry.value ?? null,
              notes: newEntry.notes ?? null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
        }
      });

      // 4. Debounced invalidation of insights and streaks to prevent network storms
      debouncedInvalidateInsights(queryClient);

      return {};
    },
    onError: (err) => {
      console.warn('[useToggleEntry] Failed to save entry locally:', err);
    },
    onSuccess: (_data, vars) => {
      if (vars.completed) {
        (async () => {
          // Streak first (first check-in of the day), then "perfect day" if that was the last one
          await maybeCelebrateStreak(vars.entryDate, queryClient);
          await maybeCelebrateAllDone(vars.entryDate);
        })().catch((e) => console.warn('[useToggleEntry] Celebration check failed:', e));
      }
      // Skip today's reminders for done habits / drop the evening nudge when all done
      notificationsManager.updateScheduledReminders('entry toggled', 1500);
    },
  });
}

const STREAK_CELEBRATED_KEY = '@focusflow_streak_celebrated_day';

const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Duolingo-style "streak extended" moment: shown once per day, on the first
 * habit checked today. Uses the server streak (as of yesterday) + today, and
 * the locally stored days as a cross-check.
 */
async function maybeCelebrateStreak(entryDate: string, queryClient: ReturnType<typeof useQueryClient>) {
  const date = entryDate.split('T')[0];
  const today = getToday();
  if (date !== today) return;
  if ((await AsyncStorage.getItem(STREAK_CELEBRATED_KEY)) === today) return;

  const entries = await localStorage.getLocalEntries();
  const doneDays = new Set(entries.filter((e) => e.completed).map((e) => e.entryDate.split('T')[0]));
  if (!doneDays.has(today)) return;

  // Consecutive days ending today, from what's stored on the phone
  let localRun = 0;
  const cursor = new Date();
  while (doneDays.has(localDateKey(cursor))) {
    localRun++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Server streak was computed before today's check-in
  const server = queryClient.getQueryData<{ currentStreak?: number }>(queryKeys.streaks)?.currentStreak ?? 0;
  const yesterdayDone = localRun >= 2 || server > 0;
  const streak = Math.max(localRun, yesterdayDone ? server + 1 : 1);

  await AsyncStorage.setItem(STREAK_CELEBRATED_KEY, today);

  // Week strip: Monday → Sunday of this week
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const week = labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = localDateKey(d);
    const daysAgo = Math.round((new Date(today).getTime() - new Date(key).getTime()) / 86400000);
    return {
      label,
      today: key === today,
      // Done if stored locally, or if it falls inside the current streak
      done: doneDays.has(key) || (daysAgo >= 0 && daysAgo < streak),
    };
  });

  const milestone = milestoneImage(streak);

  celebrate({
    title: milestone ? `${streak} day milestone!` : streak === 1 ? 'Streak started!' : `${streak} day streak!`,
    message: streak === 1 ? 'Day one. Come back tomorrow to grow your flame.' : messages.streak(streak),
    image: milestone ?? flameForStreak(streak),
    week,
    cta: streak === 1 ? 'Let’s go' : 'Keep it burning',
  });
}

const CELEBRATED_DAY_KEY = '@focusflow_celebrated_day';

/** Shows the "Perfect day" celebration once, when the last habit of today is checked. */
async function maybeCelebrateAllDone(entryDate: string) {
  const date = entryDate.split('T')[0];
  if (date !== getToday()) return;

  const habits = (await localStorage.getLocalHabits()).filter((h) => h.active !== false);
  if (habits.length === 0) return;

  const entries = await localStorage.getLocalEntries();
  const done = new Set(
    entries.filter((e) => e.completed && e.entryDate.split('T')[0] === date).map((e) => e.habitId)
  );
  if (!habits.every((h) => done.has(h.id))) return;

  if ((await AsyncStorage.getItem(CELEBRATED_DAY_KEY)) === date) return;
  await AsyncStorage.setItem(CELEBRATED_DAY_KEY, date);

  celebrate({
    title: 'Perfect day!',
    message: messages.allDone(),
    mood: 'checklist',
    highlight: `${habits.length}/${habits.length} habits`,
    highlightIcon: 'checkmark-circle',
    cta: 'Awesome',
  });
}

// =====================
// INSIGHTS HOOKS
// =====================

export function useInsights() {
  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: async () => {
      try {
        return await insightsApi.getSummary();
      } catch (err) {
        console.warn('[useInsights] Failed to fetch server insights summary.');
        return {
          overallCompletionRate: 0,
          totalCompleted: 0,
          totalPossible: 0,
          topHabits: [],
          weekly: [],
        };
      }
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      try {
        return await insightsApi.getStreaks();
      } catch (err) {
        console.warn('[useStreaks] Failed to fetch server streaks.');
        return {
          currentStreak: 0,
          longestStreak: 0,
          streaksByHabit: [],
        };
      }
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// =====================
// BADGES HOOKS - Local-First & 405 Resilient
// =====================

export function useBadges() {
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: async () => {
      const localBadges = await localStorage.getLocalBadges();
      try {
        const remote = await badgesApi.getAll();
        if (Array.isArray(remote)) {
          // Merge local badges with remote badges
          const map = new Map<string, Badge>();
          remote.forEach((b) => map.set(b.name, b));
          localBadges.forEach((b) => map.set(b.name, b));
          const merged = Array.from(map.values());
          await localStorage.saveLocalBadges(merged);
          return merged;
        }
      } catch (error) {
        console.warn('[useBadges] Remote badges failed, using local storage badges.');
      }
      return localBadges;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useAwardBadge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, metadata }: { name: string; metadata?: Record<string, any> }) => {
      // 1. Immediately store in local storage (mobile source of truth)
      await localStorage.addLocalBadge(name);

      // 2. Best-effort post to server, gracefully ignore 405 Method Not Allowed
      try {
        const result = await badgesApi.awardBadge(name, metadata);
        return result;
      } catch (err: any) {
        if (err?.response?.status === 405 || err?.response?.status === 404) {
          // Expected on server without POST /api/badges
          return { name, awardedAt: new Date().toISOString() } as Badge;
        }
        // Silently resolve - badge is already earned on mobile
        return { name, awardedAt: new Date().toISOString() } as Badge;
      }
    },
    onMutate: async ({ name }) => {
      // Optimistically update query cache
      queryClient.setQueryData(queryKeys.badges, (old: Badge[] | undefined) => {
        const existing = old || [];
        if (existing.some((b) => b.name === name)) return existing;
        return [...existing, { name, awardedAt: new Date().toISOString() }];
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.badges });
    },
  });
}

// =====================
// FOCUS SESSIONS HOOKS
// =====================

export function useFocusSessions() {
  return useQuery({
    queryKey: queryKeys.focusSessions,
    queryFn: async () => {
      return focusSessionsApi.getAll();
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });
}

export function useFocusStats() {
  return useQuery({
    queryKey: queryKeys.focusStats,
    queryFn: async () => {
      return focusSessionsApi.getStats();
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { habitId?: string; duration: number; notes?: string }) => {
      return focusSessionsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.focusSessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.focusStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges });
    },
  });
}

// =====================
// CHALLENGES HOOKS
// =====================

export function useChallenges() {
  return useQuery({
    queryKey: queryKeys.challenges,
    queryFn: async () => {
      return challengesApi.getAll();
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });
}

export function useUserChallenges() {
  return useQuery({
    queryKey: [...queryKeys.challenges, 'user'],
    queryFn: async () => {
      return challengesApi.getUserChallenges();
    },
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      return challengesApi.join(challengeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges });
    },
  });
}

export function useChallengeProgress(challengeId: string) {
  return useQuery({
    queryKey: queryKeys.challengeProgress(challengeId),
    queryFn: async () => {
      return challengesApi.getProgress(challengeId);
    },
    staleTime: 60 * 1000,
    enabled: !!challengeId,
  });
}

// =====================
// HELPER FUNCTIONS
// =====================

export function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDateLocal(start),
    end: formatDateLocal(end),
  };
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDateLocal(start),
    end: formatDateLocal(end),
  };
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDateLocal(d);
}

export function getToday(): string {
  return formatDateLocal(new Date());
}

export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push(formatDateLocal(date));
  }

  return days;
}
