import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsManager } from './notifications';
import {
  badgesApi,
  challengesApi,
  entriesApi,
  focusSessionsApi,
  habitsApi,
  insightsApi,
  type HabitEntry,
  type Habit
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

// =====================
// HABITS HOOKS - Online Only
// =====================

export function useHabits(active?: boolean) {
  return useQuery({
    queryKey: active === undefined ? queryKeys.habits : active ? queryKeys.habitsActive : queryKeys.habitsArchived,
    queryFn: async () => {
      return habitsApi.getAll(active);
    },
    staleTime: 30 * 1000, // 30 seconds stale time - cached unless mutation occurs
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      return habitsApi.create(habit);
    },
    onMutate: async (newHabit) => {
      // Cancel outgoing habits fetches
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      await queryClient.cancelQueries({ queryKey: queryKeys.habitsActive });

      // Snapshot previous values
      const previousHabits = queryClient.getQueryData(queryKeys.habits);
      const previousHabitsActive = queryClient.getQueryData(queryKeys.habitsActive);

      // Create a temporary client-side ID
      const tempId = `temp-${Date.now()}`;
      const optimisticHabit = {
        ...newHabit,
        id: tempId,
        userId: 'user',
        active: true,
        description: newHabit.description ?? null,
        category: newHabit.category ?? null,
        color: newHabit.color ?? '#f97316',
        goalTarget: newHabit.goalTarget ?? null,
        unit: newHabit.unit ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.habits, (old: any) => 
        old ? [optimisticHabit, ...old] : [optimisticHabit]
      );
      queryClient.setQueryData(queryKeys.habitsActive, (old: any) => 
        old ? [optimisticHabit, ...old] : [optimisticHabit]
      );

      return { previousHabits, previousHabitsActive, tempId };
    },
    onError: (err, newHabit, context) => {
      // Rollback to previous values
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits, context.previousHabits);
      }
      if (context?.previousHabitsActive) {
        queryClient.setQueryData(queryKeys.habitsActive, context.previousHabitsActive);
      }
    },
    onSuccess: (data, variables, context) => {
      // Swap the temporary ID with the real server response
      const tempId = context?.tempId;
      if (tempId) {
        queryClient.setQueryData(queryKeys.habits, (old: any) => {
          if (!old) return [data];
          return old.map((h: any) => h.id === tempId ? data : h);
        });
        queryClient.setQueryData(queryKeys.habitsActive, (old: any) => {
          if (!old) return [data];
          return old.map((h: any) => h.id === tempId ? data : h);
        });
      }
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
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof habitsApi.update>[1] }) => {
      return habitsApi.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });

      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Optimistically update all habits query caches
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === id ? { ...h, ...data, updatedAt: new Date().toISOString() } : h);
      });

      return { previousHabits };
    },
    onError: (err, variables, context) => {
      if (context?.previousHabits) {
        context.previousHabits.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      // Replace with real updated habit from server
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === data.id ? data : h);
      });
      notificationsManager.updateScheduledReminders('habit updated', 3000);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return habitsApi.delete(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });

      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Optimistically remove the habit from all query caches
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((h: any) => h.id !== id);
      });

      return { previousHabits };
    },
    onError: (err, id, context) => {
      if (context?.previousHabits) {
        context.previousHabits.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      notificationsManager.updateScheduledReminders('habit deleted', 3000);
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return habitsApi.archive(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });

      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Optimistically set active to false
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === id ? { ...h, active: false, updatedAt: new Date().toISOString() } : h);
      });

      return { previousHabits };
    },
    onError: (err, id, context) => {
      if (context?.previousHabits) {
        context.previousHabits.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === data.id ? data : h);
      });
      notificationsManager.updateScheduledReminders('habit archived', 3000);
    },
  });
}

export function useRestoreHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return habitsApi.restore(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });

      const previousHabits = queryClient.getQueriesData({ queryKey: ['habits'] });

      // Optimistically set active to true
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === id ? { ...h, active: true, updatedAt: new Date().toISOString() } : h);
      });

      return { previousHabits };
    },
    onError: (err, id, context) => {
      if (context?.previousHabits) {
        context.previousHabits.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      queryClient.setQueriesData({ queryKey: ['habits'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((h: any) => h.id === data.id ? data : h);
      });
      notificationsManager.updateScheduledReminders('habit restored', 5000);
    },
  });
}

// =====================
// ENTRIES HOOKS - Online Only
// =====================

export function useEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.entries(startDate, endDate),
    queryFn: async () => {
      const data = await entriesApi.getByDateRange(startDate, endDate);
      const normalized = data.map(e => ({
        ...e,
        entryDate: typeof e.entryDate === 'string' ? e.entryDate.split('T')[0] : formatDate(e.entryDate)
      }));
      return normalized;
    },
    staleTime: 15 * 1000, // 15 seconds stale time - cached unless toggle occurs
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      return entriesApi.toggle(habitId, entryDate, completed, value, notes);
    },
    onMutate: async (newEntry) => {
      // Cancel entries refetches
      await queryClient.cancelQueries({ queryKey: ['entries'] });

      // Snapshot current values
      const previousEntries = queryClient.getQueriesData({ queryKey: ['entries'] });

      // Optimistically update
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
          return [...old, {
            id: `temp-entry-${Date.now()}`,
            habitId: newEntry.habitId,
            userId: 'user',
            entryDate: newEntry.entryDate,
            completed: newEntry.completed,
            value: newEntry.value ?? null,
            notes: newEntry.notes ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }];
        }
      });

      return { previousEntries };
    },
    onError: (err, _newEntry, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      // Replace with real database entry
      queryClient.setQueriesData({ queryKey: ['entries'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((e: any) => 
          (e.habitId === data.habitId && e.entryDate === data.entryDate) ? data : e
        );
      });
      // Invalidate streaks and insights since they are aggregate computed data
      queryClient.invalidateQueries({ queryKey: queryKeys.insights });
      queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
    },
  });
}

// =====================
// INSIGHTS HOOKS
// =====================

export function useInsights() {
  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: async () => {
      return insightsApi.getSummary();
    },
    staleTime: 15 * 1000, // Cached unless invalidated by toggle/creation
    refetchOnMount: 'always',
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      return insightsApi.getStreaks();
    },
    staleTime: 15 * 1000, // Cached unless invalidated by toggle/creation
    refetchOnMount: 'always',
  });
}

// =====================
// BADGES HOOKS
// =====================

export function useBadges() {
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: async () => {
      try {
        return await badgesApi.getAll();
      } catch (error) {
        console.warn('API failed for badges:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAwardBadge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, metadata }: { name: string; metadata?: Record<string, any> }) => {
      return badgesApi.awardBadge(name, metadata);
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
    staleTime: 30 * 1000, // Cached unless session created
  });
}

export function useFocusStats() {
  return useQuery({
    queryKey: queryKeys.focusStats,
    queryFn: async () => {
      return focusSessionsApi.getStats();
    },
    staleTime: 30 * 1000, // Cached unless session created
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
    staleTime: 30 * 1000,
  });
}

export function useUserChallenges() {
  return useQuery({
    queryKey: [...queryKeys.challenges, 'user'],
    queryFn: async () => {
      return challengesApi.getUserChallenges();
    },
    staleTime: 30 * 1000,
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
    staleTime: 30 * 1000,
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
