import { HabitGridMobile } from '@/components/HabitGridMobile';
import { useTheme } from '@/lib/ThemeContext';
import {
  getMonthDays,
  getMonthRange,
  getToday,
  useArchiveHabit,
  useCreateHabit,
  useDeleteHabit,
  useEntries,
  useGenerateHabitsWithAI,
  useHabits,
  useRestoreHabit,
  useToggleEntry
} from '@/lib/hooks';
import { HABIT_TEMPLATES, getTemplateCategories } from '@/lib/templates';
import type { Habit, HabitEntry, HabitTemplate } from '@/lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Habit colors matching the web app
const habitColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];

// Categories
const categories = ['Health', 'Learning', 'Mindfulness', 'Productivity', 'Fitness', 'Other'];

export default function HabitsScreen() {
  const { isDark, colors } = useTheme();
  const { isSignedIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiGenerating, setAIGenerating] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<Array<{
    title: string;
    description: string;
    category: string;
    color: string;
    goalType: 'binary' | 'duration' | 'quantity';
    goalTarget?: number;
    unit?: string;
  }>>([]);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string | null>(null);

  // Form state
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [goalType, setGoalType] = useState<'binary' | 'duration' | 'quantity'>('binary');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalUnit, setGoalUnit] = useState('');

  // Get current date info
  const today = getToday();
  const now = new Date();
  const { start, end } = getMonthRange(now.getFullYear(), now.getMonth());
  const monthDays = getMonthDays(now.getFullYear(), now.getMonth());

  // Fetch data
  const { data: activeHabits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: archivedHabits, refetch: refetchArchived } = useHabits(false);
  const { data: entries, refetch: refetchEntries } = useEntries(start, end);

  // Track in-progress toggle operations to prevent double-taps
  const pendingToggles = useRef<Set<string>>(new Set());

  // Mutations
  const createHabit = useCreateHabit();
  const archiveHabit = useArchiveHabit();
  const restoreHabit = useRestoreHabit();
  const deleteHabit = useDeleteHabit();
  const toggleEntry = useToggleEntry();
  const generateWithAI = useGenerateHabitsWithAI();

  const habits = showArchived ? archivedHabits : activeHabits;

  // Get today's entries for each habit - with memoized lookup for performance
  const entriesMap = useMemo(() => {
    if (!entries) return new Map<string, HabitEntry>();
    const map = new Map<string, HabitEntry>();
    entries.forEach((e: HabitEntry) => {
      map.set(`${e.habitId}-${e.entryDate}`, e);
    });
    return map;
  }, [entries]);

  const getTodayEntry = useCallback((habitId: string) => {
    return entriesMap.get(`${habitId}-${today}`);
  }, [entriesMap, today]);

  // Calculate completion stats
  const completedCount = useMemo(() => {
    return activeHabits?.filter((h: Habit) => {
      const entry = getTodayEntry(h.id);
      return entry?.completed;
    }).length || 0;
  }, [activeHabits, getTodayEntry]);

  const progressPercent = activeHabits && activeHabits.length > 0
    ? Math.round((completedCount / activeHabits.length) * 100)
    : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHabits(), refetchArchived(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchHabits, refetchArchived, refetchEntries]);

  // IMPROVED: Fast toggle handler with debounce protection
  const handleToggleHabit = useCallback((habitId: string) => {
    const toggleKey = `${habitId}-${today}`;

    // Prevent double-tap by checking if toggle is already in progress
    if (pendingToggles.current.has(toggleKey)) {
      console.log('Toggle already in progress for:', toggleKey);
      return;
    }

    const currentEntry = getTodayEntry(habitId);
    const newCompleted = !currentEntry?.completed;

    // Haptic feedback - fire and forget
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

    // Mark as pending
    pendingToggles.current.add(toggleKey);

    // Fire mutation - uses optimistic update for instant UI feedback
    toggleEntry.mutate(
      {
        habitId,
        entryDate: today,
        completed: newCompleted,
      },
      {
        onSettled: () => {
          // Clear pending state when done
          pendingToggles.current.delete(toggleKey);
        },
        onError: (error) => {
          console.error('Failed to toggle habit:', error);
          Alert.alert('Error', 'Failed to update habit. Please try again.');
        },
      }
    );
  }, [getTodayEntry, today, toggleEntry]);

  // AI Habit Generation
  const handleGenerateWithAI = useCallback(async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Error', 'Please describe the habits you want to build');
      return;
    }

    if (!isSignedIn) {
      Alert.alert('Sign In Required', 'AI habit generation requires signing in to your account.');
      return;
    }

    setAIGenerating(true);
    try {
      const result = await generateWithAI.mutateAsync(aiPrompt);
      setAISuggestions(result.habits);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to generate habits:', error);
      Alert.alert('Error', 'Failed to generate habits. Please try again.');
    } finally {
      setAIGenerating(false);
    }
  }, [aiPrompt, isSignedIn, generateWithAI]);

  const handleAddAISuggestion = useCallback(async (suggestion: typeof aiSuggestions[0]) => {
    try {
      await createHabit.mutateAsync({
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        color: suggestion.color,
        goalType: suggestion.goalType,
        goalTarget: suggestion.goalTarget,
        unit: suggestion.unit,
      });

      // Remove from suggestions
      setAISuggestions(prev => prev.filter(s => s.title !== suggestion.title));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (aiSuggestions.length === 1) {
        setShowAIGenerator(false);
        setAIPrompt('');
      }
    } catch (error) {
      console.error('Failed to create habit:', error);
      Alert.alert('Error', 'Failed to create habit. Please try again.');
    }
  }, [createHabit, aiSuggestions]);

  const handleAddHabit = useCallback(async () => {
    if (!newHabitTitle.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    try {
      await createHabit.mutateAsync({
        title: newHabitTitle.trim(),
        description: newHabitDescription.trim() || undefined,
        category: selectedCategory || undefined,
        color: selectedColor,
        goalType: goalType,
        goalTarget: goalTarget ? parseInt(goalTarget) : undefined,
        unit: goalUnit || undefined,
      });

      // Reset form
      setNewHabitTitle('');
      setNewHabitDescription('');
      setSelectedCategory('');
      setGoalType('binary');
      setGoalTarget('');
      setGoalUnit('');
      setShowTemplates(false);
      setShowAIGenerator(false);
      setAIPrompt('');
      setAISuggestions([]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create habit:', error);
      Alert.alert('Error', 'Failed to create habit. Please try again.');
    }
  }, [newHabitTitle, newHabitDescription, selectedCategory, selectedColor, goalType, goalTarget, goalUnit, createHabit]);

  const handleSelectTemplate = useCallback((template: HabitTemplate) => {
    setNewHabitTitle(template.title);
    setNewHabitDescription(template.description);
    setSelectedCategory(template.category);
    setSelectedColor(template.color);
    setGoalType(template.goalType);
    setGoalTarget(template.goalTarget?.toString() || '');
    setGoalUnit(template.unit || '');
    setShowTemplates(false);
  }, []);

  const handleArchiveHabit = useCallback((habit: Habit) => {
    Alert.alert(
      'Archive Habit',
      `Are you sure you want to archive "${habit.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await archiveHabit.mutateAsync(habit.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to archive habit.');
            }
          }
        },
      ]
    );
  }, [archiveHabit]);

  const handleRestoreHabit = useCallback(async (habit: Habit) => {
    try {
      await restoreHabit.mutateAsync(habit.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to restore habit.');
    }
  }, [restoreHabit]);

  const handleDeleteHabit = useCallback((habit: Habit) => {
    Alert.alert(
      'Delete Habit',
      `Are you sure you want to permanently delete "${habit.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit.mutateAsync(habit.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete habit.');
            }
          }
        },
      ]
    );
  }, [deleteHabit]);

  // Only show loading screen on first load when there's NO cached data
  // With our caching system, we should almost always have data immediately
  if (habitsLoading && !activeHabits && !refreshing) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted }} className="mt-4">Loading habits...</Text>
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
        <View className="flex-row items-center justify-between mb-4 mt-2">
          <View>
            <Text style={{ color: colors.text }} className="text-3xl font-bold">Habits</Text>
            <Text style={{ color: colors.textMuted }} className="text-base text-zinc-400">
              Track your daily habits and build consistency
            </Text>
          </View>
        </View>

        {/* Toolbar - Web Aligned */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6 flex-row"
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {/* AI Create Button */}
          <Pressable
            onPress={() => setShowAIGenerator(true)}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-violet-500/10 active:bg-violet-500/20"
          >
            <Ionicons name="sparkles" size={16} color="#a78bfa" />
            <Text className="text-violet-400 font-medium text-sm">Add with AI</Text>
          </Pressable>

          {/* Templates Button */}
          <Pressable
            onPress={() => setShowTemplates(true)}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-amber-400/10 active:bg-amber-400/20"
          >
            <Ionicons name="grid" size={16} color="#fbbf24" />
            <Text className="text-amber-400 font-medium text-sm">Templates</Text>
          </Pressable>

          {/* Challenges Button */}
          <Pressable
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-emerald-400/10 active:bg-emerald-400/20"
            // TODO: Implement challenges modal
            onPress={() => Alert.alert('Coming Soon', 'Challenges feature will be available soon!')}
          >
            <Ionicons name="trophy" size={16} color="#34d399" />
            <Text className="text-emerald-400 font-medium text-sm">Challenges</Text>
          </Pressable>

          {/* Timer Button */}
          <Pressable
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-rose-400/10 active:bg-rose-400/20"
            // TODO: Implement timer modal
            onPress={() => Alert.alert('Coming Soon', 'Focus timer feature will be available soon!')}
          >
            <Ionicons name="timer" size={16} color="#fb7185" />
            <Text className="text-rose-400 font-medium text-sm">Timer</Text>
          </Pressable>

          {/* Filter Button */}
          <Pressable
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-zinc-800 active:bg-zinc-700"
          >
            <Ionicons name="filter" size={16} color="#a1a1aa" />
            <Text className="text-zinc-400 font-medium text-sm">Filter</Text>
          </Pressable>

          {/* Sort Button */}
          <Pressable
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-zinc-800 active:bg-zinc-700"
          >
            <Ionicons name="swap-vertical" size={16} color="#a1a1aa" />
            <Text className="text-zinc-400 font-medium text-sm">Newest</Text>
          </Pressable>

          {/* Archive Toggle */}
          <Pressable
            onPress={() => setShowArchived(!showArchived)}
            className={`flex-row items-center space-x-2 px-3 py-2 rounded-lg border ${showArchived ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-800 border-transparent'
              }`}
          >
            <Ionicons name="archive-outline" size={16} color={showArchived ? "#fff" : "#a1a1aa"} />
            <Text className={`${showArchived ? 'text-white' : 'text-zinc-400'} font-medium text-sm`}>
              Archived ({archivedHabits?.length || 0})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Stats Summary - New Web Style */}
        <View className="mb-6 flex-row justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
          <View>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wider mb-1">Total Habits</Text>
            <Text style={{ color: colors.text }} className="text-2xl font-bold">{habits?.length || 0}</Text>
          </View>
          <View>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wider mb-1">Completed Today</Text>
            <Text style={{ color: colors.success }} className="text-2xl font-bold">{completedCount}</Text>
          </View>
          <View>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wider mb-1">Completion Rate</Text>
            <Text style={{ color: colors.primary }} className="text-2xl font-bold">
              {habits?.length ? Math.round((completedCount / habits.length) * 100) : 0}%
            </Text>
          </View>
        </View>

        {/* Habits List Header */}
        <View className="mt-6 flex-row items-center justify-between mb-2">
          <Text style={{ color: colors.text }} className="text-lg font-bold">
            {showArchived ? 'Archived Habits' : 'Your Habits'}
          </Text>
          <Text style={{ color: colors.textMuted }} className="text-sm">
            {habits?.length || 0} {habits?.length === 1 ? 'habit' : 'habits'}
          </Text>
        </View>

        {/* Habits Grid (web-like) */}
        {!showArchived && habits && habits.length > 0 && entries && (
          <HabitGridMobile
            habits={habits}
            entries={entries}
            days={monthDays}
            onToggle={(habitId, date, completed) => {
              const toggleKey = `${habitId}-${date}`;

              // Prevent double-tap
              if (pendingToggles.current.has(toggleKey)) {
                return;
              }

              // Haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

              // Mark as pending
              pendingToggles.current.add(toggleKey);

              // Use mutation with optimistic update
              toggleEntry.mutate(
                { habitId, entryDate: date, completed },
                {
                  onSettled: () => {
                    pendingToggles.current.delete(toggleKey);
                  },
                  onError: (error) => {
                    console.error('Failed to toggle habit in grid:', error);
                    Alert.alert('Error', 'Failed to update habit. Please try again.');
                  },
                }
              );
            }}
            colors={colors}
            onArchive={(habitId) => {
              Alert.alert('Archive Habit', 'Are you sure you want to archive this habit?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Archive', onPress: () => archiveHabit.mutate(habitId) }
              ]);
            }}
            onDelete={(habitId) => {
              Alert.alert('Delete Habit', 'Are you sure you want to delete this habit permanently?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteHabit.mutate(habitId) }
              ]);
            }}
          />
        )}

        {/* Habits List */}
        <View>
          {showArchived && habits && habits.length > 0 ? (
            habits.map((habit: Habit) => {
              const todayEntry = getTodayEntry(habit.id);
              const isCompleted = todayEntry?.completed || false;

              return (
                <View
                  key={habit.id}
                  style={{ backgroundColor: colors.surface, borderColor: isCompleted ? habit.color : colors.border }}
                  className="rounded-2xl border-2 p-4 mb-3 flex-row items-center"
                >
                  {/* Checkbox - Improved visibility with gradient on completion */}
                  {isCompleted ? (
                    <Pressable
                      onPress={() => {
                        if (!showArchived) {
                          handleToggleHabit(habit.id);
                        }
                      }}
                    >
                      <LinearGradient
                        colors={[habit.color || colors.primary, habit.color ? `${habit.color}dd` : colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                      >
                        <Ionicons name="checkmark" size={28} color="#fff" />
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (!showArchived) {
                          handleToggleHabit(habit.id);
                        }
                      }}
                      className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                      style={{
                        borderWidth: 3,
                        borderColor: habit.color || colors.primary,
                        backgroundColor: 'transparent'
                      }}
                    />
                  )}

                  {/* Habit Info - Pressable for long press actions */}
                  <Pressable
                    className="flex-1"
                    onPress={() => {
                      if (!showArchived) {
                        handleToggleHabit(habit.id);
                      }
                    }}
                    onLongPress={() => {
                      if (showArchived) {
                        Alert.alert(
                          habit.title,
                          'What would you like to do?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Restore', onPress: () => handleRestoreHabit(habit) },
                            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteHabit(habit) },
                          ]
                        );
                      } else {
                        Alert.alert(
                          habit.title,
                          'What would you like to do?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Archive', onPress: () => handleArchiveHabit(habit) },
                          ]
                        );
                      }
                    }}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        style={{
                          color: isCompleted ? colors.textMuted : colors.text,
                          textDecorationLine: isCompleted ? 'line-through' : 'none'
                        }}
                        className="text-lg font-semibold flex-1"
                      >
                        {habit.title}
                      </Text>
                      {isCompleted && (
                        <View style={{ backgroundColor: `${habit.color || colors.primary}20` }} className="px-3 py-1 rounded-full ml-2">
                          <Text style={{ color: habit.color || colors.primary }} className="text-xs font-bold">Done</Text>
                        </View>
                      )}
                    </View>
                    {habit.category && (
                      <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">{habit.category}</Text>
                    )}
                  </Pressable>

                  {/* Color indicator + Status */}
                  <View className="flex-row items-center">
                    {isCompleted && (
                      <View className="mr-2 px-2 py-1 rounded-full" style={{ backgroundColor: colors.success + '20' }}>
                        <Text style={{ color: colors.success }} className="text-xs font-medium">Done</Text>
                      </View>
                    )}
                    <View
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: habit.color || colors.primary }}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View className="items-center py-12">
              <Ionicons name={showArchived ? "archive-outline" : "add-circle-outline"} size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-3 text-center">
                {showArchived ? 'No archived habits' : 'No habits yet'}
              </Text>
              {!showArchived && (
                <Pressable
                  style={{ backgroundColor: colors.primary }}
                  className="mt-4 px-6 py-3 rounded-xl"
                  onPress={() => setIsModalOpen(true)}
                >
                  <Text className="text-white font-bold">Add Your First Habit</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-zinc-900 rounded-t-3xl p-6 border-t border-zinc-800 max-h-[90%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-white">
                {showTemplates ? 'Choose Template' : showAIGenerator ? 'AI Habit Generator' : 'New Habit'}
              </Text>
              <Pressable onPress={() => {
                setShowTemplates(false);
                setShowAIGenerator(false);
                setAISuggestions([]);
                setAIPrompt('');
                setIsModalOpen(false);
              }}>
                <Ionicons name="close" size={24} color="#71717a" />
              </Pressable>
            </View>

            {showAIGenerator ? (
              /* AI Habit Generator */
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[500px]">
                {aiSuggestions.length === 0 ? (
                  <>
                    <View className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-4 mb-4 border border-purple-500/30">
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="sparkles" size={20} color="#a855f7" />
                        <Text className="text-white font-semibold ml-2">AI-Powered Suggestions</Text>
                      </View>
                      <Text className="text-zinc-400 text-sm">
                        Describe your goals or lifestyle, and AI will suggest personalized habits for you.
                      </Text>
                    </View>

                    <Text className="text-sm font-medium text-zinc-400 mb-2">What habits would you like to build?</Text>
                    <TextInput
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base mb-4 min-h-[100px]"
                      placeholder="e.g., I want to be healthier and more productive. I work from home and want to establish a morning routine."
                      placeholderTextColor="#71717a"
                      value={aiPrompt}
                      onChangeText={setAIPrompt}
                      multiline
                      textAlignVertical="top"
                    />

                    <Pressable
                      onPress={handleGenerateWithAI}
                      disabled={aiGenerating || !aiPrompt.trim()}
                      className={`rounded-xl py-4 items-center mb-4 flex-row justify-center ${aiGenerating || !aiPrompt.trim() ? 'bg-zinc-700' : 'bg-gradient-to-r'
                        }`}
                      style={{ backgroundColor: aiGenerating || !aiPrompt.trim() ? '#3f3f46' : '#8b5cf6' }}
                    >
                      {aiGenerating ? (
                        <>
                          <ActivityIndicator color="#fff" />
                          <Text className="text-white font-bold text-base ml-2">Generating...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#fff" />
                          <Text className="text-white font-bold text-base ml-2">Generate Habits</Text>
                        </>
                      )}
                    </Pressable>

                    {!isSignedIn && (
                      <View className="bg-amber-500/20 rounded-xl p-3 mb-4 border border-amber-500/30">
                        <Text className="text-amber-400 text-sm text-center">
                          Sign in to use AI habit generation
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text className="text-zinc-400 text-sm mb-3">
                      Select habits to add to your list:
                    </Text>
                    {aiSuggestions.map((suggestion, index) => (
                      <View
                        key={index}
                        className="bg-zinc-800 rounded-xl p-4 mb-3 border border-zinc-700"
                      >
                        <View className="flex-row items-start">
                          <View
                            className="w-4 h-4 rounded-full mt-1 mr-3"
                            style={{ backgroundColor: suggestion.color }}
                          />
                          <View className="flex-1">
                            <Text className="text-white font-medium">{suggestion.title}</Text>
                            <Text className="text-zinc-500 text-xs mt-1">{suggestion.description}</Text>
                            <View className="flex-row items-center mt-2">
                              <View className="bg-zinc-700 px-2 py-1 rounded-full mr-2">
                                <Text className="text-zinc-400 text-xs">{suggestion.category}</Text>
                              </View>
                              <View className="bg-zinc-700 px-2 py-1 rounded-full">
                                <Text className="text-zinc-400 text-xs">
                                  {suggestion.goalType === 'binary' ? 'Yes/No' :
                                    suggestion.goalType === 'duration' ? `${suggestion.goalTarget} ${suggestion.unit}` :
                                      `${suggestion.goalTarget} ${suggestion.unit}`}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Pressable
                            onPress={() => handleAddAISuggestion(suggestion)}
                            disabled={createHabit.isPending}
                            className="bg-green-500 px-3 py-2 rounded-lg ml-2"
                          >
                            {createHabit.isPending ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Ionicons name="add" size={18} color="#fff" />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => {
                        setAISuggestions([]);
                        setAIPrompt('');
                      }}
                      className="bg-zinc-800 rounded-xl py-3 items-center mt-2 mb-4"
                    >
                      <Text className="text-zinc-400">Generate new suggestions</Text>
                    </Pressable>
                  </>
                )}

                <Pressable
                  onPress={() => setShowAIGenerator(false)}
                  className="bg-zinc-800 rounded-xl py-3 items-center mb-4"
                >
                  <Text className="text-zinc-400">Back to manual creation</Text>
                </Pressable>
              </ScrollView>
            ) : showTemplates ? (
              /* Template Picker */
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[500px]">
                {/* Template Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <Pressable
                    onPress={() => setSelectedTemplateCategory(null)}
                    className={`px-4 py-2 rounded-xl mr-2 ${!selectedTemplateCategory ? 'bg-white' : 'bg-zinc-800'}`}
                  >
                    <Text className={!selectedTemplateCategory ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>All</Text>
                  </Pressable>
                  {getTemplateCategories().map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedTemplateCategory(cat)}
                      className={`px-4 py-2 rounded-xl mr-2 ${selectedTemplateCategory === cat ? 'bg-white' : 'bg-zinc-800'}`}
                    >
                      <Text className={selectedTemplateCategory === cat ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>{cat}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Template List */}
                {HABIT_TEMPLATES
                  .filter(t => !selectedTemplateCategory || t.category === selectedTemplateCategory)
                  .map((template) => (
                    <Pressable
                      key={template.id}
                      onPress={() => handleSelectTemplate(template)}
                      className="bg-zinc-800 rounded-xl p-4 mb-3 flex-row items-center"
                    >
                      <Text className="text-2xl mr-3">{template.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-white font-medium">{template.title}</Text>
                        <Text className="text-zinc-500 text-xs mt-0.5">{template.category}</Text>
                      </View>
                      <View className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color }} />
                    </Pressable>
                  ))}

                <Pressable
                  onPress={() => setShowTemplates(false)}
                  className="bg-zinc-800 rounded-xl py-3 items-center mt-2 mb-4"
                >
                  <Text className="text-zinc-400">Or create custom habit</Text>
                </Pressable>
              </ScrollView>
            ) : (
              /* Custom Habit Form */
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Quick Action Buttons */}
                <View className="flex-row mb-4">
                  <Pressable
                    onPress={() => setShowTemplates(true)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 mr-2 flex-row items-center justify-center"
                  >
                    <Ionicons name="flash" size={18} color="#f59e0b" />
                    <Text className="text-zinc-300 ml-2 text-sm">Templates</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowAIGenerator(true)}
                    className="flex-1 bg-purple-500/20 border border-purple-500/30 rounded-xl px-4 py-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="sparkles" size={18} color="#a855f7" />
                    <Text className="text-purple-400 ml-2 text-sm">AI Generate</Text>
                  </Pressable>
                </View>

                {/* Habit Title Input */}
                <Text className="text-sm font-medium text-zinc-400 mb-2">Habit Name *</Text>
                <TextInput
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base mb-4"
                  placeholder="e.g., Morning Exercise"
                  placeholderTextColor="#71717a"
                  value={newHabitTitle}
                  onChangeText={setNewHabitTitle}
                />

                {/* Description Input */}
                <Text className="text-sm font-medium text-zinc-400 mb-2">Description (optional)</Text>
                <TextInput
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base mb-4"
                  placeholder="Add details about this habit"
                  placeholderTextColor="#71717a"
                  value={newHabitDescription}
                  onChangeText={setNewHabitDescription}
                  multiline
                />

                {/* Goal Type */}
                <Text className="text-sm font-medium text-zinc-400 mb-2">Goal Type</Text>
                <View className="flex-row mb-4">
                  {(['binary', 'duration', 'quantity'] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setGoalType(type)}
                      className={`flex-1 py-2.5 rounded-xl mr-2 ${goalType === type ? 'bg-white' : 'bg-zinc-800'}`}
                    >
                      <Text className={`text-center text-sm ${goalType === type ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                        {type === 'binary' ? 'Yes/No' : type === 'duration' ? 'Duration' : 'Count'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Goal Target (for duration/quantity) */}
                {goalType !== 'binary' && (
                  <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-medium text-zinc-400 mb-2">Target</Text>
                      <TextInput
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base"
                        placeholder="e.g., 30"
                        placeholderTextColor="#71717a"
                        value={goalTarget}
                        onChangeText={setGoalTarget}
                        keyboardType="numeric"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-zinc-400 mb-2">Unit</Text>
                      <TextInput
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base"
                        placeholder={goalType === 'duration' ? 'minutes' : 'times'}
                        placeholderTextColor="#71717a"
                        value={goalUnit}
                        onChangeText={setGoalUnit}
                      />
                    </View>
                  </View>
                )}

                {/* Category Picker */}
                <Text className="text-sm font-medium text-zinc-400 mb-2">Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      className={`px-4 py-2 rounded-xl mr-2 ${selectedCategory === cat ? 'bg-white' : 'bg-zinc-800'}`}
                    >
                      <Text className={selectedCategory === cat ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Color Picker */}
                <Text className="text-sm font-medium text-zinc-400 mb-2">Color</Text>
                <View className="flex-row flex-wrap mb-6">
                  {habitColors.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      className="w-10 h-10 rounded-xl mr-2 mb-2 items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && (
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      )}
                    </Pressable>
                  ))}
                </View>

                {/* Add Button */}
                <Pressable
                  onPress={handleAddHabit}
                  disabled={createHabit.isPending}
                  className={`rounded-xl py-4 items-center mb-4 ${createHabit.isPending ? 'bg-zinc-700' : 'bg-white'}`}
                >
                  {createHabit.isPending ? (
                    <ActivityIndicator color="#18181b" />
                  ) : (
                    <Text className="text-zinc-900 font-bold text-base">Add Habit</Text>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
