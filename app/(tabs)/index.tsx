import { FlameMark } from '@/components/ui/FlameMark';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mascot, MascotMood } from '@/components/ui/Mascot';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { Badge } from '@/lib/api';
import { StreakFlame } from '@/components/ui/StreakFlame';
import { Tap } from '@/components/ui/Tap';
import { BADGES as AVAILABLE_BADGES, findEarned } from '@/lib/badgeCatalog';
import { celebrate, toast } from '@/lib/celebrate';
import { getToday, useAwardBadge, useBadges, useEntries, useHabits, useInsights, useStreaks, useToggleEntry } from '@/lib/hooks';
import { habitArt } from '@/lib/habitArt';
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
    AVAILABLE_BADGES.forEach((badge) => {
      // Same matching as the Badges screen (ids, names and legacy names)
      if (findEarned(badges, badge) || processingBadges.current.has(badge.id)) return;
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
                        backgroundColor: done ? colors.primary : 'transparent',
                        borderWidth: done ? 0 : 2,
                        borderColor: colors.borderSecondary,
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
                <Tap
                  key={habit.id}
                  onPress={() => toggle(habit)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`${habit.title}${streak ? `, ${streak} day streak` : ''}`}
                  style={{
                    ...card,
                    borderRadius: 20,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}22`, marginRight: 12 }}>
                    <Image source={habitArt(habit)} style={{ width: 32, height: 32 }} resizeMode="contain" />
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
                </Tap>
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

        {/* Badges + Challenges */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            {
              key: 'badges',
              href: '/badges' as const,
              icon: 'trophy' as IconName,
              title: 'Badges',
              subtitle: `${AVAILABLE_BADGES.filter((b) => findEarned(badges, b)).length} of ${AVAILABLE_BADGES.length} earned`,
            },
            {
              key: 'challenges',
              href: '/achievements' as const,
              icon: 'flag' as IconName,
              title: 'Challenges',
              subtitle: 'Join one, earn XP',
            },
          ].map((item) => (
            <Tap
              key={item.key}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}: ${item.subtitle}`}
              style={{ ...card, flex: 1, borderRadius: 24, padding: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
                  <Ionicons name={item.icon} size={22} color={colors.primary} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 12 }}>{item.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.subtitle}</Text>
            </Tap>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
