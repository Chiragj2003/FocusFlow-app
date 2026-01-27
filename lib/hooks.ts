import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { badgesApi, challengesApi, entriesApi, focusSessionsApi, habitsApi, insightsApi, type HabitEntry, type Habit } from './api';
import {
  localBadgesApi,
  localChallengesApi,
  localEntriesApi,
  localFocusSessionsApi,
  localHabitsApi,
  localInsightsApi,
} from './localStorage';

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

// Custom hook to check if user should use local storage only
function useIsLocalMode() {
  const { isSignedIn } = useAuth();
  return !isSignedIn;
}

// =====================
// HABITS HOOKS - FAST loading with local-first strategy
// =====================

export function useHabits(active?: boolean) {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: active === undefined ? queryKeys.habits : active ? queryKeys.habitsActive : queryKeys.habitsArchived,
    queryFn: async () => {
      // For guest mode, use local storage directly (INSTANT)
      if (isLocal) {
        return localHabitsApi.getAll(active);
      }

      // For signed-in users: Try API, but with fast timeout
      try {
        const apiData = await habitsApi.getAll(active);
        // Save to local storage for next time (background)
        return apiData;
      } catch (error) {
        console.warn('API failed, falling back to local:', error);
        // Fallback to local storage on API error
        return localHabitsApi.getAll(active);
      }
    },
    staleTime: 60 * 1000, // 1 minute - data is fresh for 1 min
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: 'always', // Always refetch but show cached immediately
    refetchOnWindowFocus: false, // Don't refetch on focus (mobile doesn't have windows)
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: async (habit: {
      title: string;
      description?: string;
      color?: string;
      category?: string;
      goalType: 'binary' | 'duration' | 'quantity';
      goalTarget?: number;
      unit?: string;
    }) => isLocal ? localHabitsApi.create(habit) : habitsApi.create(habit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

// AI-powered habit generation hook (only works when signed in)
export function useGenerateHabitsWithAI() {
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: async (prompt: string) => {
      if (isLocal) {
        throw new Error('AI habit generation requires signing in');
      }
      return habitsApi.generateWithAI(prompt);
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof habitsApi.update>[1] }) =>
      isLocal ? localHabitsApi.update(id, data) : habitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: async (id: string) => isLocal ? localHabitsApi.delete(id) : habitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: async (id: string) => isLocal ? localHabitsApi.archive(id) : habitsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

export function useRestoreHabit() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: async (id: string) => isLocal ? localHabitsApi.restore(id) : habitsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

// =====================
// ENTRIES HOOKS - FAST loading with instant optimistic updates
// =====================

export function useEntries(startDate: string, endDate: string) {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.entries(startDate, endDate),
    queryFn: async () => {
      // For guest mode, use local storage directly (INSTANT)
      if (isLocal) {
        return localEntriesApi.getByDateRange(startDate, endDate);
      }

      // For signed-in users: Try API with fallback
      try {
        const data = await entriesApi.getByDateRange(startDate, endDate);
        // Normalize dates from API (remove time component)
        return data.map(e => ({
          ...e,
          entryDate: typeof e.entryDate === 'string' ? e.entryDate.split('T')[0] : formatDate(e.entryDate)
        }));
      } catch (error) {
        console.warn('API failed for entries, falling back to local:', error);
        return localEntriesApi.getByDateRange(startDate, endDate);
      }
    },
    staleTime: 30 * 1000, // 30 seconds - entries need to be fresher
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useToggleEntry() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();
  const pendingMutations = useRef<Set<string>>(new Set());

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
      const mutationKey = `${habitId}-${entryDate}`;

      // Prevent duplicate requests - but return fake entry to not break optimistic update
      if (pendingMutations.current.has(mutationKey)) {
        console.log('Skipping duplicate mutation for:', mutationKey);
        // Return a fake entry so optimistic update works
        return {
          id: `skip-${Date.now()}`,
          habitId,
          userId: 'user',
          entryDate,
          completed,
          value: value ?? null,
          notes: notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }


      pendingMutations.current.add(mutationKey);

      try {
        if (isLocal) {
          return await localEntriesApi.toggle(habitId, entryDate, completed, value, notes);
        }

        // For signed-in users: try API, fallback to local
        try {
          return await entriesApi.toggle(habitId, entryDate, completed, value, notes);
        } catch (apiError) {
          console.warn('API toggle failed, saving locally:', apiError);
          // Save locally as fallback
          return await localEntriesApi.toggle(habitId, entryDate, completed, value, notes);
        }
      } finally {
        pendingMutations.current.delete(mutationKey);
      }
    },
    // CRITICAL: Optimistic update for INSTANT UI feedback
    onMutate: async (newEntry) => {
      // Cancel any outgoing refetches to prevent overwrite
      await queryClient.cancelQueries({ queryKey: ['entries'] });

      // Snapshot all entry queries for potential rollback
      const previousEntries = queryClient.getQueriesData({ queryKey: ['entries'] });

      // Optimistically update ALL matching entry queries IMMEDIATELY
      queryClient.setQueriesData({ queryKey: ['entries'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;

        const existingIndex = old.findIndex(
          (e: any) => e.habitId === newEntry.habitId && e.entryDate === newEntry.entryDate
        );

        if (existingIndex >= 0) {
          // Update existing entry
          const updated = [...old];
          updated[existingIndex] = {
            ...updated[existingIndex],
            completed: newEntry.completed,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        } else {
          // Add new entry optimistically
          return [...old, {
            id: `optimistic-${Date.now()}`,
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
      console.error('Toggle entry failed:', err);
      // Rollback on error
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Don't invalidate entries - we already updated optimistically
      // Only invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.insights });
      queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
    },
  });
}

// =====================
// INSIGHTS HOOKS
// =====================

export function useInsights() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: async () => {
      if (isLocal) {
        return localInsightsApi.getSummary();
      }
      try {
        return await insightsApi.getSummary();
      } catch {
        return localInsightsApi.getSummary();
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: 'always',
  });
}

export function useStreaks() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      if (isLocal) {
        return localInsightsApi.getStreaks();
      }
      try {
        return await insightsApi.getStreaks();
      } catch {
        return localInsightsApi.getStreaks();
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: 'always',
  });
}

// =====================
// BADGES HOOKS
// =====================

export function useBadges() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: async () => {
      if (isLocal) {
        return localBadgesApi.getAll();
      }
      try {
        return await badgesApi.getAll();
      } catch {
        return localBadgesApi.getAll();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =====================
// FOCUS SESSIONS HOOKS
// =====================

export function useFocusSessions() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.focusSessions,
    queryFn: async () => {
      if (isLocal) {
        return localFocusSessionsApi.getAll();
      }
      try {
        return await focusSessionsApi.getAll();
      } catch {
        return localFocusSessionsApi.getAll();
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useFocusStats() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.focusStats,
    queryFn: async () => {
      if (isLocal) {
        return localFocusSessionsApi.getStats();
      }
      try {
        return await focusSessionsApi.getStats();
      } catch {
        return localFocusSessionsApi.getStats();
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: (data: { habitId?: string; duration: number; notes?: string }) =>
      isLocal ? localFocusSessionsApi.create(data) : focusSessionsApi.create(data),
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
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.challenges,
    queryFn: async () => {
      if (isLocal) {
        return localChallengesApi.getAll();
      }
      try {
        return await challengesApi.getAll();
      } catch {
        return localChallengesApi.getAll();
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUserChallenges() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: [...queryKeys.challenges, 'user'],
    queryFn: async () => {
      if (isLocal) {
        return localChallengesApi.getUserChallenges();
      }
      try {
        return await challengesApi.getUserChallenges();
      } catch {
        return localChallengesApi.getUserChallenges();
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: (challengeId: string) =>
      isLocal ? localChallengesApi.join(challengeId) : challengesApi.join(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges });
    },
  });
}

export function useChallengeProgress(challengeId: string) {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.challengeProgress(challengeId),
    queryFn: async () => {
      if (isLocal) {
        return localChallengesApi.getProgress(challengeId);
      }
      try {
        return await challengesApi.getProgress(challengeId);
      } catch {
        return localChallengesApi.getProgress(challengeId);
      }
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!challengeId,
  });
}

// =====================
// HELPER FUNCTIONS
// =====================

// Helper to get date range for current month
export function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// Helper to get date range for a specific month
export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDateLocal(start),
    end: formatDateLocal(end),
  };
}

// Helper to format date in local timezone (YYYY-MM-DD)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format date
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDateLocal(d);
}

// Helper to get today's date
export function getToday(): string {
  return formatDateLocal(new Date());
}

// Helper to get all days in a month as date strings
export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push(formatDateLocal(date));
  }

  return days;
}
