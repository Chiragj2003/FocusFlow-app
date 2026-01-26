import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Habit {
  id: string;
  title: string;
  color: string;
  goalType: string;
  goalTarget?: number | null;
  unit?: string | null;
  category?: string | null;
}

interface Entry {
  id: string;
  habitId: string;
  entryDate: string;
  completed: boolean;
  value?: number | null;
  notes?: string | null;
}

interface HabitGridMobileProps {
  habits: Habit[];
  entries: Entry[];
  days: string[]; // ISO date strings for the current month
  onToggle: (habitId: string, date: string, completed: boolean) => void;
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
        backgroundColor: completed ? (color || primaryColor) : 'transparent',
        borderWidth: 2,
        borderColor: color || primaryColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {completed && <Ionicons name="checkmark" size={20} color="#fff" />}
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
  onToggle
}: {
  habit: Habit;
  days: string[];
  entriesMap: Map<string, Entry>;
  colors: any;
  onToggle: (habitId: string, date: string, completed: boolean) => void;
}) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Text
        style={{ width: 100, color: colors.text }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {habit.title}
      </Text>
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
            color={habit.color}
            primaryColor={colors.primary}
            onToggle={onToggle}
          />
        );
      })}
    </View>
  );
});

HabitRow.displayName = 'HabitRow';

// Memoized header component
const GridHeader = memo(({ days, colors }: { days: string[]; colors: any }) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ width: 100, fontWeight: 'bold', color: colors.text }}>Habit</Text>
      {days.map(date => (
        <Text key={date} style={{ width: 36, textAlign: 'center', color: colors.textMuted }}>
          {new Date(date).getDate()}
        </Text>
      ))}
    </View>
  );
});

GridHeader.displayName = 'GridHeader';

export const HabitGridMobile: React.FC<HabitGridMobileProps> = memo(({
  habits,
  entries,
  days,
  onToggle,
  colors
}) => {
  // Create a lookup map for O(1) entry access instead of O(n) find operations
  const entriesMap = useMemo(() => {
    const map = new Map<string, Entry>();
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
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
          />
        ))}
      </View>
    </ScrollView>
  );
});

HabitGridMobile.displayName = 'HabitGridMobile';
