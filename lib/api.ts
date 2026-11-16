import axios, { AxiosInstance } from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Configure your API base URL - connects to your deployed FocusFlow website
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://focus-flow-web-weld.vercel.app';

// Token getter function - will be set by the app when Clerk loads
let getAuthToken: ((options?: { skipCache?: boolean }) => Promise<string | null>) | null = null;
// Cache token to avoid repeated async calls
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export const setAuthTokenGetter = (getter: (options?: { skipCache?: boolean }) => Promise<string | null>) => {
  getAuthToken = getter;
  // Reset cache when getter changes
  cachedToken = null;
  tokenExpiry = 0;
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Request Interceptor: Handles offline checks, auth tokens, and request logging
api.interceptors.request.use(async (config) => {
  // 1. Fast fail if offline
  const netInfo = await NetInfo.fetch();
  if (netInfo.isConnected === false) {
    return Promise.reject(new Error('Network Error: Offline. Please check your internet connection.'));
  }

  const hasGetter = !!getAuthToken;
  let hasToken = false;

  // 2. Attach Authorization header.
  // Ask Clerk on every request: getToken() keeps its own cache and refreshes the
  // short-lived (~60s) session token before it expires. Our old 4-minute cache
  // outlived the token and caused a 401 + retry on most requests.
  if (getAuthToken) {
    try {
      cachedToken = await getAuthToken();
    } catch (err) {
      console.warn('[API Request] Failed to retrieve Clerk token:', err);
    }
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
      hasToken = true;
    }
  }

  // 3. Log request details
  console.log(`[API Request] URL: ${config.url} | Method: ${config.method?.toUpperCase()} | AuthGetter: ${hasGetter} | TokenPresent: ${hasToken}`);
  return config;
});

// Response Interceptor: Handles logging, 401 token refresh retries, and GET request retries
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] URL: ${response.config.url} | Method: ${response.config.method?.toUpperCase()} | Status: ${response.status} | AuthStatus: Success`);
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    console.warn(`[API Error] URL: ${config?.url} | Method: ${config?.method?.toUpperCase()} | Status: ${status || 'Network/Timeout Error'} | Message: ${error.message} | AuthStatus: ${status === 401 ? 'Unauthorized' : 'Error'}`);

    // Handle 401 Unauthorized errors - refresh token and retry immediately
    if (status === 401 && config && !config._is401Retry) {
      config._is401Retry = true;
      cachedToken = null;
      tokenExpiry = 0;

      console.log(`[API] 401 Unauthorized detected for ${config.url}. Refreshing token and retrying...`);

      if (getAuthToken) {
        try {
          const token = await getAuthToken({ skipCache: true });
          if (token) {
            cachedToken = token;
            tokenExpiry = Date.now() + 4 * 60 * 1000;
            config.headers.Authorization = `Bearer ${token}`;
            console.log(`[API] Token refreshed. Retrying request to ${config.url} with new token.`);
            return api(config);
          }
        } catch (refreshError) {
          console.error(`[API] Token refresh failed during 401 retry:`, refreshError);
        }
      }
    }

    // Clear token cache on any 401 that wasn't successfully resolved
    if (status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
    }

    // Fallback: Simple retry logic for failed GET requests (non-401 errors)
    if (config && config.method && config.method.toLowerCase() === 'get' && status !== 401) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 1) {
        config.__retryCount += 1;
        console.log(`[API Retry] Retrying GET request to ${config.url} (Attempt ${config.__retryCount})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s backoff
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

// Types
export interface Habit {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string | null;
  color: string;
  goalType: 'binary' | 'duration' | 'quantity';
  goalTarget: number | null;
  unit: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  userId: string;
  entryDate: string;
  completed: boolean;
  value: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsightsSummary {
  overallCompletionRate: number;
  totalCompleted: number;
  totalPossible: number;
  topHabits: Array<{
    habitId: string;
    title: string;
    color: string;
    completionRate: number;
    completedCount: number;
    totalDays: number;
  }>;
  weekly: Array<{
    day: string;
    date: string;
    completed: number;
    total: number;
    rate: number;
  }>;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streaksByHabit: Array<{
    habitId: string;
    title: string;
    currentStreak: number;
    longestStreak: number;
  }>;
}

export interface Badge {
  name: string;
  awardedAt: string;
}

// Focus Session Types
export interface FocusSession {
  id: string;
  userId: string;
  habitId: string | null;
  duration: number; // in seconds
  completedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface FocusStats {
  totalSessions: number;
  totalMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  averageSessionLength: number;
  longestSession: number;
}

// Challenge Types
export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'streak' | 'completion' | 'focus' | 'quantity';
  target: number;
  duration: number; // in days
  startDate: string;
  endDate: string;
  reward: number; // XP points
  active: boolean;
}

export interface UserChallenge {
  id: string;
  challengeId: string;
  userId: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  joinedAt: string;
  challenge: Challenge;
}

// Habits API
export const habitsApi = {
  getAll: async (active?: boolean) => {
    const params = new URLSearchParams();
    if (active !== undefined) {
      params.set('active', String(active));
    }
    const response = await api.get<Habit[]>(`/api/habits?${params.toString()}`);
    return response.data;
  },

  create: async (habit: {
    title: string;
    description?: string;
    color?: string;
    category?: string;
    goalType: 'binary' | 'duration' | 'quantity';
    goalTarget?: number;
    unit?: string;
  }) => {
    const response = await api.post<Habit>('/api/habits', habit);
    return response.data;
  },

  // AI-powered habit generation
  generateWithAI: async (prompt: string) => {
    const response = await api.post('/api/habits/ai-generate', { prompt });
    const data = response.data;
    
    // The web API returns a single habit object, normalize to array format
    if (data && !data.habits) {
      // Single habit response - wrap in array
      return {
        habits: [data],
        source: 'ai' as const,
      };
    }
    
    // Already in array format
    return data as {
      habits: Array<{
        title: string;
        description: string;
        category: string;
        color: string;
        goalType: 'binary' | 'duration' | 'quantity';
        goalTarget?: number;
        unit?: string;
      }>;
      source: 'ai' | 'fallback';
    };
  },

  update: async (id: string, data: Partial<{
    title: string;
    description: string;
    color: string;
    category: string;
    active: boolean;
    goalType: 'binary' | 'duration' | 'quantity';
    goalTarget: number;
    unit: string;
  }>) => {
    const response = await api.patch<Habit>(`/api/habits/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/habits/${id}`);
    return response.data;
  },

  archive: async (id: string) => {
    const response = await api.patch<Habit>(`/api/habits/${id}`, { active: false });
    return response.data;
  },

  restore: async (id: string) => {
    const response = await api.patch<Habit>(`/api/habits/${id}`, { active: true });
    return response.data;
  },
};

// Entries API
export const entriesApi = {
  getByDateRange: async (startDate: string, endDate: string) => {
    const response = await api.get<HabitEntry[]>('/api/entries', {
      params: { start: startDate, end: endDate }
    });
    return response.data;
  },

  toggle: async (habitId: string, entryDate: string, completed: boolean, value?: number, notes?: string) => {
    const response = await api.post<HabitEntry>('/api/entries', {
      habitId,
      entryDate,
      completed,
      value,
      notes,
    });
    return response.data;
  },

  update: async (id: string, data: { completed?: boolean; value?: number; notes?: string }) => {
    const response = await api.patch<HabitEntry>(`/api/entries/${id}`, data);
    return response.data;
  },
};

// Insights API
export const insightsApi = {
  getSummary: async () => {
    const response = await api.get<InsightsSummary>('/api/insights/summary');
    return response.data;
  },

  getStreaks: async () => {
    const response = await api.get<StreakData>('/api/insights/streaks');
    return response.data;
  },
};

// Badges API
export const badgesApi = {
  getAll: async () => {
    const response = await api.get<Badge[]>('/api/badges');
    return response.data;
  },
  awardBadge: async (name: string, metadata?: Record<string, any>) => {
    const response = await api.post<Badge>('/api/badges', { name, metadata });
    return response.data;
  },
};

// Focus Sessions API
export const focusSessionsApi = {
  getAll: async () => {
    const response = await api.get<FocusSession[]>('/api/focus');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get<FocusStats>('/api/focus/stats');
    return response.data;
  },

  create: async (session: {
    habitId?: string;
    duration: number;
    notes?: string;
    completedAt?: string;
  }) => {
    const response = await api.post<FocusSession>('/api/focus', session);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/focus/${id}`);
    return response.data;
  },
};

// Challenges API
export const challengesApi = {
  getAll: async () => {
    const response = await api.get<Challenge[]>('/api/challenges');
    return response.data;
  },

  getUserChallenges: async () => {
    const response = await api.get<UserChallenge[]>('/api/challenges/user');
    return response.data;
  },

  join: async (challengeId: string) => {
    const response = await api.post<UserChallenge>('/api/challenges/join', { challengeId });
    return response.data;
  },

  getProgress: async (challengeId: string) => {
    const response = await api.get<{ progress: number; completed: boolean }>(`/api/challenges/${challengeId}/progress`);
    return response.data;
  },
};

export default api;
