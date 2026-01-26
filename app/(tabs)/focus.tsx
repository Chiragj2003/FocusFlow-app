import { Habit } from '@/lib/api';
import { useCreateFocusSession, useFocusStats, useHabits } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Preset durations in minutes
const PRESETS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export default function FocusTimerScreen() {
  const { isDark, colors } = useTheme();
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [showHabitPicker, setShowHabitPicker] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const { data: habits } = useHabits(true);
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useFocusStats();
  const createSession = useCreateFocusSession();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  // Start timer
  const startTimer = useCallback(() => {
    if (timerState === 'idle') {
      setTimeLeft(duration * 60);
      startTimeRef.current = Date.now();
    } else if (timerState === 'paused') {
      startTimeRef.current = Date.now() - (duration * 60 - timeLeft) * 1000;
    }
    
    setTimerState('running');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [duration, timeLeft, timerState]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    setTimerState('paused');
    pausedTimeRef.current = timeLeft;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [timeLeft]);

  // Reset timer
  const resetTimer = useCallback(() => {
    setTimerState('idle');
    setTimeLeft(duration * 60);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [duration]);

  // Complete session and save
  const completeSession = useCallback(async () => {
    const actualDuration = duration * 60 - timeLeft;
    
    try {
      await createSession.mutateAsync({
        habitId: selectedHabitId || undefined,
        duration: actualDuration,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchStats();
      
      Alert.alert(
        '🎉 Session Complete!',
        `Great focus! You completed ${Math.floor(actualDuration / 60)} minutes of focused work.`,
        [{ text: 'OK', onPress: resetTimer }]
      );
    } catch (error) {
      console.error('Failed to save session:', error);
      Alert.alert('Error', 'Failed to save session. Please try again.');
    }
  }, [duration, timeLeft, selectedHabitId, createSession, refetchStats, resetTimer]);

  // Timer effect
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerState('completed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState]);

  // Handle completion
  useEffect(() => {
    if (timerState === 'completed') {
      completeSession();
    }
  }, [timerState]);

  // Update timeLeft when duration changes (only in idle state)
  useEffect(() => {
    if (timerState === 'idle') {
      setTimeLeft(duration * 60);
    }
  }, [duration, timerState]);

  const selectedHabit = habits?.find((h: Habit) => h.id === selectedHabitId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="px-6 pt-2 pb-4">
          <Text style={{ color: colors.text }} className="text-2xl font-bold">Focus Timer</Text>
          <Text style={{ color: colors.textMuted }} className="mt-1">Stay focused and productive</Text>
        </View>

        {/* Timer Display */}
        <View className="flex-1 items-center justify-center px-6 py-8">
          {/* Circular Progress */}
          <View className="relative w-64 h-64 items-center justify-center">
            {/* Background Circle */}
            <View style={{ borderColor: colors.border }} className="absolute w-full h-full rounded-full border-8" />
            
            {/* Progress Ring - Using a simple approach */}
            <View 
              className="absolute w-full h-full rounded-full border-8"
              style={{ 
                borderColor: colors.primary,
                opacity: timerState === 'idle' ? 0.3 : 1,
                transform: [{ rotate: '-90deg' }],
              }}
            />
            
            {/* Timer Text */}
            <View className="items-center">
              <Text style={{ color: colors.text }} className="text-5xl font-bold font-mono">
                {formatTime(timeLeft)}
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-2">
                {timerState === 'idle' ? 'Ready to focus' : 
                 timerState === 'running' ? 'Focusing...' :
                 timerState === 'paused' ? 'Paused' : 'Complete!'}
              </Text>
            </View>
          </View>

          {/* Linked Habit */}
          {timerState === 'idle' && (
            <Pressable
              onPress={() => setShowHabitPicker(!showHabitPicker)}
              style={{ backgroundColor: colors.surface }}
              className="mt-6 flex-row items-center px-4 py-3 rounded-xl"
            >
              <Ionicons 
                name="link-outline" 
                size={20} 
                color={selectedHabit ? selectedHabit.color : colors.textMuted} 
              />
              <Text style={{ color: colors.textMuted }} className="ml-2">
                {selectedHabit ? selectedHabit.title : 'Link to habit (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} className="ml-2" />
            </Pressable>
          )}

          {/* Habit Picker */}
          {showHabitPicker && timerState === 'idle' && (
            <View style={{ backgroundColor: colors.surface }} className="mt-2 w-full rounded-xl overflow-hidden">
              <Pressable
                onPress={() => {
                  setSelectedHabitId(null);
                  setShowHabitPicker(false);
                }}
                style={{ borderColor: colors.border }}
                className="flex-row items-center px-4 py-3 border-b"
              >
                <Text style={{ color: colors.textMuted }}>No linked habit</Text>
              </Pressable>
              {habits?.map((habit: Habit) => (
                <Pressable
                  key={habit.id}
                  onPress={() => {
                    setSelectedHabitId(habit.id);
                    setShowHabitPicker(false);
                  }}
                  style={{ borderColor: colors.border }}
                  className="flex-row items-center px-4 py-3 border-b"
                >
                  <View 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: habit.color }}
                  />
                  <Text style={{ color: colors.text }}>{habit.title}</Text>
                  {selectedHabitId === habit.id && (
                    <Ionicons name="checkmark" size={18} color={colors.success} style={{ marginLeft: 'auto' }} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Duration Presets - Only show when idle */}
        {timerState === 'idle' && (
          <View className="px-6 pb-4">
            <Text style={{ color: colors.textMuted }} className="text-sm mb-3">Duration</Text>
            <View className="flex-row gap-2">
              {PRESETS.map(preset => (
                <Pressable
                  key={preset.value}
                  onPress={() => setDuration(preset.value)}
                  style={{ 
                    backgroundColor: duration === preset.value ? colors.primary : colors.surface 
                  }}
                  className="flex-1 py-3 rounded-xl items-center"
                >
                  <Text style={{ 
                    color: duration === preset.value ? '#ffffff' : colors.textMuted,
                    fontWeight: '500'
                  }}>
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Control Buttons */}
        <View className="px-6 pb-8">
          {timerState === 'idle' ? (
            <Pressable
              onPress={startTimer}
              style={{ backgroundColor: colors.primary }}
              className="py-4 rounded-xl items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="play" size={24} color="#fff" />
                <Text className="text-white font-bold text-lg ml-2">Start Focus</Text>
              </View>
            </Pressable>
          ) : timerState === 'running' ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={pauseTimer}
                style={{ backgroundColor: colors.surface }}
                className="flex-1 py-4 rounded-xl items-center"
              >
                <View className="flex-row items-center">
                  <Ionicons name="pause" size={24} color={colors.text} />
                  <Text style={{ color: colors.text }} className="font-bold text-lg ml-2">Pause</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={resetTimer}
                style={{ backgroundColor: colors.surface }}
                className="px-6 py-4 rounded-xl items-center justify-center"
              >
                <Ionicons name="stop" size={24} color={colors.error} />
              </Pressable>
            </View>
          ) : timerState === 'paused' ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={startTimer}
                style={{ backgroundColor: colors.primary }}
                className="flex-1 py-4 rounded-xl items-center"
              >
                <View className="flex-row items-center">
                  <Ionicons name="play" size={24} color="#fff" />
                  <Text className="text-white font-bold text-lg ml-2">Resume</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={resetTimer}
                style={{ backgroundColor: colors.surface }}
                className="px-6 py-4 rounded-xl items-center justify-center"
              >
                <Ionicons name="refresh" size={24} color={colors.text} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Stats Section */}
        <View className="px-6 pb-8">
          <Text style={{ color: colors.text }} className="text-lg font-semibold mb-4">Your Focus Stats</Text>
          
          {statsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View className="flex-row flex-wrap gap-3">
              <View style={{ backgroundColor: colors.surface }} className="flex-1 min-w-[45%] p-4 rounded-xl">
                <Ionicons name="time-outline" size={24} color={colors.primary} />
                <Text style={{ color: colors.text }} className="text-2xl font-bold mt-2">
                  {stats?.todayMinutes || 0}
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">Minutes Today</Text>
              </View>
              
              <View style={{ backgroundColor: colors.surface }} className="flex-1 min-w-[45%] p-4 rounded-xl">
                <Ionicons name="calendar-outline" size={24} color={colors.success} />
                <Text style={{ color: colors.text }} className="text-2xl font-bold mt-2">
                  {stats?.weekMinutes || 0}
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">Minutes This Week</Text>
              </View>
              
              <View style={{ backgroundColor: colors.surface }} className="flex-1 min-w-[45%] p-4 rounded-xl">
                <Ionicons name="flash-outline" size={24} color={colors.warning} />
                <Text style={{ color: colors.text }} className="text-2xl font-bold mt-2">
                  {stats?.totalSessions || 0}
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">Total Sessions</Text>
              </View>
              
              <View style={{ backgroundColor: colors.surface }} className="flex-1 min-w-[45%] p-4 rounded-xl">
                <Ionicons name="trophy-outline" size={24} color="#a855f7" />
                <Text style={{ color: colors.text }} className="text-2xl font-bold mt-2">
                  {stats?.longestSession || 0}
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">Longest (min)</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
