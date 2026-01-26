import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgesApi, challengesApi, entriesApi, focusSessionsApi, habitsApi, insightsApi } from './api';
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

// Custom hook to check if user should use local storage
function useIsLocalMode() {
  const { isSignedIn } = useAuth();
  return !isSignedIn;
}

// Habits hooks
export function useHabits(active?: boolean) {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: active === undefined ? queryKeys.habits : active ? queryKeys.habitsActive : queryKeys.habitsArchived,
    queryFn: () => isLocal ? localHabitsApi.getAll(active) : habitsApi.getAll(active),
    staleTime: 2 * 60 * 1000, // 2 minutes - habits don't change often
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
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

// Entries hooks
export function useEntries(startDate: string, endDate: string) {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.entries(startDate, endDate),
    queryFn: () => isLocal
      ? localEntriesApi.getByDateRange(startDate, endDate)
      : entriesApi.getByDateRange(startDate, endDate),
    staleTime: 60 * 1000, // 1 minute - entries change when user toggles
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

export function useToggleEntry() {
  const queryClient = useQueryClient();
  const isLocal = useIsLocalMode();

  return useMutation({
    mutationFn: ({
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
    }) => isLocal
        ? localEntriesApi.toggle(habitId, entryDate, completed, value, notes)
        : entriesApi.toggle(habitId, entryDate, completed, value, notes),
    // Optimistic update for instant feedback
    onMutate: async (newEntry) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['entries'] });

      // Snapshot all entry queries for rollback
      const previousEntries = queryClient.getQueriesData({ queryKey: ['entries'] });

      // Optimistically update all entry queries
      queryClient.setQueriesData({ queryKey: ['entries'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;

        const existingIndex = old.findIndex(
          (e: any) => e.habitId === newEntry.habitId && e.entryDate === newEntry.entryDate
        );

        if (existingIndex >= 0) {
          // Update existing entry
          const updated = [...old];
          updated[existingIndex] = { ...updated[existingIndex], completed: newEntry.completed };
          return updated;
        } else {
          // Add new entry
          return [...old, {
            id: `temp-${Date.now()}`,
            habitId: newEntry.habitId,
            entryDate: newEntry.entryDate,
            completed: newEntry.completed,
            value: newEntry.value,
            notes: newEntry.notes,
          }];
        }
      });

      return { previousEntries };
    },
    onError: (_err, _newEntry, context) => {
      // Rollback on error
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.insights });
      queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
    },
  });
}

// Insights hooks
export function useInsights() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: () => isLocal ? localInsightsApi.getSummary() : insightsApi.getSummary(),
    staleTime: 60000,
  });
}

export function useStreaks() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: () => isLocal ? localInsightsApi.getStreaks() : insightsApi.getStreaks(),
    staleTime: 60000,
  });
}

// Badges hooks
export function useBadges() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: () => isLocal ? localBadgesApi.getAll() : badgesApi.getAll(),
    staleTime: 300000,
  });
}

// Focus Sessions hooks
export function useFocusSessions() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.focusSessions,
    queryFn: () => isLocal ? localFocusSessionsApi.getAll() : focusSessionsApi.getAll(),
    staleTime: 30000,
  });
}

export function useFocusStats() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.focusStats,
    queryFn: () => isLocal ? localFocusSessionsApi.getStats() : focusSessionsApi.getStats(),
    staleTime: 30000,
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

// Challenges hooks
export function useChallenges() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: queryKeys.challenges,
    queryFn: () => isLocal ? localChallengesApi.getAll() : challengesApi.getAll(),
    staleTime: 60000,
  });
}

export function useUserChallenges() {
  const isLocal = useIsLocalMode();

  return useQuery({
    queryKey: [...queryKeys.challenges, 'user'],
    queryFn: () => isLocal ? localChallengesApi.getUserChallenges() : challengesApi.getUserChallenges(),
    staleTime: 30000,
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
    queryFn: () => isLocal ? localChallengesApi.getProgress(challengeId) : challengesApi.getProgress(challengeId),
    staleTime: 30000,
    enabled: !!challengeId,
  });
}

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
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// Helper to format date
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

// Helper to get today's date
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper to get all days in a month as date strings
export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push(date.toISOString().split('T')[0]);
  }

  return days;
}
