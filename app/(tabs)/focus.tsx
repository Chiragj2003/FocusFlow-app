import { Habit } from '@/lib/api';
import { useCreateFocusSession, useFocusStats, useHabits, useChallenges, useUserChallenges, useJoinChallenge } from '@/lib/hooks';
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
    TextInput,
    View,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

// Preset durations in minutes
const PRESETS = [
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '25m', value: 25 },
  { label: '45m', value: 45 },
  { label: '60m', value: 60 },
];

type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export default function FocusTimerScreen() {
  const { isDark, colors } = useTheme();
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [showHabitPicker, setShowHabitPicker] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const { data: habits } = useHabits(true);
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useFocusStats();
  const createSession = useCreateFocusSession();
  
  // Size the circle based on screen width so it's always perfectly centered and responsive
  const screenWidth = Dimensions.get('window').width;
  const size = Math.min(screenWidth * 0.75, 300); 
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

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
  const activeColor = selectedHabit ? selectedHabit.color : colors.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header matching habits.tsx */}
        <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
          <View>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">Focus Timer</Text>
            <Text style={{ color: colors.textMuted }} className="mt-1">Deep work makes the dream work</Text>
          </View>
        </View>

        {/* PERFECTLY CENTERED TIMER DISPLAY */}
        <View className="items-center justify-center my-8">
          <View style={{ width: size, height: size }}>
            {/* SVG dictates the size */}
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
              {/* Background Track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={isDark ? '#27272a' : '#e4e4e7'}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Foreground Animated Track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={activeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={timerState === 'idle' ? 0 : circumference - (progress / 100) * circumference}
                strokeLinecap="round"
                opacity={timerState === 'idle' ? 0.3 : 1}
              />
            </Svg>
            
            {/* Centered Text Container laid perfectly over the SVG */}
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text 
                style={{ 
                  color: colors.text,
                  fontSize: 56,
                  lineHeight: 68,
                  paddingTop: 8,
                }} 
                className="font-bold font-mono tracking-tight"
              >
                {formatTime(timeLeft)}
              </Text>
              
              <View className="mt-2 flex-row items-center bg-zinc-500/10 px-3 py-1.5 rounded-full">
                <View 
                  className={`w-2 h-2 rounded-full mr-2 ${timerState === 'running' ? 'bg-green-500' : timerState === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'}`} 
                />
                <Text style={{ color: colors.text }} className="text-xs font-semibold uppercase tracking-widest">
                  {timerState === 'idle' ? 'Ready' : 
                   timerState === 'running' ? 'Focusing' :
                   timerState === 'paused' ? 'Paused' : 'Complete!'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Linked Habit & Presets matching habits.tsx aesthetic */}
        <View className="px-6">
          {timerState === 'idle' && (
            <>
              {/* Link Habit Button */}
              <Pressable
                onPress={() => setShowHabitPicker(!showHabitPicker)}
                className="flex-row items-center justify-between p-4 rounded-xl border mb-4"
                style={{ 
                  backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                  borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                }}
              >
                <View className="flex-row items-center">
                  <View 
                    style={{ backgroundColor: selectedHabit ? `${selectedHabit.color}20` : isDark ? '#3f3f46' : '#f4f4f5' }} 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  >
                    <Ionicons 
                      name={selectedHabit ? "link" : "add"} 
                      size={20} 
                      color={selectedHabit ? selectedHabit.color : colors.textMuted} 
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium mb-0.5">
                      Target Habit
                    </Text>
                    <Text style={{ color: selectedHabit ? colors.text : colors.textMuted }} className="font-semibold text-base">
                      {selectedHabit ? selectedHabit.title : 'None selected'}
                    </Text>
                  </View>
                </View>
                <Ionicons name={showHabitPicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
              </Pressable>

              {/* Habit Picker */}
              {showHabitPicker && (
                <View 
                  className="mb-4 rounded-xl border overflow-hidden"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                    borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setSelectedHabitId(null);
                      setShowHabitPicker(false);
                    }}
                    style={{ borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border }}
                    className="flex-row items-center px-4 py-3 border-b"
                  >
                    <View className="w-8 h-8 rounded-full bg-zinc-500/10 mr-3 items-center justify-center">
                      <Ionicons name="close" size={16} color={colors.textMuted} />
                    </View>
                    <Text style={{ color: colors.textMuted }} className="font-medium text-sm flex-1">Clear Selection</Text>
                    {!selectedHabitId && <Ionicons name="checkmark" size={20} color={colors.textMuted} />}
                  </Pressable>
                  
                  {habits?.map((habit: Habit) => (
                    <Pressable
                      key={habit.id}
                      onPress={() => {
                        setSelectedHabitId(habit.id);
                        setShowHabitPicker(false);
                      }}
                      style={{ borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border }}
                      className="flex-row items-center px-4 py-3 border-b last:border-b-0"
                    >
                      <View 
                        className="w-8 h-8 rounded-full mr-3 items-center justify-center"
                        style={{ backgroundColor: `${habit.color}20` }}
                      >
                        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                      </View>
                      <Text style={{ color: colors.text }} className="font-medium text-sm flex-1">{habit.title}</Text>
                      {selectedHabitId === habit.id && (
                        <Ionicons name="checkmark" size={20} color={habit.color} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Duration Presets */}
              {!showHabitPicker && (
                <View className="mb-6">
                  {isCustomMode ? (
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        value={customInput}
                        onChangeText={setCustomInput}
                        keyboardType="numeric"
                        placeholder="Minutes"
                        placeholderTextColor={colors.textMuted}
                        style={{ 
                          color: colors.text,
                          backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface,
                          borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border
                        }}
                        className="flex-1 p-3 rounded-xl border text-center font-bold"
                        maxLength={3}
                      />
                      <Pressable 
                        onPress={() => {
                          const val = parseInt(customInput, 10);
                          if (!isNaN(val) && val > 0) {
                            setDuration(val);
                          }
                          setIsCustomMode(false);
                          setCustomInput('');
                        }}
                        className="px-6 py-3 rounded-xl items-center justify-center"
                        style={{ backgroundColor: activeColor }}
                      >
                        <Text className="text-white font-bold">Set</Text>
                      </Pressable>
                      <Pressable 
                        onPress={() => setIsCustomMode(false)}
                        className="px-4 py-3 rounded-xl items-center justify-center border"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface,
                          borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border
                        }}
                      >
                        <Ionicons name="close" size={20} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {PRESETS.map(preset => {
                        const isSelected = duration === preset.value;
                        return (
                          <Pressable
                            key={preset.value}
                            onPress={() => setDuration(preset.value)}
                            className="flex-1 min-w-[50px] py-3 rounded-xl border items-center justify-center"
                            style={{ 
                              backgroundColor: isSelected ? `${activeColor}15` : isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface,
                              borderColor: isSelected ? activeColor : isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border
                            }}
                          >
                            <Text style={{ 
                              color: isSelected ? activeColor : colors.textMuted,
                              fontWeight: isSelected ? 'bold' : '500',
                              fontSize: 14
                            }}>
                              {preset.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      
                      {/* Custom Button */}
                      <Pressable
                        onPress={() => setIsCustomMode(true)}
                        className="flex-1 min-w-[60px] py-3 rounded-xl border items-center justify-center"
                        style={{ 
                          backgroundColor: (!PRESETS.find(p => p.value === duration)) ? `${activeColor}15` : isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface,
                          borderColor: (!PRESETS.find(p => p.value === duration)) ? activeColor : isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border
                        }}
                      >
                        <Text style={{ 
                          color: (!PRESETS.find(p => p.value === duration)) ? activeColor : colors.textMuted,
                          fontWeight: (!PRESETS.find(p => p.value === duration)) ? 'bold' : '500',
                          fontSize: 14
                        }}>
                          {(!PRESETS.find(p => p.value === duration)) ? `${duration}m` : 'Custom'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Clean Flat Buttons */}
          <View className="mb-8">
            {timerState === 'idle' ? (
              <Pressable 
                onPress={startTimer} 
                className="py-4 rounded-xl items-center justify-center flex-row"
                style={{ backgroundColor: activeColor }}
              >
                <Ionicons name="play" size={20} color="#ffffff" className="mr-2" />
                <Text className="text-white font-bold text-base tracking-wide">Start Focus</Text>
              </Pressable>
            ) : timerState === 'running' ? (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={pauseTimer}
                  style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.8)' : colors.surface }}
                  className="flex-1 py-4 rounded-xl items-center flex-row justify-center border border-zinc-200 dark:border-zinc-800"
                >
                  <Ionicons name="pause" size={20} color={colors.text} className="mr-2" />
                  <Text style={{ color: colors.text }} className="font-bold text-base tracking-wide">Pause</Text>
                </Pressable>
                <Pressable
                  onPress={resetTimer}
                  style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.8)' : colors.surface }}
                  className="px-6 py-4 rounded-xl items-center justify-center border border-zinc-200 dark:border-zinc-800"
                >
                  <Ionicons name="stop" size={20} color={colors.error} />
                </Pressable>
              </View>
            ) : timerState === 'paused' ? (
              <View className="flex-row gap-3">
                <Pressable 
                  onPress={startTimer} 
                  className="flex-1 py-4 rounded-xl items-center justify-center flex-row"
                  style={{ backgroundColor: colors.success }}
                >
                  <Ionicons name="play" size={20} color="#ffffff" className="mr-2" />
                  <Text className="text-white font-bold text-base tracking-wide">Resume</Text>
                </Pressable>
                <Pressable
                  onPress={resetTimer}
                  style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.8)' : colors.surface }}
                  className="px-6 py-4 rounded-xl items-center justify-center border border-zinc-200 dark:border-zinc-800"
                >
                  <Ionicons name="refresh" size={20} color={colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats Section */}
        {timerState === 'idle' && (
          <View className="px-6 pb-12">
            <Text style={{ color: colors.text }} className="text-lg font-bold mb-4">Focus Stats</Text>
            
            {statsLoading ? (
              <View className="py-4 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3">
                <View 
                  className="flex-1 min-w-[45%] p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                    borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                  }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-medium mb-1">Today</Text>
                  <View className="flex-row items-baseline">
                    <Text style={{ color: colors.text }} className="text-2xl font-bold mr-1">{stats?.todayMinutes || 0}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium">min</Text>
                  </View>
                </View>
                
                <View 
                  className="flex-1 min-w-[45%] p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                    borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                  }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-medium mb-1">This Week</Text>
                  <View className="flex-row items-baseline">
                    <Text style={{ color: colors.text }} className="text-2xl font-bold mr-1">{stats?.weekMinutes || 0}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium">min</Text>
                  </View>
                </View>
                
                <View 
                  className="flex-1 min-w-[45%] p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                    borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                  }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-medium mb-1">Sessions</Text>
                  <Text style={{ color: colors.text }} className="text-2xl font-bold">{stats?.totalSessions || 0}</Text>
                </View>
                
                <View 
                  className="flex-1 min-w-[45%] p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : colors.surface, 
                    borderColor: isDark ? 'rgba(63, 63, 70, 0.5)' : colors.border 
                  }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-medium mb-1">Longest</Text>
                  <View className="flex-row items-baseline">
                    <Text style={{ color: colors.text }} className="text-2xl font-bold mr-1">{stats?.longestSession || 0}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-medium">min</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
