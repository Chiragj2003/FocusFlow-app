import { useTheme } from '@/lib/ThemeContext';
import type { Badge } from '@/lib/api';
import { getCurrentMonthRange, getToday, useBadges, useEntries, useHabits, useInsights, useStreaks } from '@/lib/hooks';
import { getDailyQuote, getStreakMessage } from '@/lib/quotes';
import type { HabitEntry, TopHabit } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Dummy locked badges for upcoming achievements
const DUMMY_BADGES = [
  { id: 'streak-7', name: 'Consistency King', description: 'Hit a 7-day streak', icon: 'flame', color: '#f97316' },
  { id: 'focus-10', name: 'Deep Focus', description: '10 hours of focus time', icon: 'time', color: '#3b82f6' },
  { id: 'master-100', name: 'Habit Master', description: 'Complete 100 entries', icon: 'star', color: '#a855f7' },
  { id: 'early-bird', name: 'Early Bird', description: 'Complete habit before 6 AM', icon: 'partly-sunny', color: '#eab308' },
  { id: 'weekend', name: 'Weekend Warrior', description: 'Weekend completions', icon: 'calendar', color: '#10b981' },
];

export default function DashboardScreen() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const today = getToday();

  // Fetch data using React Query hooks
  const { data: habits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useInsights();
  const { data: streaks, isLoading: streaksLoading, refetch: refetchStreaks } = useStreaks();
  const { data: badges, refetch: refetchBadges } = useBadges();
  const { data: entries, refetch: refetchEntries } = useEntries(today, today);

  const [refreshing, setRefreshing] = React.useState(false);

  const isLoading = habitsLoading || insightsLoading || streaksLoading;

  // Calculate today's completion
  const todayEntries = entries?.filter((e: HabitEntry) => e.entryDate === today && e.completed) || [];
  const todayCompleted = todayEntries.length;
  const todayTotal = habits?.length || 0;
  const completionPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // Get streak data
  const currentStreak = streaks?.currentStreak || 0;
  const bestStreak = streaks?.longestStreak || 0;

  // Get completion rate from insights
  const weeklyRate = insights ? Math.round(insights.overallCompletionRate * 100) : 0;
  const totalCompleted = insights?.totalCompleted || 0;

  // Get daily quote
  const quote = getDailyQuote();
  const streakMessage = getStreakMessage(currentStreak);

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Format today's date elegantly
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Clean username fallback
  const userName = isSignedIn
    ? (user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Champion')
    : 'Guest';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchHabits(),
      refetchInsights(),
      refetchStreaks(),
      refetchBadges(),
      refetchEntries(),
    ]);
    setRefreshing(false);
  }, [refetchHabits, refetchInsights, refetchStreaks, refetchBadges, refetchEntries]);

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted }} className="mt-4 font-semibold text-sm">
          Bundling your flow...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Visual background ambient accent (subtle dark mode premium glow) */}
      {isDark && (
        <View 
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none" 
          style={{ backgroundColor: colors.primary, top: -50, right: -50 }} 
        />
      )}

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-6 pb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text style={{ color: colors.textMuted }} className="text-xs uppercase tracking-widest font-black opacity-80">
                {formattedDate}
              </Text>
              <Text style={{ color: colors.text }} className="text-2xl font-black tracking-tight mt-0.5">
                {greeting}, {userName}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              className="w-11 h-11 rounded-2xl overflow-hidden items-center justify-center shadow-sm border active:scale-95 transition-transform"
              style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            >
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} className="w-full h-full" />
              ) : (
                <Ionicons name="person" size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Today's Focus Hero Card */}
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }} 
          className="rounded-3xl border p-6 shadow-sm mb-6"
        >
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1 pr-4">
              <Text style={{ color: colors.text }} className="text-lg font-black tracking-tight">Today's Focus</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs font-semibold mt-1">
                {todayCompleted} of {todayTotal} habits completed
              </Text>
            </View>
            <View className="px-3.5 py-1.5 rounded-2xl" style={{ backgroundColor: colors.primary + '15' }}>
              <Text style={{ color: colors.primary }} className="text-xl font-black">{completionPercentage}%</Text>
            </View>
          </View>

          {/* Minimalist Progress Track */}
          <View style={{ backgroundColor: colors.backgroundSecondary }} className="h-2 rounded-full overflow-hidden mb-6">
            <View
              style={{ 
                width: `${completionPercentage}%`,
                backgroundColor: colors.primary,
              }}
              className="h-full rounded-full"
            />
          </View>

          {/* Quick Stats Dashboard Metrics Row */}
          <View className="flex-row items-center justify-between bg-zinc-950/5 dark:bg-black/10 p-4 rounded-2xl border" style={{ borderColor: colors.border }}>
            {/* Streak Column */}
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="flame" size={18} color="#f97316" />
                <Text style={{ color: colors.text }} className="text-base font-black ml-1.5">{currentStreak}</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-[9px] font-bold uppercase tracking-wider">Streak</Text>
            </View>
            
            <View className="w-px h-8 self-center" style={{ backgroundColor: colors.border }} />
            
            {/* Completed Column */}
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={{ color: colors.text }} className="text-base font-black ml-1.5">{todayCompleted}</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-[9px] font-bold uppercase tracking-wider">Completed</Text>
            </View>
            
            <View className="w-px h-8 self-center" style={{ backgroundColor: colors.border }} />
            
            {/* Month Rate Column */}
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="trending-up" size={18} color={colors.info} />
                <Text style={{ color: colors.text }} className="text-base font-black ml-1.5">{weeklyRate}%</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-[9px] font-bold uppercase tracking-wider">Month Rate</Text>
            </View>
          </View>

          {/* Streak Banner integrated cleanly inside the card */}
          {currentStreak > 0 && (
            <View 
              style={{ backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }} 
              className="mt-4 p-4 rounded-2xl border flex-row items-start"
            >
              <Ionicons name="sparkles" size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.text }} className="text-xs font-black">
                  {currentStreak} Day Streak Active!
                </Text>
                <Text style={{ color: colors.textSecondary }} className="text-[11px] font-semibold mt-0.5 leading-relaxed">
                  {streakMessage}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View className="mb-6">
          <Text style={{ color: colors.text }} className="text-base font-black mb-3.5 px-1">Performance Overview</Text>
          <View className="flex-row flex-wrap justify-between">
            <StatsCard
              title="Active Habits"
              value={habits?.length || 0}
              subtitle="being tracked"
              icon="grid-outline"
              colors={colors}
              accentColor="#3b82f6"
            />
            <StatsCard
              title="Best Streak"
              value={bestStreak}
              subtitle="personal best"
              icon="trophy-outline"
              colors={colors}
              accentColor="#ea580c"
            />
            <StatsCard
              title="This Month"
              value={`${weeklyRate}%`}
              subtitle="completion rate"
              icon="stats-chart-outline"
              colors={colors}
              accentColor="#10b981"
            />
            <StatsCard
              title="Completed"
              value={totalCompleted}
              subtitle="total this month"
              icon="checkmark-done-outline"
              colors={colors}
              accentColor="#8b5cf6"
            />
          </View>
        </View>

        {/* Top Habits Section */}
        {insights?.topHabits && insights.topHabits.length > 0 && (
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }} 
            className="mb-6 rounded-3xl border p-5 shadow-sm"
          >
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text style={{ color: colors.text }} className="text-base font-black tracking-tight">Top Consistent Habits</Text>
                <Text style={{ color: colors.textMuted }} className="text-[11px] font-semibold mt-0.5">Your leading daily routines</Text>
              </View>
              <Pressable 
                onPress={() => router.push('/insights')}
                className="w-7 h-7 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
            {insights.topHabits.slice(0, 3).map((habit: TopHabit, index: number) => (
              <View
                key={habit.habitId}
                style={{ borderColor: colors.border }}
                className={`flex-row items-center py-3 ${index < 2 ? 'border-b' : ''}`}
              >
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: habit.color + '15' }}
                >
                  <Text className="font-black text-sm" style={{ color: habit.color || colors.primary }}>
                    #{index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="font-bold text-sm">{habit.title}</Text>
                  <View className="flex-row items-center mt-1.5">
                    <View style={{ backgroundColor: colors.backgroundTertiary }} className="flex-1 h-1.5 rounded-full mr-3">
                      <View
                        style={{
                          width: `${Math.round(habit.completionRate * 100)}%`,
                          backgroundColor: habit.color || colors.primary
                        }}
                        className="h-full rounded-full"
                      />
                    </View>
                    <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold w-10 text-right">
                      {Math.round(habit.completionRate * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Old Recent Achievements Removed */}

        {/* Quick Tools */}
        <View className="mb-6">
          <Text style={{ color: colors.text }} className="text-base font-black mb-3 px-1">Quick Tools</Text>
          <View className="flex-row justify-between">
            <QuickActionButton
              icon="add-circle"
              label="New Habit"
              onPress={() => router.push('/habits')}
              colors={colors}
            />
            <QuickActionButton
              icon="time"
              label="Focus Timer"
              onPress={() => router.push('/focus')}
              colors={colors}
            />
            <QuickActionButton
              icon="trophy"
              label="Badges"
              onPress={() => router.push('/badges')}
              colors={colors}
            />
            <QuickActionButton
              icon="star"
              label="Achievements"
              onPress={() => router.push('/achievements')}
              colors={colors}
            />
          </View>
        </View>

        {/* Quote Block */}
        <View className="mb-8 rounded-3xl overflow-hidden">
          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="p-5 rounded-3xl border flex-row items-start shadow-sm"
          >
            <View className="mr-3 mt-1 bg-orange-500/10 p-2 rounded-xl">
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.textSecondary }} className="text-[13px] font-bold italic leading-relaxed">
                "{quote.text}"
              </Text>
              <Text style={{ color: colors.primary }} className="text-[10px] mt-2.5 font-bold uppercase tracking-wider">
                — {quote.author}
              </Text>
            </View>
          </View>
        </View>

        {/* All Badges & Upcoming Achievements */}
        <View className="mb-10">
          <Text style={{ color: colors.text }} className="text-base font-black mb-3 px-1">Badges & Achievements</Text>
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }} 
            className="rounded-3xl border p-5 shadow-sm"
          >
            {/* Collected Badges */}
            {badges && badges.length > 0 && (
              <View className="mb-6">
                <Text style={{ color: colors.text }} className="text-sm font-bold mb-3">Collected ({badges.length})</Text>
                <View className="flex-row flex-wrap -mx-1.5">
                  {badges.map((badge: Badge, index: number) => (
                    <View key={`collected-${index}`} className="w-1/3 px-1.5 mb-3">
                      <View style={{ backgroundColor: colors.backgroundSecondary }} className="rounded-2xl p-3 items-center">
                        <View style={{ backgroundColor: '#fbbf2415' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-2">
                          <Ionicons name="trophy" size={20} color="#fbbf24" />
                        </View>
                        <Text style={{ color: colors.text }} className="text-[10px] font-bold text-center leading-4" numberOfLines={2}>
                          {badge.name}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Upcoming (Locked) Badges */}
            <View>
              <Text style={{ color: colors.textMuted }} className="text-sm font-bold mb-3">Upcoming Milestones</Text>
              <View className="flex-row flex-wrap -mx-1.5">
                {DUMMY_BADGES.map((badge, index) => (
                  <View key={`locked-${index}`} className="w-1/3 px-1.5 mb-3 opacity-50">
                    <View style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border }} className="rounded-2xl p-3 items-center border">
                      <View style={{ backgroundColor: isDark ? '#27272a' : '#f4f4f5' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-2">
                        <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                      </View>
                      <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold text-center leading-4" numberOfLines={2}>
                        {badge.name}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Redesigned Stats Card Component
function StatsCard({ title, value, subtitle, icon, colors, accentColor }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  colors: any;
  accentColor: string;
}) {
  return (
    <View className="w-[48%] mb-4">
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
        className="rounded-3xl p-5 border shadow-sm"
      >
        <View 
          style={{ backgroundColor: accentColor + '12' }} 
          className="w-10 h-10 rounded-2xl items-center justify-center mb-4"
        >
          <Ionicons name={icon as any} size={20} color={accentColor} />
        </View>
        <View>
          <Text style={{ color: colors.text }} className="text-2xl font-black tracking-tight">{value}</Text>
          <Text style={{ color: colors.textSecondary }} className="text-xs font-bold mt-1.5">{title}</Text>
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium mt-0.5">{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

// Redesigned Quick Action Button Component
function QuickActionButton({ icon, label, onPress, colors }: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable 
      className="items-center flex-1 mx-1 active:scale-95 active:opacity-80 transition-all" 
      onPress={onPress}
    >
      <View
        style={{ 
          backgroundColor: colors.surface,
          borderColor: colors.border,
          maxWidth: 70,
        }}
        className="w-full aspect-square rounded-2xl items-center justify-center mb-2.5 border shadow-sm"
      >
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <Text style={{ color: colors.textSecondary }} className="text-[10px] font-bold text-center mt-0.5">{label}</Text>
    </Pressable>
  );
}
