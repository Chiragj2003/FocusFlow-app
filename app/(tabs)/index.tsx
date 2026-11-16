import { FlameMark } from '@/components/ui/FlameMark';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mascot, MascotMood } from '@/components/ui/Mascot';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { Badge } from '@/lib/api';
import { StreakFlame } from '@/components/ui/StreakFlame';
import { celebrate, toast } from '@/lib/celebrate';
import { getToday, useAwardBadge, useBadges, useEntries, useHabits, useInsights, useStreaks, useToggleEntry } from '@/lib/hooks';
import { messages } from '@/lib/messages';
import { getDailyQuote } from '@/lib/quotes';
import { useTheme } from '@/lib/ThemeContext';
import type { Habit, HabitEntry } from '@/lib/types';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;

// Milestones to unlock (ids are what the server stores)
const AVAILABLE_BADGES = [
  { id: 'first_habit', name: 'First Habit', description: 'You created your first habit', streak: 0, check: (s: any, i: any, h: any) => (h?.length || 0) >= 1 },
  { id: 'first_completion', name: 'First Step', description: 'You completed your first habit', streak: 0, check: (s: any, i: any) => (i?.totalCompleted || 0) >= 1 },
  { id: '3_day_streak', name: '3 Day Streak', description: 'Three days in a row', streak: 3, check: (s: any) => (s?.longestStreak || 0) >= 3 },
  { id: 'week_warrior', name: 'Week Warrior', description: 'A full 7-day streak', streak: 7, check: (s: any) => (s?.longestStreak || 0) >= 7 },
  { id: '10_day_streak', name: 'Double Digits', description: 'A 10-day streak', streak: 10, check: (s: any) => (s?.longestStreak || 0) >= 10 },
  { id: 'two_week_titan', name: 'Two Week Titan', description: 'A 14-day streak', streak: 14, check: (s: any) => (s?.longestStreak || 0) >= 14 },
  { id: '21_day_streak', name: 'Habit Former', description: 'A 21-day streak', streak: 21, check: (s: any) => (s?.longestStreak || 0) >= 21 },
  { id: 'monthly_master', name: 'Monthly Master', description: 'A 30-day streak', streak: 30, check: (s: any) => (s?.longestStreak || 0) >= 30 },
  { id: '10_completions', name: '10 Completions', description: '10 habits completed', streak: 0, check: (s: any, i: any) => (i?.totalCompleted || 0) >= 10 },
  { id: '25_completions', name: '25 Completions', description: '25 habits completed', streak: 0, check: (s: any, i: any) => (i?.totalCompleted || 0) >= 25 },
  { id: '50_completions', name: 'Half Century', description: '50 habits completed', streak: 0, check: (s: any, i: any) => (i?.totalCompleted || 0) >= 50 },
  { id: 'century_club', name: 'Century Club', description: '100 habits completed', streak: 0, check: (s: any, i: any) => (i?.totalCompleted || 0) >= 100 },
  { id: 'all_habits_completed', name: 'Flawless Day', description: 'Every habit done in one day', streak: 0, check: (s: any, i: any, h: any, done: number, total: number) => total > 0 && done === total },
];

const CATEGORY_ICONS: Record<string, IconName> = {
  health: 'heart',
  fitness: 'barbell',
  learning: 'book',
  mindfulness: 'flower',
  productivity: 'laptop',
  social: 'people',
  creative: 'color-palette',
};

const KEYWORD_ICONS: [RegExp, IconName][] = [
  [/water|drink|hydrat/i, 'water'],
  [/sleep|bed|rest/i, 'moon'],
  [/read|book/i, 'book'],
  [/walk|step|run/i, 'walk'],
  [/gym|workout|exercise|push|lift/i, 'barbell'],
  [/medita|breath|mind/i, 'flower'],
  [/code|work|focus|study/i, 'laptop'],
  [/food|eat|junk|diet|fruit|veg/i, 'nutrition'],
  [/journal|write/i, 'create'],
];

function habitIcon(h: Habit): IconName {
  for (const [re, icon] of KEYWORD_ICONS) if (re.test(h.title)) return icon;
  return CATEGORY_ICONS[(h.category || '').toLowerCase()] ?? 'sparkles';
}

export default function DashboardScreen() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const today = getToday();

  const { data: habits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: insights, refetch: refetchInsights } = useInsights();
  const { data: streaks, refetch: refetchStreaks } = useStreaks();
  const { data: badges, refetch: refetchBadges } = useBadges();
  const { data: entries, refetch: refetchEntries } = useEntries(today, today);
  const awardBadgeMutation = useAwardBadge();
  const toggleEntry = useToggleEntry();
  const processingBadges = React.useRef(new Set<string>());
  const [refreshing, setRefreshing] = React.useState(false);

  const activeHabits = useMemo(() => (habits || []).filter((h: Habit) => h.active !== false), [habits]);
  const todayTotal = activeHabits.length;

  const doneToday = useMemo(() => {
    const ids = new Set(
      (entries || [])
        .filter((e: HabitEntry) => e.completed && e.entryDate.split('T')[0] === today)
        .map((e: HabitEntry) => e.habitId)
    );
    return ids;
  }, [entries, today]);

  const todayCompleted = activeHabits.filter((h: Habit) => doneToday.has(h.id)).length;
  const progress = todayTotal > 0 ? todayCompleted / todayTotal : 0;

  const streakByHabit = useMemo(() => {
    const map = new Map<string, number>();
    (streaks?.streaksByHabit || []).forEach((s: any) => map.set(s.habitId, s.currentStreak || 0));
    return map;
  }, [streaks]);

  // Evaluate badge unlocks and celebrate new ones
  React.useEffect(() => {
    if (!badges || !streaks || !insights || !habits || habits.length === 0) return;
    const collected = new Set(badges.map((b: Badge) => b.name));

    AVAILABLE_BADGES.forEach((badge) => {
      const earned = collected.has(badge.id) || collected.has(badge.name);
      if (earned || processingBadges.current.has(badge.id)) return;
      if (!badge.check(streaks, insights, habits, todayCompleted, todayTotal)) return;

      processingBadges.current.add(badge.id);
      awardBadgeMutation.mutate(
        { name: badge.id, metadata: { displayName: badge.name, description: badge.description } },
        {
          onSuccess: () => {
            // Streak days already get the big streak screen; just note the badge.
            if (badge.streak > 0) {
              toast(`🏅 Badge earned: ${badge.name}`);
              return;
            }
            celebrate({
              title: 'Badge unlocked!',
              message: messages.badge(badge.description),
              mood: 'celebrate',
              highlight: badge.name,
              highlightIcon: 'trophy',
            });
          },
          onError: (err) => console.warn('[Home] Badge award stored locally:', err?.message),
        }
      );
    });
  }, [streaks, insights, badges, habits, todayCompleted, todayTotal]);

  const currentStreak = todayTotal > 0 ? streaks?.currentStreak || 0 : 0;
  const monthRate = todayTotal > 0 && insights ? Math.round(insights.overallCompletionRate * 100) : 0;
  const quote = getDailyQuote();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const mood: MascotMood =
    todayTotal > 0 && todayCompleted >= todayTotal
      ? 'celebrate'
      : hour >= 22 || hour < 5
        ? 'sleeping'
        : hour >= 18 && todayTotal > 0 && todayCompleted === 0
          ? 'sad' // evening, nothing done yet: Sparky misses you
          : currentStreak >= 3
            ? 'streak'
            : 'happy';
  const userName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'friend';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHabits(), refetchInsights(), refetchStreaks(), refetchBadges(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchHabits, refetchInsights, refetchStreaks, refetchBadges, refetchEntries]);

  const toggle = (habit: Habit) => {
    const completed = !doneToday.has(habit.id);
    Haptics.impactAsync(completed ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleEntry.mutate({ habitId: habit.id, entryDate: today, completed });
  };

  if (habitsLoading && !habits && !refreshing) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const card = { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 } as const;
  const dots = activeHabits.slice(0, 7);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <FlameMark size={30} />
          <Text style={{ fontSize: 20, fontWeight: '800', marginLeft: 6, letterSpacing: -0.3, color: colors.text }}>
            Focus<Text style={{ color: colors.primary }}>Flow</Text>
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={{ ...card, width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
          >
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 14 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34 }}>
              {greeting},{'\n'}
              {userName} 👋
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6 }}>{messages.greetingLine(todayCompleted, todayTotal)}</Text>
          </View>
          <Mascot mood={mood} size={112} />
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {[
            { icon: 'flame' as IconName, value: `${currentStreak}`, label: 'Day streak' },
            { icon: 'checkmark-circle' as IconName, value: `${todayCompleted}/${todayTotal}`, label: 'Today' },
            { icon: 'bar-chart' as IconName, value: `${monthRate}%`, label: 'This month' },
          ].map((s) => (
            <View key={s.label} style={{ ...card, flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12 }}>
              {s.icon === 'flame' ? (
                <StreakFlame days={currentStreak} size={24} />
              ) : (
                <Ionicons name={s.icon} size={20} color={colors.primary} />
              )}
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 6 }}>{s.value}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Today's progress (signature: the ring glows brighter as the day fills up) */}
        {todayTotal > 0 && (
          <View style={{ ...card, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Today’s progress</Text>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                {todayCompleted} of {todayTotal} habits
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {dots.map((h: Habit) => {
                  const done = doneToday.has(h.id);
                  return (
                    <View
                      key={h.id}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: done ? colors.primary : colors.backgroundSecondary,
                      }}
                    >
                      {done && <Ionicons name="checkmark" size={15} color="#ffffff" />}
                    </View>
                  );
                })}
                {activeHabits.length > dots.length && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, alignSelf: 'center' }}>+{activeHabits.length - dots.length}</Text>
                )}
              </View>
            </View>
            <View
              style={{
                borderRadius: 50,
                shadowColor: '#f97316',
                shadowOpacity: isDark ? 0.15 + progress * 0.45 : 0.1 + progress * 0.2,
                shadowRadius: 10 + progress * 20,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <ProgressRing size={96} strokeWidth={10} progress={progress} trackColor={colors.backgroundSecondary}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{Math.round(progress * 100)}%</Text>
              </ProgressRing>
            </View>
          </View>
        )}

        {/* Your habits */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>Your habits</Text>
          <GradientButton label="Add habit" icon="add" size="sm" onPress={() => router.push('/habits')} />
        </View>

        {activeHabits.length === 0 ? (
          <View style={{ ...card, borderRadius: 24, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, marginBottom: 22 }}>
            <Mascot mood="sleeping" size={130} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>No habits yet</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 6 }}>Add one small habit to light your first spark.</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 22 }}>
            {activeHabits.map((habit: Habit) => {
              const done = doneToday.has(habit.id);
              const streak = streakByHabit.get(habit.id) || 0;
              const color = habit.color || colors.primary;
              return (
                <Pressable
                  key={habit.id}
                  onPress={() => toggle(habit)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`${habit.title}${streak ? `, ${streak} day streak` : ''}`}
                  style={({ pressed }) => ({
                    ...card,
                    borderRadius: 20,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}22`, marginRight: 12 }}>
                    <Ionicons name={habitIcon(habit)} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: done ? colors.textMuted : colors.text, fontSize: 16, fontWeight: '700', textDecorationLine: done ? 'line-through' : 'none' }}
                      numberOfLines={1}
                    >
                      {habit.title}
                    </Text>
                    {streak > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <StreakFlame days={streak} size={15} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 3 }}>{streak} day streak</Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done ? colors.primary : 'transparent',
                      borderWidth: done ? 0 : 2,
                      borderColor: colors.borderSecondary,
                    }}
                  >
                    {done && <Ionicons name="checkmark" size={18} color="#ffffff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Quote */}
        <View style={{ ...card, borderRadius: 24, padding: 18, flexDirection: 'row', marginBottom: 22 }}>
          <Ionicons name="sparkles" size={18} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, fontStyle: 'italic' }}>“{quote.text}”</Text>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 8 }}>{quote.author}</Text>
          </View>
        </View>

        {/* Badges */}
        <Pressable
          onPress={() => router.push('/badges')}
          accessibilityRole="button"
          accessibilityLabel="See all badges"
          style={{ ...card, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginRight: 12 }}>
            <Ionicons name="trophy" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Badges</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {AVAILABLE_BADGES.filter((b) => badges?.some((c: Badge) => c.name === b.id || c.name === b.name)).length} of {AVAILABLE_BADGES.length} unlocked
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
