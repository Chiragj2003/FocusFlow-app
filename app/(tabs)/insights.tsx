import { useTheme } from '@/lib/ThemeContext';
import { useHabits, useInsights, useStreaks } from '@/lib/hooks';
import type { Habit, HabitStreak, TopHabit, WeeklyData as WeeklyDataType } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 64;
const chartHeight = 180;

interface WeeklyChartData {
  day: string;
  value: number;
}

interface TopHabitDisplay {
  name: string;
  streak: number;
  longestStreak: number;
  color: string;
}

interface CategoryData {
  name: string;
  percentage: number;
  color: string;
}

export default function InsightsScreen() {
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useInsights();
  const { data: streaks, isLoading: streaksLoading, refetch: refetchStreaks } = useStreaks();
  const { data: habits, refetch: refetchHabits } = useHabits(true);

  const isLoading = insightsLoading || streaksLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchInsights(), refetchStreaks(), refetchHabits()]);
    setRefreshing(false);
  }, [refetchInsights, refetchStreaks, refetchHabits]);

  // Calculate stats
  const monthlyCompletion = insights ? Math.round(insights.overallCompletionRate * 100) : 0;
  const totalCompletions = insights?.totalCompleted || 0;
  const perfectDays = insights?.weekly?.filter((d: WeeklyDataType) => d.rate === 1).length || 0;
  const totalHabits = habits?.length || 0;

  // Get weekly data for chart
  const weeklyData: WeeklyChartData[] = useMemo(() => {
    return insights?.weekly?.map((w: WeeklyDataType) => ({
      day: w.day,
      value: Math.round(w.rate * 100),
    })) || [];
  }, [insights]);

  const maxBarValue = Math.max(...weeklyData.map((d: WeeklyChartData) => d.value), 100);

  // Get top habits from streaks data
  const topHabits: TopHabitDisplay[] = useMemo(() => {
    return streaks?.streaksByHabit?.slice(0, 5).map((h: HabitStreak) => ({
      name: h.title,
      streak: h.currentStreak,
      longestStreak: h.longestStreak,
      color: habits?.find((habit: Habit) => habit.id === h.habitId)?.color || '#f97316',
    })) || [];
  }, [streaks, habits]);

  // Get category performance (group by category)
  const categoryPerformance: CategoryData[] = useMemo(() => {
    if (!insights?.topHabits || !habits) return [];

    const categoryMap = new Map<string, { total: number; completed: number; color: string }>();

    insights.topHabits.forEach((habit: TopHabit) => {
      const fullHabit = habits.find((h: Habit) => h.id === habit.habitId);
      const category = fullHabit?.category || 'Other';
      const existing = categoryMap.get(category) || { total: 0, completed: 0, color: fullHabit?.color || '#f97316' };
      existing.total += habit.totalDays;
      existing.completed += habit.completedCount;
      categoryMap.set(category, existing);
    });

    return Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        color: data.color,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);
  }, [insights, habits]);

  // Generate line chart path for weekly trend
  const lineChartPath = useMemo(() => {
    if (weeklyData.length === 0) return '';

    const padding = 20;
    const graphWidth = chartWidth - padding * 2;
    const graphHeight = chartHeight - 60;
    const stepX = graphWidth / (weeklyData.length - 1 || 1);

    let path = '';
    weeklyData.forEach((point: WeeklyChartData, index: number) => {
      const x = padding + index * stepX;
      const y = graphHeight - (point.value / maxBarValue) * graphHeight + 20;
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevPoint = weeklyData[index - 1];
        const prevX = padding + (index - 1) * stepX;
        const prevY = graphHeight - (prevPoint.value / maxBarValue) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });

    return path;
  }, [weeklyData, maxBarValue]);

  // Generate area fill path
  const areaPath = useMemo(() => {
    if (weeklyData.length === 0) return '';

    const padding = 20;
    const graphWidth = chartWidth - padding * 2;
    const graphHeight = chartHeight - 60;
    const stepX = graphWidth / (weeklyData.length - 1 || 1);
    const baseY = graphHeight + 20;

    let path = `M ${padding} ${baseY}`;
    weeklyData.forEach((point: WeeklyChartData, index: number) => {
      const x = padding + index * stepX;
      const y = graphHeight - (point.value / maxBarValue) * graphHeight + 20;
      if (index === 0) {
        path += ` L ${x} ${y}`;
      } else {
        const prevPoint = weeklyData[index - 1];
        const prevX = padding + (index - 1) * stepX;
        const prevY = graphHeight - (prevPoint.value / maxBarValue) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });
    path += ` L ${padding + (weeklyData.length - 1) * stepX} ${baseY} Z`;

    return path;
  }, [weeklyData, maxBarValue]);

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted }} className="mt-4">Loading insights...</Text>
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
        {/* Header - Web Aligned */}
        <View className="mb-6 mt-2">
          <Text style={{ color: colors.text }} className="text-3xl font-bold">Insights</Text>
          <Text style={{ color: colors.textMuted }} className="mt-1 text-base text-zinc-400">
            Analytics and trends
          </Text>
        </View>

        {/* Stats Overview - New Web Style */}
        <View className="flex-row justify-between gap-3">
          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-1 rounded-xl border p-4 items-center"
          >
            <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center mb-2">
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">{monthlyCompletion}%</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Success</Text>
          </View>

          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-1 rounded-xl border p-4 items-center"
          >
            <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mb-2">
              <Ionicons name="ribbon" size={18} color="#3b82f6" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">{totalCompletions}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Total</Text>
          </View>

          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-1 rounded-xl border p-4 items-center"
          >
            <View className="w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center mb-2">
              <Ionicons name="star" size={18} color="#f59e0b" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">{perfectDays}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Perfect</Text>
          </View>
        </View>

        {/* Weekly Trend Line Chart */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text style={{ color: colors.text }} className="text-base font-bold">Weekly Trend</Text>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.primary }} />
              <Text style={{ color: colors.textMuted }} className="text-xs">Completion %</Text>
            </View>
          </View>
          {weeklyData.length > 0 ? (
            <Svg width={chartWidth} height={chartHeight}>
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((val, i) => {
                const y = (chartHeight - 60) - (val / 100) * (chartHeight - 60) + 20;
                return (
                  <G key={i}>
                    <Line
                      x1={20}
                      y1={y}
                      x2={chartWidth - 20}
                      y2={y}
                      stroke={colors.border}
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                    <SvgText
                      x={10}
                      y={y + 4}
                      fontSize={10}
                      fill={colors.textMuted}
                    >
                      {val}
                    </SvgText>
                  </G>
                );
              })}

              {/* Area fill */}
              <Path
                d={areaPath}
                fill={colors.primary + '20'}
              />

              {/* Line */}
              <Path
                d={lineChartPath}
                stroke={colors.primary}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {weeklyData.map((point: WeeklyChartData, index: number) => {
                const padding = 20;
                const graphWidth = chartWidth - padding * 2;
                const graphHeight = chartHeight - 60;
                const stepX = graphWidth / (weeklyData.length - 1 || 1);
                const x = padding + index * stepX;
                const y = graphHeight - (point.value / maxBarValue) * graphHeight + 20;
                return (
                  <G key={index}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={6}
                      fill={colors.background}
                      stroke={colors.primary}
                      strokeWidth={3}
                    />
                    <SvgText
                      x={x}
                      y={chartHeight - 10}
                      fontSize={11}
                      fill={colors.textMuted}
                      textAnchor="middle"
                    >
                      {point.day}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          ) : (
            <View style={{ height: chartHeight }} className="items-center justify-center">
              <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-2">No data available yet</Text>
            </View>
          )}
        </View>

        {/* Category Performance Bar Chart */}
        {categoryPerformance.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
            <Text style={{ color: colors.text }} className="text-base font-bold mb-4">Category Performance</Text>
            {categoryPerformance.map((category: CategoryData, index: number) => (
              <View key={index} className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: category.color }}
                    />
                    <Text style={{ color: colors.text }} className="text-sm font-medium" numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>
                  <Text style={{ color: colors.primary }} className="text-sm font-bold ml-2">
                    {category.percentage}%
                  </Text>
                </View>
                <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-3 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${category.percentage}%`,
                      backgroundColor: category.color
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Horizontal Bar Chart for Top Habits */}
        {topHabits.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text }} className="text-base font-bold">Top Habits by Streak</Text>
              <Ionicons name="flame" size={20} color="#fb923c" />
            </View>
            {topHabits.map((habit: TopHabitDisplay, index: number) => {
              const maxStreak = Math.max(...topHabits.map((h: TopHabitDisplay) => h.longestStreak), 1);
              const currentWidth = (habit.streak / maxStreak) * 100;

              return (
                <View key={index} className="mb-4">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-8 h-8 rounded-lg items-center justify-center mr-2"
                        style={{ backgroundColor: habit.color + '20' }}
                      >
                        <Text style={{ color: habit.color }} className="font-bold text-sm">
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={{ color: colors.text }} className="text-sm" numberOfLines={1}>
                        {habit.name}
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary }} className="font-bold">
                      {habit.streak}d
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-2 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${currentWidth}%`,
                        backgroundColor: habit.color
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Progress Ring */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-6 items-center">
          <Text style={{ color: colors.text }} className="text-base font-bold mb-4">Overall Progress</Text>
          <View className="flex-row items-center justify-around w-full">
            {/* Monthly Progress Ring */}
            <View className="items-center">
              <View className="relative w-28 h-28">
                <Svg width={112} height={112}>
                  <Circle
                    cx={56}
                    cy={56}
                    r={48}
                    stroke={colors.backgroundTertiary}
                    strokeWidth={10}
                    fill="none"
                  />
                  <Circle
                    cx={56}
                    cy={56}
                    r={48}
                    stroke={colors.primary}
                    strokeWidth={10}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - monthlyCompletion / 100)}`}
                    transform="rotate(-90 56 56)"
                  />
                </Svg>
                <View className="absolute inset-0 items-center justify-center">
                  <Text style={{ color: colors.text }} className="text-xl font-bold">{monthlyCompletion}%</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs mt-2">Monthly</Text>
            </View>

            {/* Total Habits Ring */}
            <View className="items-center">
              <View className="relative w-28 h-28">
                <Svg width={112} height={112}>
                  <Circle
                    cx={56}
                    cy={56}
                    r={48}
                    stroke={colors.backgroundTertiary}
                    strokeWidth={10}
                    fill="none"
                  />
                  <Circle
                    cx={56}
                    cy={56}
                    r={48}
                    stroke={colors.success}
                    strokeWidth={10}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - Math.min(totalHabits / 10, 1))}`}
                    transform="rotate(-90 56 56)"
                  />
                </Svg>
                <View className="absolute inset-0 items-center justify-center">
                  <Text style={{ color: colors.text }} className="text-xl font-bold">{totalHabits}</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs mt-2">Habits</Text>
            </View>
          </View>
        </View>

        {/* Streak Stats */}
        <View className="mt-4 flex-row">
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-2xl border p-4 mr-2">
            <View className="flex-row items-center mb-2">
              <Ionicons name="flame" size={24} color="#fb923c" />
              <Text style={{ color: colors.textMuted }} className="text-sm ml-2">Current</Text>
            </View>
            <Text style={{ color: colors.text }} className="text-3xl font-bold">{streaks?.currentStreak || 0}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">day streak</Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-2xl border p-4 ml-2">
            <View className="flex-row items-center mb-2">
              <Ionicons name="trophy" size={24} color={colors.warning} />
              <Text style={{ color: colors.textMuted }} className="text-sm ml-2">Best</Text>
            </View>
            <Text style={{ color: colors.text }} className="text-3xl font-bold">{streaks?.longestStreak || 0}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">day streak</Text>
          </View>
        </View>

        {/* Weekly Summary Mini Cards */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
          <Text style={{ color: colors.text }} className="text-base font-bold mb-3">This Week</Text>
          <View className="flex-row flex-wrap">
            {weeklyData.map((day: WeeklyChartData, index: number) => (
              <View
                key={index}
                className="w-[14.28%] items-center py-2"
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-1"
                  style={{
                    backgroundColor: day.value >= 80
                      ? colors.success + '20'
                      : day.value >= 50
                        ? colors.warning + '20'
                        : day.value > 0
                          ? colors.error + '20'
                          : colors.backgroundTertiary
                  }}
                >
                  <Text
                    style={{
                      color: day.value >= 80
                        ? colors.success
                        : day.value >= 50
                          ? colors.warning
                          : day.value > 0
                            ? colors.error
                            : colors.textMuted,
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  >
                    {day.value}%
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }} className="text-xs">{day.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
