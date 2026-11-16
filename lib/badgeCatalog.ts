import type { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';

/**
 * The one list of badges, shared by Home (awarding) and the Badges screen (display).
 * `id` is what the server stores.
 */
export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  /** Streak length for streak badges, 0 otherwise */
  streak: number;
  group: 'Streaks' | 'Completions' | 'Milestones';
  icon: keyof typeof Ionicons.glyphMap;
  check: (streaks: any, insights: any, habits: any, done: number, total: number) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_habit', name: 'First Habit', description: 'Create your first habit', streak: 0, group: 'Milestones', icon: 'sparkles', check: (s, i, h) => (h?.length || 0) >= 1 },
  { id: 'first_completion', name: 'First Step', description: 'Complete your first habit', streak: 0, group: 'Milestones', icon: 'footsteps', check: (s, i) => (i?.totalCompleted || 0) >= 1 },
  { id: 'all_habits_completed', name: 'Flawless Day', description: 'Finish every habit in one day', streak: 0, group: 'Milestones', icon: 'star', check: (s, i, h, done, total) => total > 0 && done === total },
  { id: '3_day_streak', name: '3 Day Streak', description: 'Show up 3 days in a row', streak: 3, group: 'Streaks', icon: 'flame', check: (s) => (s?.longestStreak || 0) >= 3 },
  { id: 'week_warrior', name: 'Week Warrior', description: 'Keep a 7-day streak', streak: 7, group: 'Streaks', icon: 'flame', check: (s) => (s?.longestStreak || 0) >= 7 },
  { id: '10_day_streak', name: 'Double Digits', description: 'Keep a 10-day streak', streak: 10, group: 'Streaks', icon: 'flame', check: (s) => (s?.longestStreak || 0) >= 10 },
  { id: 'two_week_titan', name: 'Two Week Titan', description: 'Keep a 14-day streak', streak: 14, group: 'Streaks', icon: 'flame', check: (s) => (s?.longestStreak || 0) >= 14 },
  { id: '21_day_streak', name: 'Habit Former', description: 'Keep a 21-day streak', streak: 21, group: 'Streaks', icon: 'leaf', check: (s) => (s?.longestStreak || 0) >= 21 },
  { id: 'monthly_master', name: 'Monthly Master', description: 'Keep a 30-day streak', streak: 30, group: 'Streaks', icon: 'trophy', check: (s) => (s?.longestStreak || 0) >= 30 },
  { id: '10_completions', name: '10 Completions', description: 'Complete 10 habits', streak: 0, group: 'Completions', icon: 'checkmark-done', check: (s, i) => (i?.totalCompleted || 0) >= 10 },
  { id: '25_completions', name: '25 Completions', description: 'Complete 25 habits', streak: 0, group: 'Completions', icon: 'checkmark-done', check: (s, i) => (i?.totalCompleted || 0) >= 25 },
  { id: '50_completions', name: 'Half Century', description: 'Complete 50 habits', streak: 0, group: 'Completions', icon: 'medal', check: (s, i) => (i?.totalCompleted || 0) >= 50 },
  { id: 'century_club', name: 'Century Club', description: 'Complete 100 habits', streak: 0, group: 'Completions', icon: 'diamond', check: (s, i) => (i?.totalCompleted || 0) >= 100 },
];

// Older badge names the server may still hold, mapped to current ids
const LEGACY_NAMES: Record<string, string> = {
  'First Habit': 'first_habit',
  '3 Day Streak': '3_day_streak',
  'Week Warrior': 'week_warrior',
  'Monthly Master': 'monthly_master',
  '10 Completions': '10_completions',
  '50 Completions': '50_completions',
  'Century Club': 'century_club',
  'Consistency King': 'week_warrior',
  'Habit Master': 'century_club',
};

/** Server badge record (name + awardedAt) for a badge, if earned. */
export function findEarned(earned: { name: string; awardedAt?: string }[] | undefined, badge: BadgeDef) {
  return (earned || []).find((b) => b.name === badge.id || b.name === badge.name || LEGACY_NAMES[b.name] === badge.id);
}

/**
 * Drop-in slot for custom badge art (see the Antigravity prompts):
 *   first_habit: { earned: require('@/assets/badges/first_habit.png'), locked: require('@/assets/badges/first_habit-locked.png') },
 * Badges without art fall back to an icon tile.
 */
export const BADGE_ART: Partial<Record<string, { earned: ImageSourcePropType; locked?: ImageSourcePropType }>> = {
  "first_habit": { earned: require('@/assets/art/badges/first_habit.png'), locked: require('@/assets/art/badges/first_habit-locked.png') },
  "first_completion": { earned: require('@/assets/art/badges/first_completion.png'), locked: require('@/assets/art/badges/first_completion-locked.png') },
  "all_habits_completed": { earned: require('@/assets/art/badges/all_habits_completed.png'), locked: require('@/assets/art/badges/all_habits_completed-locked.png') },
  "3_day_streak": { earned: require('@/assets/art/badges/3_day_streak.png'), locked: require('@/assets/art/badges/3_day_streak-locked.png') },
  "week_warrior": { earned: require('@/assets/art/badges/week_warrior.png'), locked: require('@/assets/art/badges/week_warrior-locked.png') },
  "10_day_streak": { earned: require('@/assets/art/badges/10_day_streak.png'), locked: require('@/assets/art/badges/10_day_streak-locked.png') },
  "two_week_titan": { earned: require('@/assets/art/badges/two_week_titan.png'), locked: require('@/assets/art/badges/two_week_titan-locked.png') },
  "21_day_streak": { earned: require('@/assets/art/badges/21_day_streak.png'), locked: require('@/assets/art/badges/21_day_streak-locked.png') },
  "monthly_master": { earned: require('@/assets/art/badges/monthly_master.png'), locked: require('@/assets/art/badges/monthly_master-locked.png') },
  "10_completions": { earned: require('@/assets/art/badges/10_completions.png'), locked: require('@/assets/art/badges/10_completions-locked.png') },
  "25_completions": { earned: require('@/assets/art/badges/25_completions.png'), locked: require('@/assets/art/badges/25_completions-locked.png') },
  "50_completions": { earned: require('@/assets/art/badges/50_completions.png'), locked: require('@/assets/art/badges/50_completions-locked.png') },
  "century_club": { earned: require('@/assets/art/badges/century_club.png'), locked: require('@/assets/art/badges/century_club-locked.png') },
};
