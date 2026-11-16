import { Habit, HabitEntry, HabitStreak, TopHabit, WeeklyData as WeeklyDataType } from '@/lib/types';
import { formatDate, useEntries, useHabits, useInsights, useStreaks, useToggleEntry } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function InsightsScreen() {
  const { isDark, colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 64;
  const chartHeight = 180;
  const paddingLeft = 70;
  const paddingRight = 20;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - 60;

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

  const totalHabitsCount = habits?.length || 0;
  
  // === Insights Processing ===
  const monthlyCompletion = insights?.overallCompletionRate ? Math.round(insights.overallCompletionRate * 100) : 0;
  const totalCompletions = insights?.totalCompleted || 0;
  const perfectDays = insights?.weekly?.filter((d: WeeklyDataType) => d.rate === 1).length || 0;

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
    if (!entries || !habits || habits.length === 0) return [];
    const activeHabits = habits.filter((h: any) => h.active !== false);
    const activeHabitsCount = activeHabits.length || 1;
    const activeHabitIds = new Set(activeHabits.map((h: any) => h.id));
    const days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      
      const dayEntries = entries.filter((e: any) => e.entryDate === dateStr && e.completed && activeHabitIds.has(e.habitId));
      const uniqueCompletions = new Set(dayEntries.map((e: any) => e.habitId));
      const rate = uniqueCompletions.size / activeHabitsCount;
      
      days.push({ 
        day: dayName, 
        value: Math.min(Math.round(rate * 100), 100) 
      });
    }
    return days;
  }, [entries, habits]);
  const maxBarValue = Math.max(...weeklyData.map((d: any) => d.value), 100);

  const dailyData = useMemo(() => {
    if (!entries || !habits || habits.length === 0) return [];
    const activeHabitIds = new Set(habits.filter((h: any) => h.active !== false).map((h: any) => h.id));
    const days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      const dayEntries = entries.filter((e: any) => e.entryDate === dateStr && e.completed && activeHabitIds.has(e.habitId));
      const uniqueCompletions = new Set(dayEntries.map((e: any) => e.habitId));
      days.push({ day: dayName, value: uniqueCompletions.size });
    }
    return days;
  }, [entries, habits]);
  const maxDailyValue = Math.max(...dailyData.map((d: any) => d.value), 4);

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
    const stepX = graphWidth / (weeklyData.length - 1 || 1);
    let path = '';
    weeklyData.forEach((point: any, index: number) => {
      const x = paddingLeft + index * stepX;
      const pointVal = typeof point.value === 'number' && !isNaN(point.value) ? point.value : 0;
      const maxVal = maxBarValue > 0 ? maxBarValue : 100;
      const y = graphHeight - (pointVal / maxVal) * graphHeight + 20;
      if (index === 0) path += `M ${x} ${y}`;
      else {
        const prevPoint = weeklyData[index - 1];
        const prevPointVal = typeof prevPoint.value === 'number' && !isNaN(prevPoint.value) ? prevPoint.value : 0;
        const prevX = paddingLeft + (index - 1) * stepX;
        const prevY = graphHeight - (prevPointVal / maxVal) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });
    return path;
  }, [weeklyData, maxBarValue, graphWidth, graphHeight, paddingLeft]);

  const areaPath = useMemo(() => {
    if (weeklyData.length === 0) return '';
    const stepX = graphWidth / (weeklyData.length - 1 || 1);
    const baseY = graphHeight + 20;
    let path = `M ${paddingLeft} ${baseY}`;
    weeklyData.forEach((point: any, index: number) => {
      const x = paddingLeft + index * stepX;
      const pointVal = typeof point.value === 'number' && !isNaN(point.value) ? point.value : 0;
      const maxVal = maxBarValue > 0 ? maxBarValue : 100;
      const y = graphHeight - (pointVal / maxVal) * graphHeight + 20;
      if (index === 0) path += ` L ${x} ${y}`;
      else {
        const prevPoint = weeklyData[index - 1];
        const prevPointVal = typeof prevPoint.value === 'number' && !isNaN(prevPoint.value) ? prevPoint.value : 0;
        const prevX = paddingLeft + (index - 1) * stepX;
        const prevY = graphHeight - (prevPointVal / maxVal) * graphHeight + 20;
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });
    path += ` L ${paddingLeft + (weeklyData.length - 1) * stepX} ${baseY} Z`;
    return path;
  }, [weeklyData, maxBarValue, graphWidth, graphHeight, paddingLeft]);

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

  // Calendar is read-only, habit toggling removed

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
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
            {/* Stats: even 3x2 grid (plain styles; NativeWind flex-1 split widths unevenly) */}
            {[
              [
                { icon: "checkmark-circle", tint: "#10b981", value: `${monthlyCompletion}%`, label: "Success rate" },
                { icon: "ribbon", tint: "#3b82f6", value: String(totalCompletions), label: "Completions" },
                { icon: "star", tint: "#f59e0b", value: String(perfectDays), label: "Perfect days" },
              ],
              [
                { icon: "calendar-outline", tint: "#a855f7", value: String(bestDayOfWeek), label: "Best day" },
                { icon: "trending-up", tint: "#f43f5e", value: String(totalHabitsCount), label: "Active habits" },
                { icon: "checkmark-done", tint: "#06b6d4", value: String(entries?.filter((e: any) => e.completed).length || 0), label: "This month" },
              ],
            ].map((row, r) => (
              <View key={r} style={{ flexDirection: "row", gap: 10, marginTop: r === 0 ? 16 : 10 }}>
                {row.map((stat) => (
                  <View
                    key={stat.label}
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    style={{ flex: 1, minWidth: 0, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center" }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: stat.tint + "1a", marginBottom: 8 }}>
                      <Ionicons name={stat.icon as any} size={18} color={stat.tint} />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {stat.value}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: "center" }} numberOfLines={1}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Daily Trend Bar Chart */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mt-4 rounded-2xl border p-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ color: colors.text }} className="text-base font-bold">Daily Trend</Text>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.info }} />
                  <Text style={{ color: colors.textMuted }} className="text-xs">Completions</Text>
                </View>
              </View>
              {dailyData.length > 0 ? (
                <Svg width={chartWidth} height={chartHeight - 40}>
                  {[0, Math.ceil(maxDailyValue/2), maxDailyValue].map((val, i) => {
                    const y = (chartHeight - 100) - (val / maxDailyValue) * (chartHeight - 100) + 20;
                    return (
                      <G key={i}>
                        <Line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke={colors.border + '50'} strokeWidth={1} strokeDasharray="4,4" />
                        <SvgText x={paddingLeft - 15} y={y + 4} fontSize={10} fill={colors.textMuted} fontWeight="600" textAnchor="end">{val}</SvgText>
                      </G>
                    );
                  })}
                  {/* Baseline and Y axis separator */}
                  <Line x1={paddingLeft} y1={20} x2={paddingLeft} y2={chartHeight - 80} stroke={colors.border} strokeWidth={1.5} />
                  <Line x1={paddingLeft} y1={chartHeight - 80} x2={chartWidth - paddingRight} y2={chartHeight - 80} stroke={colors.border} strokeWidth={1.5} />

                  {dailyData.map((point: any, index: number) => {
                    const stepX = graphWidth / (dailyData.length - 1 || 1);
                    const x = paddingLeft + index * stepX;
                    const barHeight = (point.value / maxDailyValue) * (chartHeight - 100);
                    const y = (chartHeight - 100) - barHeight + 20;
                    const barWidth = 14;
                    const isZero = point.value === 0;
                    return (
                      <G key={index}>
                        {isZero ? (
                          <Rect x={x - barWidth / 2} y={chartHeight - 80 - 4} width={barWidth} height={4} rx={2} fill={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'} />
                        ) : (
                          <Rect x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(barHeight, 4)} rx={4} fill={colors.info} />
                        )}
                        <SvgText x={x} y={chartHeight - 50} fontSize={10} fill={colors.textMuted} fontWeight="bold" textAnchor="middle">{point.day}</SvgText>
                      </G>
                    );
                  })}
                </Svg>
              ) : (
                <View style={{ height: chartHeight - 40 }} className="items-center justify-center">
                  <Ionicons name="stats-chart" size={48} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }} className="mt-2">No data available yet</Text>
                </View>
              )}
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
                  <Defs>
                    <LinearGradient id="gradientArea" x1="0%" y1="0%" x2="0%" y2="100%">
                      <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.4" />
                      <Stop offset="100%" stopColor={colors.backgroundSecondary} stopOpacity="0.0" />
                    </LinearGradient>
                  </Defs>
                  {[0, 25, 50, 75, 100].map((val, i) => {
                    const y = (chartHeight - 60) - (val / 100) * (chartHeight - 60) + 20;
                    return (
                      <G key={i}>
                        <Line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke={colors.border + '50'} strokeWidth={1} strokeDasharray="4,4" />
                        <SvgText x={paddingLeft - 15} y={y + 4} fontSize={10} fill={colors.textMuted} fontWeight="600" textAnchor="end">{`${val}%`}</SvgText>
                      </G>
                    );
                  })}
                  {/* Baseline and Y axis separator */}
                  <Line x1={paddingLeft} y1={20} x2={paddingLeft} y2={chartHeight - 40} stroke={colors.border} strokeWidth={1.5} />
                  <Line x1={paddingLeft} y1={chartHeight - 40} x2={chartWidth - paddingRight} y2={chartHeight - 40} stroke={colors.border} strokeWidth={1.5} />

                  <Path d={areaPath} fill="url(#gradientArea)" />
                  <Path d={lineChartPath} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {weeklyData.map((point: any, index: number) => {
                    const stepX = graphWidth / (weeklyData.length - 1 || 1);
                    const x = paddingLeft + index * stepX;
                    const y = graphHeight - (point.value / maxBarValue) * graphHeight + 20;
                    return (
                      <G key={index}>
                        <Circle cx={x} cy={y} r={5} fill={colors.background} stroke={colors.primary} strokeWidth={2.5} />
                        <SvgText x={x} y={chartHeight - 15} fontSize={10} fill={colors.textMuted} fontWeight="bold" textAnchor="middle">{point.day}</SvgText>
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
                      <View
                        key={habit.id}
                        style={{ backgroundColor: completed ? colors.backgroundSecondary : colors.surface }}
                        className="flex-row items-center p-4 rounded-xl opacity-90"
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
                      </View>
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
