import { Habit, HabitEntry } from '@/lib/api';
import { formatDate, useEntries, useHabits, useToggleEntry } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarScreen() {
  const { isDark, colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get date range for current month view (include padding days)
  const { start, end } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from the Sunday of the first week
    const startPadding = firstDay.getDay();
    const paddedStart = new Date(firstDay);
    paddedStart.setDate(paddedStart.getDate() - startPadding);
    // End on the Saturday of the last week
    const endPadding = 6 - lastDay.getDay();
    const paddedEnd = new Date(lastDay);
    paddedEnd.setDate(paddedEnd.getDate() + endPadding);
    
    return {
      start: formatDate(paddedStart),
      end: formatDate(paddedEnd),
    };
  }, [year, month]);

  const { data: habits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries } = useEntries(start, end);
  const toggleEntry = useToggleEntry();

  const isLoading = habitsLoading || entriesLoading;

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ date: string; isCurrentMonth: boolean; isToday: boolean }> = [];
    const today = formatDate(new Date());
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    
    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date: formatDate(date),
        isCurrentMonth: false,
        isToday: formatDate(date) === today,
      });
    }
    
    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date: formatDate(date),
        isCurrentMonth: true,
        isToday: formatDate(date) === today,
      });
    }
    
    // Next month days (to fill the grid)
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date: formatDate(date),
        isCurrentMonth: false,
        isToday: formatDate(date) === today,
      });
    }
    
    return days;
  }, [year, month]);

  // Get completion data for each day
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

  // Get entries for selected date
  const selectedDateEntries = useMemo(() => {
    if (!selectedDate || !habits) return [];
    
    return habits.map((habit: Habit) => {
      const entry = entries?.find((e: HabitEntry) => e.habitId === habit.id && e.entryDate === selectedDate);
      return {
        habit,
        entry,
        completed: entry?.completed || false,
      };
    });
  }, [selectedDate, habits, entries]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(formatDate(new Date()));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHabits(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchHabits, refetchEntries]);

  const handleToggleHabit = async (habitId: string, completed: boolean) => {
    if (!selectedDate) return;
    
    try {
      await toggleEntry.mutateAsync({
        habitId,
        entryDate: selectedDate,
        completed: !completed,
      });
    } catch (error) {
      console.error('Failed to toggle habit:', error);
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate === 0) return 'transparent';
    if (rate < 0.33) return colors.error + '40';
    if (rate < 0.66) return colors.warning + '60';
    if (rate < 1) return colors.primary + '60';
    return colors.success + '60';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header with Gradient */}
      {/* Minimalist Header */}
      <View className="px-6 pt-4 pb-2 mt-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: colors.text }} className="text-3xl font-bold">Calendar</Text>
          <Pressable 
            onPress={goToToday}
            className="px-4 py-1.5 rounded-full"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text style={{ color: colors.primary }} className="font-bold">Today</Text>
          </Pressable>
        </View>
        
        {/* Month Navigation */}
        <View className="flex-row items-center justify-between">
          <Text style={{ color: colors.text }} className="text-2xl font-bold">
            {MONTHS[month]} {year}
          </Text>
          <View className="flex-row items-center bg-gray-500/10 rounded-full px-2 py-1">
            <Pressable onPress={goToPreviousMonth} className="p-1 mr-2">
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Pressable onPress={goToNextMonth} className="p-1 ml-2">
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Calendar Grid */}
        <View className="px-4 pb-4">
          {/* Day Headers */}
          <View className="flex-row mb-2">
            {DAYS.map(day => (
              <View key={day} className="flex-1 items-center py-2">
                <Text style={{ color: colors.textMuted }} className="text-xs font-medium">{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          {isLoading ? (
            <View className="h-64 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View className="flex-row flex-wrap">
              {calendarDays.map((day, index) => {
                const completion = dayCompletions[day.date];
                const isSelected = selectedDate === day.date;
                const hasCompletion = completion && completion.completed > 0;
                
                return (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedDate(day.date)}
                    className={`w-[14.28%] aspect-square p-1`}
                  >
                    <View 
                      className={`w-full h-full rounded-full items-center justify-center`}
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
          )}
        </View>

        {/* Selected Date Details */}
        {selectedDate && (
          <View className="px-6 pb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text }} className="text-lg font-semibold">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
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
                {selectedDateEntries.map(({ habit, completed }: { habit: Habit; completed: boolean }) => (
                  <Pressable
                    key={habit.id}
                    onPress={() => handleToggleHabit(habit.id, completed)}
                    disabled={toggleEntry.isPending}
                    style={{ backgroundColor: completed ? colors.backgroundSecondary : colors.surface }}
                    className="flex-row items-center p-4 rounded-xl"
                  >
                    <View 
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3`}
                      style={{ 
                        borderColor: habit.color,
                        backgroundColor: completed ? habit.color : 'transparent'
                      }}
                    >
                      {completed && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={{ color: completed ? colors.textMuted : colors.text }} className="flex-1 font-medium">
                      {habit.title}
                    </Text>
                    {habit.goalType !== 'binary' && habit.goalTarget && (
                      <Text style={{ color: colors.textMuted }} className="text-sm">
                        {habit.goalTarget} {habit.unit}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Legend */}
        <View className="px-6 pb-8">
          <Text style={{ color: colors.textMuted }} className="text-sm mb-2">Completion Rate</Text>
          <View className="flex-row gap-2">
            <View className="flex-row items-center">
              <View style={{ borderWidth: 1, borderColor: colors.textMuted }} className="w-4 h-4 rounded-full mr-1" />
              <Text style={{ color: colors.textMuted }} className="text-xs">0%</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: colors.error + '40' }} className="w-4 h-4 rounded-full mr-1" />
              <Text style={{ color: colors.textMuted }} className="text-xs">1-33%</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: colors.warning + '60' }} className="w-4 h-4 rounded-full mr-1" />
              <Text style={{ color: colors.textMuted }} className="text-xs">34-66%</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: colors.primary + '60' }} className="w-4 h-4 rounded-full mr-1" />
              <Text style={{ color: colors.textMuted }} className="text-xs">67-99%</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: colors.success + '60' }} className="w-4 h-4 rounded-full mr-1" />
              <Text style={{ color: colors.textMuted }} className="text-xs">100%</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
