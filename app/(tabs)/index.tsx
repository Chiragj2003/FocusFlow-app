import { useTheme } from '@/lib/ThemeContext';
import type { Badge } from '@/lib/api';
import { getCurrentMonthRange, getToday, useBadges, useEntries, useHabits, useInsights, useStreaks } from '@/lib/hooks';
import { getDailyQuote, getStreakMessage } from '@/lib/quotes';
import type { HabitEntry, TopHabit } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const { start, end } = getCurrentMonthRange();
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
        <Text style={{ color: colors.textMuted }} className="mt-4">Loading your dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 pb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1">
              <Text style={{ color: colors.text }} className="text-3xl font-bold">
                FocusFlow
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-1 text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="px-3 py-2 rounded-xl border flex-row items-center"
                onPress={() => router.push('/badges')}
              >
                <Ionicons name="trophy-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.text }} className="font-semibold ml-1">{badges?.length || 0}</Text>
              </Pressable>
              <Pressable 
                style={{ backgroundColor: colors.primary }}
                className="px-4 py-2 rounded-xl flex-row items-center shadow-sm"
                onPress={() => router.push('/habits')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text className="text-white font-bold ml-1">New</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Streak Banner */}
        {currentStreak > 0 && (
          <View className="mb-4 rounded-2xl overflow-hidden shadow-sm">
            <LinearGradient
              colors={isDark ? ['#fb923c', '#f97316'] : ['#fed7aa', '#fdba74']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-white/20 p-3 rounded-2xl mr-3">
                    <Ionicons name="flame" size={32} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-2xl font-bold">{currentStreak} Day Streak!</Text>
                    <Text className="text-white/90 text-sm mt-0.5">{streakMessage}</Text>
                  </View>
                </View>
                {bestStreak > currentStreak && (
                  <View className="bg-white/20 px-3 py-2 rounded-xl">
                    <Text className="text-white/80 text-xs font-medium">Best: {bestStreak}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Today's Progress Card */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-2xl border p-5 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text style={{ color: colors.text }} className="text-lg font-bold">Today's Progress</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">
                {todayCompleted} of {todayTotal} habits completed
              </Text>
            </View>
            <View className="bg-gradient-to-br p-3 rounded-2xl" style={{ backgroundColor: colors.primary + '20' }}>
              <Text style={{ color: colors.primary }} className="text-2xl font-bold">{completionPercentage}%</Text>
            </View>
          </View>
          
          <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-3 rounded-full overflow-hidden mb-4">
            <View 
              style={{ width: `${completionPercentage}%`, backgroundColor: colors.primary }}
              className="h-full rounded-full"
            />
          </View>

          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="flame" size={18} color="#fb923c" />
                <Text style={{ color: colors.text }} className="text-xl font-bold ml-1">{currentStreak}</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs">Day Streak</Text>
            </View>
            <View className="w-px h-12" style={{ backgroundColor: colors.border }} />
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={{ color: colors.text }} className="text-xl font-bold ml-1">{totalCompleted}</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs">Completed</Text>
            </View>
            <View className="w-px h-12" style={{ backgroundColor: colors.border }} />
            <View className="items-center flex-1">
              <View className="flex-row items-center mb-1">
                <Ionicons name="trending-up" size={18} color={colors.primary} />
                <Text style={{ color: colors.text }} className="text-xl font-bold ml-1">{weeklyRate}%</Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs">This Month</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="mt-4">
          <Text style={{ color: colors.text }} className="text-lg font-bold mb-3 px-1">Quick Stats</Text>
          <View className="flex-row flex-wrap justify-between">
            <StatsCard 
              title="Active Habits"
              value={habits?.length || 0}
              subtitle="being tracked"
              icon="grid-outline"
              colors={colors}
              gradient={['#3b82f6', '#2563eb']}
            />
            <StatsCard 
              title="Best Streak"
              value={bestStreak}
              subtitle="personal best"
              icon="trophy-outline"
              colors={colors}
              gradient={['#f59e0b', '#d97706']}
            />
            <StatsCard 
              title="This Month"
              value={`${weeklyRate}%`}
              subtitle="completion rate"
              icon="stats-chart-outline"
              colors={colors}
              gradient={['#22c55e', '#16a34a']}
            />
            <StatsCard 
              title="Completed"
              value={totalCompleted}
              subtitle="total this month"
              icon="checkmark-done-outline"
              colors={colors}
              gradient={['#8b5cf6', '#7c3aed']}
            />
          </View>
        </View>

        {/* Top Habits Section */}
        {insights?.topHabits && insights.topHabits.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text style={{ color: colors.text }} className="text-lg font-bold">Top Performing Habits</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">Your most consistent habits</Text>
              </View>
              <Pressable onPress={() => router.push('/insights')}>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            {insights.topHabits.slice(0, 3).map((habit: TopHabit, index: number) => (
              <View 
                key={habit.habitId} 
                style={{ borderColor: colors.border }}
                className={`flex-row items-center py-3 ${index < 2 ? 'border-b' : ''}`}
              >
                <View 
                  className="w-12 h-12 rounded-2xl items-center justify-center mr-3 shadow-sm"
                  style={{ backgroundColor: habit.color + '20' }}
                >
                  <Text className="font-bold text-lg" style={{ color: habit.color }}>
                    #{index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="font-semibold text-base">{habit.title}</Text>
                  <View className="flex-row items-center mt-1">
                    <View style={{ backgroundColor: colors.backgroundTertiary }} className="flex-1 h-1.5 rounded-full mr-2">
                      <View 
                        style={{ 
                          width: `${Math.round(habit.completionRate * 100)}%`, 
                          backgroundColor: habit.color 
                        }} 
                        className="h-full rounded-full" 
                      />
                    </View>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium w-12 text-right">
                      {Math.round(habit.completionRate * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Badges Section */}
        {badges && badges.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text style={{ color: colors.text }} className="text-lg font-bold">Recent Achievements</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">Earned {badges.length} badge{badges.length !== 1 ? 's' : ''}</Text>
              </View>
              <Pressable onPress={() => router.push('/badges')} className="flex-row items-center">
                <Text style={{ color: colors.primary }} className="text-sm font-medium mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
            <View className="flex-row flex-wrap -mx-1">
              {badges.slice(0, 6).map((badge: Badge, index: number) => (
                <View key={index} className="w-1/3 px-1 mb-3">
                  <View style={{ backgroundColor: colors.backgroundTertiary }} className="rounded-2xl p-3 items-center">
                    <View className="w-14 h-14 rounded-2xl items-center justify-center mb-2" style={{ backgroundColor: '#fbbf24' + '20' }}>
                      <Ionicons name="trophy" size={28} color="#f59e0b" />
                    </View>
                    <Text style={{ color: colors.text }} className="text-xs font-medium text-center" numberOfLines={2}>
                      {badge.name}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View className="mt-4 mb-8">
          <Text style={{ color: colors.text }} className="text-lg font-bold mb-3 px-1">Quick Actions</Text>
          <View className="flex-row justify-between">
            <QuickActionButton 
              icon="add-circle" 
              label="New Habit" 
              onPress={() => router.push('/habits')}
              colors={colors}
              gradient={['#3b82f6', '#2563eb']}
            />
            <QuickActionButton 
              icon="time" 
              label="Focus Timer" 
              onPress={() => router.push('/focus')}
              colors={colors}
              gradient={['#8b5cf6', '#7c3aed']}
            />
            <QuickActionButton 
              icon="flag" 
              label="Challenges" 
              onPress={() => router.push('/challenges')}
              colors={colors}
              gradient={['#f59e0b', '#d97706']}
            />
            <QuickActionButton 
              icon="calendar" 
              label="Calendar" 
              onPress={() => router.push('/calendar')}
              colors={colors}
              gradient={['#22c55e', '#16a34a']}
            />
          </View>
        </View>

        {/* Motivational Quote */}
        <View className="mb-8 rounded-2xl overflow-hidden">
          <LinearGradient
            colors={isDark ? ['rgba(59, 130, 246, 0.15)', 'rgba(37, 99, 235, 0.05)'] : ['rgba(59, 130, 246, 0.1)', 'rgba(37, 99, 235, 0.05)']}
            style={{ borderColor: colors.border }}
            className="p-4 rounded-2xl border"
          >
            <View className="flex-row items-start">
              <View className="mr-3 mt-1">
                <Ionicons name="bulb" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text }} className="text-sm font-medium italic leading-relaxed">
                  "{quote.text}"
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-2 font-medium">
                  — {quote.author}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Stats Card Component
function StatsCard({ title, value, subtitle, icon, colors, gradient }: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: string;
  colors: any;
  gradient?: [string, string];
}) {
  return (
    <View className="w-[48%] mb-3">
      <LinearGradient
        colors={gradient || [colors.surface, colors.surface] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderColor: colors.border }}
        className="rounded-2xl border p-4 shadow-sm"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="bg-white/10 p-2.5 rounded-xl">
            <Ionicons name={icon as any} size={20} color="#fff" />
          </View>
        </View>
        <View>
          <Text className="text-white text-2xl font-bold mb-0.5">{value}</Text>
          <Text className="text-white/70 text-xs font-medium">{title}</Text>
          <Text className="text-white/50 text-xs mt-0.5">{subtitle}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// Quick Action Button Component
function QuickActionButton({ icon, label, onPress, colors, gradient }: { 
  icon: string; 
  label: string; 
  onPress: () => void; 
  colors: any;
  gradient?: [string, string];
}) {
  return (
    <Pressable className="items-center flex-1 mx-1" onPress={onPress}>
      <LinearGradient
        colors={gradient || [colors.primary, colors.primary] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full aspect-square rounded-2xl items-center justify-center mb-2 shadow-sm"
        style={{ maxWidth: 80 }}
      >
        <Ionicons name={icon as any} size={28} color="#fff" />
      </LinearGradient>
      <Text style={{ color: colors.text }} className="text-xs font-medium text-center">{label}</Text>
    </Pressable>
  );
}
