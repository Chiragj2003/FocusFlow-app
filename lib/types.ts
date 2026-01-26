// Habit and Entry types - matching the web app
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

export interface HabitWithEntries extends Habit {
  entries: HabitEntry[];
}

// API Request/Response types
export interface CreateHabitRequest {
  title: string;
  description?: string;
  category?: string;
  color?: string;
  goalType: 'binary' | 'duration' | 'quantity';
  goalTarget?: number;
  unit?: string;
}

export interface UpdateHabitRequest {
  title?: string;
  description?: string;
  category?: string;
  color?: string;
  goalType?: 'binary' | 'duration' | 'quantity';
  goalTarget?: number;
  unit?: string;
  active?: boolean;
}

export interface UpsertEntryRequest {
  habitId: string;
  entryDate: string;
  completed: boolean;
  value?: number;
  notes?: string;
}

export interface UpdateEntryRequest {
  completed?: boolean;
  value?: number;
  notes?: string;
}

// Analytics types
export interface DailySummary {
  date: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}

export interface MonthlyData {
  month: string;
  year: number;
  days: DailySummary[];
  overallRate: number;
}

export interface InsightsSummary {
  overallCompletionRate: number;
  totalCompleted: number;
  totalPossible: number;
  topHabits: TopHabit[];
  weekly: WeeklyData[];
}

export interface TopHabit {
  habitId: string;
  title: string;
  color: string;
  completionRate: number;
  completedCount: number;
  totalDays: number;
}

export interface WeeklyData {
  day: string;
  date: string;
  completed: number;
  total: number;
  rate: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streaksByHabit: HabitStreak[];
}

export interface HabitStreak {
  habitId: string;
  title: string;
  currentStreak: number;
  longestStreak: number;
}

// Chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface LineChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Badge types
export interface Badge {
  id: string;
  userId: string;
  name: string;
  metadata?: Record<string, unknown>;
  awardedAt: string;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: 'streak' | 'completion' | 'milestone' | 'special';
  requirement: number;
}

// Quote type
export interface Quote {
  text: string;
  author: string;
}

// Streak message type
export interface StreakMessage {
  minStreak: number;
  maxStreak: number;
  messages: string[];
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  notifications: boolean;
}

// Grid types for the habit tracker view
export interface GridCell {
  habitId: string;
  date: string;
  entry?: HabitEntry;
  isToday: boolean;
  isFuture: boolean;
}

export interface HabitRow {
  habit: Habit;
  cells: GridCell[];
  weeklyTotal: number;
  monthlyTotal: number;
}

// Habit template type
export interface HabitTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  goalType: 'binary' | 'duration' | 'quantity';
  goalTarget?: number;
  unit?: string;
  icon: string;
}

// Dashboard data
export interface DashboardData {
  userName: string;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  habitsCount: number;
  todayCompleted: number;
  todayTotal: number;
  insights: InsightsSummary;
  dailyData: { date: string; value: number }[];
  badges: Badge[];
  quote: Quote;
}
