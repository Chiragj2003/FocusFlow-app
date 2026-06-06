import { Habit, HabitEntry, HabitStreak, TopHabit, WeeklyData as WeeklyDataType } from '@/lib/types';
import { formatDate, useEntries, useHabits, useInsights, useStreaks, useToggleEntry } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 64;
const chartHeight = 180;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function InsightsScreen() {
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'insights' | 'calendar'>('insights');
  const [refreshing, setRefreshing] = useState(false);

  // === Insights Data ===
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useInsights();
  const { data: streaks, isLoading: streaksLoading, refetch: refetchStreaks } = useStreaks();
  const { data: habits, refetch: refetchHabits, isLoading: habitsLoading } = useHabits(true);

  // === Calendar Data ===
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()));
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { start, end } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const paddedStart = new Date(firstDay);
    paddedStart.setDate(paddedStart.getDate() - startPadding);
    const endPadding = 6 - lastDay.getDay();
    const paddedEnd = new Date(lastDay);
    paddedEnd.setDate(paddedEnd.getDate() + endPadding);
    return { start: formatDate(paddedStart), end: formatDate(paddedEnd) };
  }, [year, month]);

  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries } = useEntries(start, end);
  const toggleEntry = useToggleEntry();

  const isLoading = insightsLoading || streaksLoading || habitsLoading || entriesLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchInsights(), refetchStreaks(), refetchHabits(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchInsights, refetchStreaks, refetchHabits, refetchEntries]);

  // === Insights Processing ===
  const monthlyCompletion = insights?.overallCompletionRate ? Math.round(insights.overallCompletionRate * 100) : 0;
  const totalCompletions = insights?.totalCompleted || 0;
  const perfectDays = insights?.weekly?.filter((d: WeeklyDataType) => d.rate === 1).length || 0;
  const totalHabitsCount = habits?.length || 0;

  const bestDayOfWeek = useMemo(() => {
    if (!entries || entries.length === 0) return 'None';
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    entries.forEach((e: any) => {
      if (e.completed) {
        const d = new Date(e.entryDate).getDay();
        dayCounts[d]++;
      }
    });
    const maxIndex = dayCounts.indexOf(Math.max(...dayCounts));
    return dayCounts[maxIndex] > 0 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][maxIndex] : 'None';
  }, [entries]);

  const weeklyData = useMemo(() => {
    return insights?.weekly?.map((w: WeeklyDataType) => ({
      day: w.day || '',
      value: typeof w.rate === 'number' && !isNaN(w.rate) ? Math.round(w.rate * 100) : 0,
    })) || [];
  }, [insights]);
  const maxBarValue = Math.max(...weeklyData.map((d: any) => d.value), 100);

  const topHabits = useMemo(() => {
    return streaks?.streaksByHabit?.slice(0, 5).map((h: HabitStreak) => ({
      name: h.title,
      streak: h.currentStreak,
      longestStreak: h.longestStreak,
      color: habits?.find((habit: Habit) => habit.id === h.habitId)?.color || '#f97316',
    })) || [];
  }, [streaks, habits]);

  const categoryPerformance = useMemo(() => {
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

  const lineChartPath = useMemo(() => {
    if (weeklyData.length === 0) return '';
    const padding = 20;
    const graphWidth = chartWidth - padding * 2;
    const graphHeight = chartHeight - 60;
    const stepX = graphWidth / (weeklyData.length - 1 || 1);
    let path = '';
    weeklyData.forEach((point: any, index: number) => {
      const x = padding + index * stepX;
      const pointVal = typeof point.value === 'number' && !isNaN(point.value) ? point.value : 0;
      const maxVal = maxBarValue > 0 ? maxBarValue : 100;
      const y = graphHeight - (pointVal / maxVal) * graphHeight + 20;
      if (index === 0) path += `M ${x} ${y}`;
      else {
        const prevPoint = weeklyData[index - 1];
        const prevPointVal = typeof prevPoint.value === 'number' && !isNaN(prevPoint.value) ? prevPoint.value : 0;
        const prevX = padding + (index - 1) * stepX;
        const prevY = graphHeight - (prevPointVal / maxVal) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });
    return path;
  }, [weeklyData, maxBarValue]);

  const areaPath = useMemo(() => {
    if (weeklyData.length === 0) return '';
    const padding = 20;
    const graphWidth = chartWidth - padding * 2;
    const graphHeight = chartHeight - 60;
    const stepX = graphWidth / (weeklyData.length - 1 || 1);
    const baseY = graphHeight + 20;
    let path = `M ${padding} ${baseY}`;
    weeklyData.forEach((point: any, index: number) => {
      const x = padding + index * stepX;
      const pointVal = typeof point.value === 'number' && !isNaN(point.value) ? point.value : 0;
      const maxVal = maxBarValue > 0 ? maxBarValue : 100;
      const y = graphHeight - (pointVal / maxVal) * graphHeight + 20;
      if (index === 0) path += ` L ${x} ${y}`;
      else {
        const prevPoint = weeklyData[index - 1];
        const prevPointVal = typeof prevPoint.value === 'number' && !isNaN(prevPoint.value) ? prevPoint.value : 0;
        const prevX = padding + (index - 1) * stepX;
        const prevY = graphHeight - (prevPointVal / maxVal) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });
    path += ` L ${padding + (weeklyData.length - 1) * stepX} ${baseY} Z`;
    return path;
  }, [weeklyData, maxBarValue]);

  // === Calendar Processing ===
  const calendarDays = useMemo(() => {
    const days: Array<{ date: string; isCurrentMonth: boolean; isToday: boolean }> = [];
    const today = formatDate(new Date());
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date: formatDate(date), isCurrentMonth: false, isToday: formatDate(date) === today });
    }
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date: formatDate(date), isCurrentMonth: true, isToday: formatDate(date) === today });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date: formatDate(date), isCurrentMonth: false, isToday: formatDate(date) === today });
    }
    return days;
  }, [year, month]);

  const dayCompletions = useMemo(() => {
    if (!entries || !habits || habits.length === 0) return {};
    const completions: Record<string, { completed: number; total: number; rate: number }> = {};
    calendarDays.forEach(day => {
      const dayEntries = entries.filter((e: HabitEntry) => e.entryDate === day.date && e.completed);
      completions[day.date] = {
        completed: dayEntries.length,
        total: habits.length,
        rate: dayEntries.length / habits.length,
      };
    });
    return completions;
  }, [entries, habits, calendarDays]);

  const selectedDateEntries = useMemo(() => {
    if (!selectedDate || !habits) return [];
    return habits.map((habit: Habit) => {
      const entry = entries?.find((e: HabitEntry) => e.habitId === habit.id && e.entryDate === selectedDate);
      return { habit, entry, completed: entry?.completed || false };
    });
  }, [selectedDate, habits, entries]);

  const getCompletionColor = (rate: number) => {
    if (rate === 0) return 'transparent';
    if (rate < 0.33) return colors.error + '40';
    if (rate < 0.66) return colors.warning + '60';
    if (rate < 1) return colors.primary + '60';
    return colors.success + '60';
  };

  const handleToggleHabit = async (habitId: string, completed: boolean) => {
    if (!selectedDate) return;
    try { await toggleEntry.mutateAsync({ habitId, entryDate: selectedDate, completed: !completed }); } 
    catch (error) { console.error('Failed to toggle habit:', error); }
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header and Toggle */}
      <View className="px-6 pt-4 pb-2 mt-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: colors.text }} className="text-3xl font-bold">Insights</Text>
        </View>
        
        {/* Segmented Control */}
        <View className="flex-row rounded-xl p-1 mb-2" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
          <Pressable 
            onPress={() => setActiveTab('insights')}
            className={`flex-1 items-center py-2 rounded-lg ${activeTab === 'insights' ? '' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'insights' ? colors.backgroundSecondary : 'transparent' }}
          >
            <Text style={{ color: activeTab === 'insights' ? colors.text : colors.textMuted }} className="font-bold">Stats</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('calendar')}
            className={`flex-1 items-center py-2 rounded-lg ${activeTab === 'calendar' ? '' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'calendar' ? colors.backgroundSecondary : 'transparent' }}
          >
            <Text style={{ color: activeTab === 'calendar' ? colors.text : colors.textMuted }} className="font-bold">Calendar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'insights' ? (
          /* INSIGHTS TAB */
          <View>
            <View className="flex-row justify-between gap-3 mt-4">
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center mb-2">
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </View>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{monthlyCompletion}%</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Success</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mb-2">
                  <Ionicons name="ribbon" size={18} color="#3b82f6" />
                </View>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{totalCompletions}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Total</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center mb-2">
                  <Ionicons name="star" size={18} color="#f59e0b" />
                </View>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{perfectDays}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Perfect</Text>
              </View>
            </View>

            {/* Second row of Stats */}
            <View className="flex-row justify-between gap-3 mt-3">
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-purple-500/10 items-center justify-center mb-2">
                  <Ionicons name="calendar-outline" size={18} color="#a855f7" />
                </View>
                <Text style={{ color: colors.text }} className="text-xl font-bold">{bestDayOfWeek}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Best Day</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-rose-500/10 items-center justify-center mb-2">
                  <Ionicons name="trending-up" size={18} color="#f43f5e" />
                </View>
                <Text style={{ color: colors.text }} className="text-xl font-bold">{totalHabitsCount}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Active Habits</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-cyan-500/10 items-center justify-center mb-2">
                  <Ionicons name="checkmark-done" size={18} color="#06b6d4" />
                </View>
                <Text style={{ color: colors.text }} className="text-xl font-bold">{entries?.filter((e: any) => e.completed).length || 0}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">This Month</Text>
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
                  {[0, 25, 50, 75, 100].map((val, i) => {
                    const y = (chartHeight - 60) - (val / 100) * (chartHeight - 60) + 20;
                    return (
                      <G key={i}>
                        <Line x1={20} y1={y} x2={chartWidth - 20} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
                        <SvgText x={10} y={y + 4} fontSize={10} fill={colors.textMuted}>{val}</SvgText>
                      </G>
                    );
                  })}
                  <Path d={areaPath} fill={colors.primary + '20'} />
                  <Path d={lineChartPath} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {weeklyData.map((point: any, index: number) => {
                    const padding = 20;
                    const graphWidth = chartWidth - padding * 2;
                    const graphHeight = chartHeight - 60;
                    const stepX = graphWidth / (weeklyData.length - 1 || 1);
                    const x = padding + index * stepX;
                    const y = graphHeight - (point.value / maxBarValue) * graphHeight + 20;
                    return (
                      <G key={index}>
                        <Circle cx={x} cy={y} r={6} fill={colors.background} stroke={colors.primary} strokeWidth={3} />
                        <SvgText x={x} y={chartHeight - 10} fontSize={11} fill={colors.textMuted} textAnchor="middle">{point.day}</SvgText>
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

            {/* Streak Stats */}
            <View className="flex-row justify-between gap-3 mt-4">
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-orange-500/10 items-center justify-center mb-2">
                  <Ionicons name="flame" size={18} color="#fb923c" />
                </View>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{streaks?.currentStreak || 0}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Current Streak</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-1 rounded-xl border p-4 items-center">
                <View className="w-8 h-8 rounded-full bg-yellow-500/10 items-center justify-center mb-2">
                  <Ionicons name="trophy" size={18} color="#eab308" />
                </View>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{streaks?.longestStreak || 0}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1">Best Streak</Text>
              </View>
            </View>

            {/* Top Habits */}
            {topHabits.length > 0 && (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
                <View className="flex-row items-center justify-between mb-4">
                  <Text style={{ color: colors.text }} className="text-base font-bold">Top Habits by Streak</Text>
                  <Ionicons name="flame" size={20} color="#fb923c" />
                </View>
                {topHabits.map((habit: any, index: number) => {
                  const maxStreak = Math.max(...topHabits.map((h: any) => h.longestStreak), 1);
                  const currentWidth = (habit.streak / maxStreak) * 100;
                  return (
                    <View key={index} className="mb-4">
                      <View className="flex-row items-center justify-between mb-1">
                        <View className="flex-row items-center flex-1">
                          <View className="w-8 h-8 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: habit.color + '20' }}>
                            <Text style={{ color: habit.color }} className="font-bold text-sm">{index + 1}</Text>
                          </View>
                          <Text style={{ color: colors.text }} className="text-sm" numberOfLines={1}>{habit.name}</Text>
                        </View>
                        <Text style={{ color: colors.primary }} className="font-bold">{habit.streak}d</Text>
                      </View>
                      <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-2 rounded-full overflow-hidden">
                        <View className="h-full rounded-full" style={{ width: `${currentWidth}%`, backgroundColor: habit.color }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View className="h-8" />
          </View>
        ) : (
          /* CALENDAR TAB */
          <View>
            <View className="flex-row items-center justify-between mb-4 mt-2">
              <Text style={{ color: colors.text }} className="text-xl font-bold">
                {MONTHS[month]} {year}
              </Text>
              <View className="flex-row items-center bg-gray-500/10 rounded-full px-2 py-1">
                <Pressable onPress={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 mr-2">
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(formatDate(new Date()));
                }} className="px-2">
                  <Text style={{ color: colors.primary }} className="font-bold">Today</Text>
                </Pressable>
                <Pressable onPress={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 ml-2">
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {/* Calendar Grid */}
            <View className="pb-4">
              <View className="flex-row mb-2">
                {DAYS.map(day => (
                  <View key={day} className="flex-1 items-center py-2">
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium">{day}</Text>
                  </View>
                ))}
              </View>
              
              <View className="flex-row flex-wrap">
                {calendarDays.map((day, index) => {
                  const completion = dayCompletions[day.date];
                  const isSelected = selectedDate === day.date;
                  const hasCompletion = completion && completion.completed > 0;
                  return (
                    <Pressable
                      key={index}
                      onPress={() => setSelectedDate(day.date)}
                      className="w-[14.28%] aspect-square p-1"
                    >
                      <View 
                        className="w-full h-full rounded-full items-center justify-center"
                        style={{ 
                          backgroundColor: hasCompletion ? getCompletionColor(completion.rate) : 'transparent',
                          borderWidth: isSelected ? 2 : (day.isToday ? 1 : 0),
                          borderColor: isSelected ? colors.primary : (day.isToday ? colors.textMuted : 'transparent')
                        }}
                      >
                        <Text 
                          style={{ 
                            color: isSelected ? colors.primary : (day.isCurrentMonth ? colors.text : colors.textMuted),
                            fontWeight: isSelected || day.isToday ? 'bold' : 'normal'
                          }}
                          className="text-base"
                        >
                          {new Date(day.date).getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Selected Date Details */}
            {selectedDate && (
              <View className="pb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text style={{ color: colors.text }} className="text-lg font-semibold">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Text>
                  {dayCompletions[selectedDate] && (
                    <Text style={{ color: colors.textMuted }}>
                      {dayCompletions[selectedDate].completed}/{dayCompletions[selectedDate].total} completed
                    </Text>
                  )}
                </View>

                {selectedDateEntries.length === 0 ? (
                  <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-6 items-center">
                    <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted }} className="mt-2">No habits to track</Text>
                  </View>
                ) : (
                  <View className="gap-2">
                    {selectedDateEntries.map(({ habit, completed }: any) => (
                      <Pressable
                        key={habit.id}
                        onPress={() => handleToggleHabit(habit.id, completed)}
                        disabled={toggleEntry.isPending}
                        style={{ backgroundColor: completed ? colors.backgroundSecondary : colors.surface }}
                        className="flex-row items-center p-4 rounded-xl"
                      >
                        <View 
                          className="w-6 h-6 rounded-full border-2 items-center justify-center mr-3"
                          style={{ borderColor: habit.color, backgroundColor: completed ? habit.color : 'transparent' }}
                        >
                          {completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <Text style={{ color: completed ? colors.textMuted : colors.text }} className="flex-1 font-medium">
                          {habit.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            
            <View className="h-8" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
