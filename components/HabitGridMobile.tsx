import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit, HabitEntry } from '@/lib/types';

interface HabitGridMobileProps {
  habits: Habit[];
  entries: HabitEntry[];
  days: string[]; // ISO date strings for the current month
  onToggle: (habitId: string, date: string, completed: boolean) => void;
  onArchive?: (habitId: string) => void;
  onDelete?: (habitId: string) => void;
  colors: any;
}

// Memoized day cell component for performance
const DayCell = memo(({
  habitId,
  date,
  completed,
  color,
  primaryColor,
  onToggle
}: {
  habitId: string;
  date: string;
  completed: boolean;
  color: string;
  primaryColor: string;
  onToggle: (habitId: string, date: string, completed: boolean) => void;
}) => {
  const handlePress = useCallback(() => {
    onToggle(habitId, date, !completed);
  }, [habitId, date, completed, onToggle]);

  return (
    <Pressable
      onPress={handlePress}
      style={{
        width: 32,
        height: 32,
        marginHorizontal: 2,
        borderRadius: 8,
        backgroundColor: completed ? (color || primaryColor) : 'rgba(39, 39, 42, 0.3)', // muted zinc background
        borderWidth: 1,
        borderColor: completed ? (color || primaryColor) : 'rgba(63, 63, 70, 0.5)', // zinc-700
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {completed && <Ionicons name="checkmark" size={18} color="#fff" />}
    </Pressable>
  );
});

DayCell.displayName = 'DayCell';

// Memoized habit row component
const HabitRow = memo(({
  habit,
  days,
  entriesMap,
  colors,
  onToggle,
  onArchive,
  onDelete
}: {
  habit: Habit;
  days: string[];
  entriesMap: Map<string, HabitEntry>;
  colors: any;
  onToggle: (habitId: string, date: string, completed: boolean) => void;
  onArchive?: (habitId: string) => void;
  onDelete?: (habitId: string) => void;
}) => {
  const handleLongPress = useCallback(() => {
    Alert.alert(
      habit.title,
      'Manage this habit',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => onArchive?.(habit.id),
          style: 'default'
        },
        {
          text: 'Delete',
          onPress: () => onDelete?.(habit.id),
          style: 'destructive'
        }
      ]
    );
  }, [habit, onArchive, onDelete]);

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2 px-1">
        <Pressable
          onLongPress={handleLongPress}
          className="flex-row items-center flex-1 mr-4"
        >
          <View
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: habit.color || colors.primary }}
          />
          <Text
            className="font-medium text-sm text-zinc-200"
            numberOfLines={1}
          >
            {habit.title}
          </Text>
        </Pressable>

        <Pressable onPress={handleLongPress} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#71717a" />
        </Pressable>
      </View>

      <View className="flex-row">
        {days.map(date => {
          const entryKey = `${habit.id}-${date}`;
          const entry = entriesMap.get(entryKey);
          const completed = !!entry?.completed;
          return (
            <DayCell
              key={date}
              habitId={habit.id}
              date={date}
              completed={completed}
              color={habit.color || colors.primary}
              primaryColor={colors.primary}
              onToggle={onToggle}
            />
          );
        })}
      </View>
    </View>
  );
});

HabitRow.displayName = 'HabitRow';

// Memoized header component
const GridHeader = memo(({ days, colors }: { days: string[]; colors: any }) => {
  return (
    <View className="flex-row mb-3 pl-1">
      {days.map(date => {
        const d = new Date(date);
        const dayNum = d.getDate();
        const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
        const isToday = new Date().toDateString() === d.toDateString();

        return (
          <View key={date} style={{ width: 32, marginHorizontal: 2, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#71717a', marginBottom: 2 }}>{dayName}</Text>
            <Text style={{
              fontSize: 12,
              fontWeight: isToday ? 'bold' : 'normal',
              color: isToday ? colors.primary : '#a1a1aa'
            }}>
              {dayNum}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

GridHeader.displayName = 'GridHeader';

export const HabitGridMobile: React.FC<HabitGridMobileProps> = memo(({
  habits,
  entries,
  days,
  onToggle,
  onArchive,
  onDelete,
  colors
}) => {
  // Create a lookup map for O(1) entry access instead of O(n) find operations
  const entriesMap = useMemo(() => {
    const map = new Map<string, HabitEntry>();
    entries.forEach(entry => {
      map.set(`${entry.habitId}-${entry.entryDate}`, entry);
    });
    return map;
  }, [entries]);

  // Memoize the stable onToggle callback
  const stableOnToggle = useCallback((habitId: string, date: string, completed: boolean) => {
    onToggle(habitId, date, completed);
  }, [onToggle]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4"
      contentContainerStyle={{ paddingRight: 16 }}
    >
      <View>
        <GridHeader days={days} colors={colors} />
        {habits.map(habit => (
          <HabitRow
            key={habit.id}
            habit={habit}
            days={days}
            entriesMap={entriesMap}
            colors={colors}
            onToggle={stableOnToggle}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}
        {/* Weekly stats footer can go here if needed, but we have summary cards now */}
      </View>
    </ScrollView>
  );
});

HabitGridMobile.displayName = 'HabitGridMobile';
