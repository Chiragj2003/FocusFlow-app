import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit, HabitEntry } from '@/lib/types';
import { Tap } from '@/components/ui/Tap';

interface HabitGridMobileProps {
  habits: Habit[];
  entries: HabitEntry[];
  days: string[]; // ISO dates, oldest first
  onToggle: (habitId: string, date: string, completed: boolean) => void;
  /** Opens the manage sheet (archive / delete) for a habit */
  onManage?: (habit: Habit) => void;
  colors: any;
}

const CELL = 34;

const DayCell = memo(({
  habitId,
  habitTitle,
  date,
  completed,
  isToday,
  color,
  emptyBg,
  emptyBorder,
  todayBorder,
  onToggle,
}: {
  habitId: string;
  habitTitle: string;
  date: string;
  completed: boolean;
  isToday: boolean;
  color: string;
  emptyBg: string;
  emptyBorder: string;
  todayBorder: string;
  onToggle: (habitId: string, date: string, completed: boolean) => void;
}) => {
  const handlePress = useCallback(() => {
    onToggle(habitId, date, !completed);
  }, [habitId, date, completed, onToggle]);

  return (
    <Tap
      onPress={handlePress}
      hitSlop={3}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${habitTitle}, ${date}`}
      pressedStyle={{ transform: [{ scale: 0.9 }] }}
      style={{
        width: CELL,
        height: CELL,
        marginHorizontal: 2,
        borderRadius: CELL / 2,
        backgroundColor: completed ? color : emptyBg,
        borderWidth: completed ? 0 : 1.5,
        borderColor: isToday ? todayBorder : emptyBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {completed && <Ionicons name="checkmark" size={18} color="#ffffff" />}
    </Tap>
  );
});
DayCell.displayName = 'DayCell';

const HabitRow = memo(({
  habit,
  days,
  todayKey,
  completionsString,
  colors,
  onToggle,
  onManage,
}: {
  habit: Habit;
  days: string[];
  todayKey: string;
  completionsString: string;
  colors: any;
  onToggle: (habitId: string, date: string, completed: boolean) => void;
  onManage?: (habit: Habit) => void;
}) => {
  const color = habit.color || colors.primary;
  const manage = useCallback(() => onManage?.(habit), [habit, onManage]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Pressable
        onPress={manage}
        onLongPress={manage}
        accessibilityRole="button"
        accessibilityLabel={`${habit.title}, manage`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6, minWidth: 0 }}
      >
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 }} numberOfLines={2}>
          {habit.title}
        </Text>
        <Ionicons name="ellipsis-horizontal" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
      </Pressable>

      <View style={{ flexDirection: 'row' }}>
        {days.map((date, index) => (
          <DayCell
            key={date}
            habitId={habit.id}
            habitTitle={habit.title}
            date={date}
            completed={completionsString[index] === '1'}
            isToday={date === todayKey}
            color={color}
            emptyBg={colors.backgroundSecondary}
            emptyBorder={colors.border}
            todayBorder={colors.primary}
            onToggle={onToggle}
          />
        ))}
      </View>
    </View>
  );
});
HabitRow.displayName = 'HabitRow';

const GridHeader = memo(({ days, todayKey, colors }: { days: string[]; todayKey: string; colors: any }) => {
  const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', marginRight: 6 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8 }}>LAST 5 DAYS</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {days.map((date) => {
          // Parse as local date (avoid UTC shift from new Date('YYYY-MM-DD'))
          const [y, m, d] = date.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          const isToday = date === todayKey;
          return (
            <View key={date} style={{ width: CELL, marginHorizontal: 2, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{DAYS_SHORT[dt.getDay()]}</Text>
              <Text style={{ fontSize: 13, fontWeight: isToday ? '800' : '500', color: isToday ? colors.primary : colors.textSecondary }}>
                {d}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});
GridHeader.displayName = 'GridHeader';

export const HabitGridMobile: React.FC<HabitGridMobileProps> = memo(({ habits, entries, days, onToggle, onManage, colors }) => {
  const todayKey = days[days.length - 1];

  const entriesMap = useMemo(() => {
    const map = new Map<string, HabitEntry>();
    entries.forEach((entry) => {
      map.set(`${entry.habitId}-${entry.entryDate.split('T')[0]}`, entry);
    });
    return map;
  }, [entries]);

  const stableOnToggle = useCallback((habitId: string, date: string, completed: boolean) => {
    onToggle(habitId, date, completed);
  }, [onToggle]);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.cardBorder,
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 14,
      }}
    >
      <GridHeader days={days} todayKey={todayKey} colors={colors} />
      {habits.map((habit, i) => {
        const completionsString = days
          .map((date) => (entriesMap.get(`${habit.id}-${date}`)?.completed ? '1' : '0'))
          .join('');
        return (
          <View key={habit.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.cardBorder } : undefined}>
            <HabitRow
              habit={habit}
              days={days}
              todayKey={todayKey}
              completionsString={completionsString}
              colors={colors}
              onToggle={stableOnToggle}
              onManage={onManage}
            />
          </View>
        );
      })}
    </View>
  );
});
HabitGridMobile.displayName = 'HabitGridMobile';
