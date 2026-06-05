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
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Habit colors matching the web app
const habitColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];

// Categories
const categories = ['Health', 'Learning', 'Mindfulness', 'Productivity', 'Fitness', 'Other'];

// Local fallback colors and patterns for guest/offline AI habit generation
const LOCAL_CATEGORY_COLORS: Record<string, string> = {
  Health: '#22c55e',
  Fitness: '#ef4444',
  Mindfulness: '#a855f7',
  Learning: '#3b82f6',
  Productivity: '#f59e0b',
  Social: '#ec4899',
  Creative: '#8b5cf6',
  Other: '#71717a',
};

const LOCAL_HABIT_PATTERNS = [
  {
    keywords: ['water', 'drink', 'hydrate', 'hydration'],
    habit: {
      title: 'Stay Hydrated',
      description: 'Drink enough water to keep your body healthy and energized',
      category: 'Health',
      color: LOCAL_CATEGORY_COLORS.Health,
      goalType: 'quantity' as const,
      goalTarget: 8,
      unit: 'glasses',
    },
  },
  {
    keywords: ['meditate', 'meditation', 'mindful', 'calm', 'peace'],
    habit: {
      title: 'Daily Meditation',
      description: 'Take time to calm your mind and practice mindfulness',
      category: 'Mindfulness',
      color: LOCAL_CATEGORY_COLORS.Mindfulness,
      goalType: 'duration' as const,
      goalTarget: 10,
      unit: 'minutes',
    },
  },
  {
    keywords: ['read', 'book', 'reading', 'literature'],
    habit: {
      title: 'Read Daily',
      description: 'Expand your knowledge through consistent reading',
      category: 'Learning',
      color: LOCAL_CATEGORY_COLORS.Learning,
      goalType: 'duration' as const,
      goalTarget: 30,
      unit: 'minutes',
    },
  },
  {
    keywords: ['exercise', 'workout', 'gym', 'fitness', 'train'],
    habit: {
      title: 'Daily Exercise',
      description: 'Stay fit and healthy with regular physical activity',
      category: 'Fitness',
      color: LOCAL_CATEGORY_COLORS.Fitness,
      goalType: 'duration' as const,
      goalTarget: 30,
      unit: 'minutes',
    },
  },
  {
    keywords: ['walk', 'steps', 'walking', 'stroll'],
    habit: {
      title: 'Daily Walk',
      description: 'Get moving with a refreshing daily walk',
      category: 'Fitness',
      color: LOCAL_CATEGORY_COLORS.Fitness,
      goalType: 'quantity' as const,
      goalTarget: 10000,
      unit: 'steps',
    },
  },
  {
    keywords: ['sleep', 'rest', 'bed', 'early'],
    habit: {
      title: 'Quality Sleep',
      description: 'Prioritize rest for better health and productivity',
      category: 'Health',
      color: LOCAL_CATEGORY_COLORS.Health,
      goalType: 'duration' as const,
      goalTarget: 8,
      unit: 'hours',
    },
  },
  {
    keywords: ['journal', 'write', 'diary', 'gratitude', 'reflect'],
    habit: {
      title: 'Daily Journaling',
      description: 'Reflect on your day and cultivate gratitude',
      category: 'Mindfulness',
      color: LOCAL_CATEGORY_COLORS.Mindfulness,
      goalType: 'binary' as const,
    },
  },
  {
    keywords: ['yoga', 'stretch', 'flexibility'],
    habit: {
      title: 'Practice Yoga',
      description: 'Improve flexibility and mental clarity through yoga',
      category: 'Fitness',
      color: LOCAL_CATEGORY_COLORS.Fitness,
      goalType: 'duration' as const,
      goalTarget: 20,
      unit: 'minutes',
    },
  },
  {
    keywords: ['learn', 'study', 'course', 'skill', 'language'],
    habit: {
      title: 'Learn Something New',
      description: 'Invest in yourself by learning daily',
      category: 'Learning',
      color: LOCAL_CATEGORY_COLORS.Learning,
      goalType: 'duration' as const,
      goalTarget: 15,
      unit: 'minutes',
    },
  },
  {
    keywords: ['code', 'program', 'develop', 'coding'],
    habit: {
      title: 'Code Daily',
      description: 'Build your programming skills with daily practice',
      category: 'Learning',
      color: LOCAL_CATEGORY_COLORS.Learning,
      goalType: 'duration' as const,
      goalTarget: 30,
      unit: 'minutes',
    },
  },
  {
    keywords: ['save', 'money', 'budget', 'invest'],
    habit: {
      title: 'Track Finances',
      description: 'Stay on top of your financial goals',
      category: 'Other',
      color: LOCAL_CATEGORY_COLORS.Other,
      goalType: 'binary' as const,
    },
  },
  {
    keywords: ['healthy', 'eat', 'nutrition', 'vegetable', 'fruit', 'diet'],
    habit: {
      title: 'Eat Healthy',
      description: 'Nourish your body with nutritious food choices',
      category: 'Health',
      color: LOCAL_CATEGORY_COLORS.Health,
      goalType: 'quantity' as const,
      goalTarget: 5,
      unit: 'servings',
    },
  },
  {
    keywords: ['social', 'friend', 'family', 'call', 'connect'],
    habit: {
      title: 'Stay Connected',
      description: 'Maintain meaningful relationships with loved ones',
      category: 'Other',
      color: LOCAL_CATEGORY_COLORS.Other,
      goalType: 'binary' as const,
    },
  },
  {
    keywords: ['art', 'draw', 'paint', 'create', 'creative', 'music'],
    habit: {
      title: 'Creative Practice',
      description: 'Express yourself through creative activities',
      category: 'Creative',
      color: LOCAL_CATEGORY_COLORS.Creative,
      goalType: 'duration' as const,
      goalTarget: 20,
      unit: 'minutes',
    },
  },
  {
    keywords: ['focus', 'productive', 'work', 'task', 'deep'],
    habit: {
      title: 'Deep Focus Work',
      description: 'Accomplish more with dedicated focus time',
      category: 'Productivity',
      color: LOCAL_CATEGORY_COLORS.Productivity,
      goalType: 'duration' as const,
      goalTarget: 60,
      unit: 'minutes',
    },
  },
];

function generateHabitLocally(userInput: string) {
  const lowerInput = userInput.toLowerCase();
  
  for (const pattern of LOCAL_HABIT_PATTERNS) {
    if (pattern.keywords.some(keyword => lowerInput.includes(keyword))) {
      const numberMatch = userInput.match(/(\d+)/g);
      if (numberMatch && pattern.habit.goalTarget) {
        return {
          ...pattern.habit,
          goalTarget: parseInt(numberMatch[0], 10),
        };
      }
      return pattern.habit;
    }
  }
  
  const capitalizedInput = userInput.charAt(0).toUpperCase() + userInput.slice(1).toLowerCase();
  const shortTitle = capitalizedInput.split(' ').slice(0, 4).join(' ');
  
  return {
    title: shortTitle.length > 30 ? shortTitle.slice(0, 30) + '...' : shortTitle,
    description: `Make "${userInput}" a daily habit`,
    category: 'Other',
    color: LOCAL_CATEGORY_COLORS.Other,
    goalType: 'binary' as const,
  };
}

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
  const last5Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  }, []);

  const { start, end } = useMemo(() => {
    return {
      start: last5Days[0],
      end: last5Days[4],
    };
  }, [last5Days]);

  // Fetch data
  const { data: activeHabits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: archivedHabits, refetch: refetchArchived } = useHabits(false);
  const { data: entries, refetch: refetchEntries } = useEntries(start, end);

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

  // Fast toggle handler
  const handleToggleHabit = useCallback((habitId: string) => {
    const currentEntry = getTodayEntry(habitId);
    const newCompleted = !currentEntry?.completed;

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

    // Fire mutation - uses optimistic update for instant UI feedback
    toggleEntry.mutate(
      {
        habitId,
        entryDate: today,
        completed: newCompleted,
      },
      {
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

    setAIGenerating(true);
    try {
      if (isSignedIn) {
        const result = await generateWithAI.mutateAsync(aiPrompt);
        setAISuggestions(result.habits);
      } else {
        // Guest mode / offline: Use local fallback generation
        const suggestion = generateHabitLocally(aiPrompt);
        setAISuggestions([suggestion]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to generate habits:', error);
      Alert.alert('Error', 'Failed to generate habits. Please try again.');
    } finally {
      setAIGenerating(false);
    }
  }, [aiPrompt, isSignedIn, generateWithAI]);

  const handleAddAISuggestion = useCallback((suggestion: typeof aiSuggestions[0]) => {
    const titleNormalized = suggestion.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = activeHabits?.some((h: Habit) => h.title.trim().toLowerCase().replace(/\s+/g, ' ') === titleNormalized);
    if (isDuplicate) {
      Alert.alert('Duplicate Habit', `A habit named "${suggestion.title}" already exists.`);
      return;
    }

    // Update UI immediately
    setAISuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (aiSuggestions.length === 1) {
      setShowAIGenerator(false);
      setAIPrompt('');
    }

    createHabit.mutate({
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      color: suggestion.color,
      goalType: suggestion.goalType,
      goalTarget: suggestion.goalTarget,
      unit: suggestion.unit,
    }, {
      onError: (error: any) => {
        console.error('Failed to create habit from AI:', error);
        const serverMsg = error?.response?.data?.error || error?.response?.data?.details || error?.message;
        Alert.alert('Error', serverMsg || 'Failed to create habit. Please try again.');
      }
    });
  }, [createHabit, aiSuggestions, activeHabits]);

  const handleAddHabit = useCallback(() => {
    if (!newHabitTitle.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    const titleNormalized = newHabitTitle.trim().toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = activeHabits?.some((h: Habit) => h.title.trim().toLowerCase().replace(/\s+/g, ' ') === titleNormalized);
    if (isDuplicate) {
      Alert.alert('Duplicate Habit', 'A habit with this name already exists.');
      return;
    }

    // Reset form immediately
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

    createHabit.mutate({
      title: newHabitTitle.trim(),
      description: newHabitDescription.trim() || undefined,
      category: selectedCategory || undefined,
      color: selectedColor,
      goalType: goalType,
      goalTarget: goalTarget ? parseInt(goalTarget) : undefined,
      unit: goalUnit || undefined,
    }, {
      onError: (error: any) => {
        console.error('Failed to create habit:', error);
        const serverMsg = error?.response?.data?.error || error?.response?.data?.details || error?.message;
        Alert.alert('Error', serverMsg || 'Failed to create habit. Please try again.');
      }
    });
  }, [newHabitTitle, newHabitDescription, selectedCategory, selectedColor, goalType, goalTarget, goalUnit, createHabit, activeHabits]);

  const handleSelectTemplate = useCallback((template: HabitTemplate) => {
    const titleNormalized = template.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = activeHabits?.some((h: Habit) => h.title.trim().toLowerCase().replace(/\s+/g, ' ') === titleNormalized);
    if (isDuplicate) {
      Alert.alert('Duplicate Habit', `A habit named "${template.title}" already exists.`);
      return;
    }

    // Show confirmation with Save button
    Alert.alert(
      'Add Template',
      `Add "${template.title}" as a new habit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowTemplates(false);
            setIsModalOpen(false);

            createHabit.mutate({
              title: template.title,
              description: template.description,
              category: template.category,
              color: template.color,
              goalType: template.goalType,
              goalTarget: template.goalTarget,
              unit: template.unit,
            }, {
              onError: (error: any) => {
                console.error('Failed to create habit from template:', error);
                const serverMsg = error?.response?.data?.error || error?.response?.data?.details || error?.message;
                Alert.alert('Error', serverMsg || 'Failed to create habit. Please try again.');
              }
            });
          }
        },
      ]
    );
  }, [createHabit, activeHabits]);

  const handleArchiveHabit = useCallback((habit: Habit) => {
    Alert.alert(
      'Archive Habit',
      `Are you sure you want to archive "${habit.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => {
            archiveHabit.mutate(habit.id, {
              onError: () => Alert.alert('Error', 'Failed to archive habit.')
            });
          }
        },
      ]
    );
  }, [archiveHabit]);

  const handleRestoreHabit = useCallback((habit: Habit) => {
    restoreHabit.mutate(habit.id, {
      onError: () => Alert.alert('Error', 'Failed to restore habit.')
    });
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
          onPress: () => {
            deleteHabit.mutate(habit.id, {
              onError: () => Alert.alert('Error', 'Failed to delete habit.')
            });
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
          {/* Add Habit Button */}
          <Pressable
            onPress={() => setIsModalOpen(true)}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-blue-500/10 active:bg-blue-500/20"
          >
            <Ionicons name="add" size={16} color="#3b82f6" />
            <Text className="text-blue-400 font-medium text-sm">Add Habit</Text>
          </Pressable>

          {/* AI Create Button */}
          <Pressable
            onPress={() => {
              setShowAIGenerator(true);
              setIsModalOpen(true);
            }}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg bg-violet-500/10 active:bg-violet-500/20"
          >
            <Ionicons name="sparkles" size={16} color="#a78bfa" />
            <Text className="text-violet-400 font-medium text-sm">Add with AI</Text>
          </Pressable>

          {/* Templates Button */}
          <Pressable
            onPress={() => {
              setShowTemplates(true);
              setIsModalOpen(true);
            }}
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
            style={{ backgroundColor: colors.backgroundTertiary }}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg active:opacity-80"
          >
            <Ionicons name="filter" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="font-medium text-sm">Filter</Text>
          </Pressable>

          {/* Sort Button */}
          <Pressable
            style={{ backgroundColor: colors.backgroundTertiary }}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg active:opacity-80"
          >
            <Ionicons name="swap-vertical" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }} className="font-medium text-sm">Newest</Text>
          </Pressable>

          {/* Archive Toggle */}
          <Pressable
            onPress={() => setShowArchived(!showArchived)}
            style={{ 
              backgroundColor: showArchived ? colors.primary : colors.backgroundTertiary,
              borderColor: showArchived ? colors.primary : 'transparent'
            }}
            className="flex-row items-center space-x-2 px-3 py-2 rounded-lg border"
          >
            <Ionicons name="archive-outline" size={16} color={showArchived ? "#fff" : colors.textMuted} />
            <Text style={{ color: showArchived ? '#fff' : colors.textMuted }} className="font-medium text-sm">
              Archived ({archivedHabits?.length || 0})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Stats Summary - New Web Style */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="mb-6 flex-row justify-between p-4 rounded-xl border shadow-sm">
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
          <View className="flex-row items-center">
            {showArchived && (
              <Pressable
                onPress={() => setShowArchived(false)}
                className="mr-3 p-2 rounded-full bg-zinc-800 active:bg-zinc-700"
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
            )}
            <Text style={{ color: colors.text }} className="text-lg font-bold">
              {showArchived ? 'Archived Habits' : 'Your Habits'}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted }} className="text-sm">
            {habits?.length || 0} {habits?.length === 1 ? 'habit' : 'habits'}
          </Text>
        </View>

        {/* Habits Grid (web-like) - Showing last 5 days */}
        {!showArchived && habits && habits.length > 0 && entries && (
          <HabitGridMobile
            habits={habits}
            entries={entries}
            days={last5Days}
            onToggle={(habitId, date, completed) => {
              // Haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

              // Use mutation with optimistic update
              toggleEntry.mutate(
                { habitId, entryDate: date, completed },
                {
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
          {showArchived && habits && habits.length > 0 && (
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

                  {/* Right side actions or status */}
                  {showArchived ? (
                    <View className="flex-row items-center space-x-3 ml-2">
                      <Pressable 
                        onPress={() => handleRestoreHabit(habit)}
                        className="p-2 rounded-full bg-blue-500/10 active:bg-blue-500/20"
                        style={{ marginRight: 8 }}
                      >
                        <Ionicons name="refresh" size={20} color="#3b82f6" />
                      </Pressable>
                      <Pressable 
                        onPress={() => handleDeleteHabit(habit)}
                        className="p-2 rounded-full bg-red-500/10 active:bg-red-500/20"
                      >
                        <Ionicons name="trash" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  ) : (
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
                  )}
                </View>
              );
            })
          )}
          
          {showArchived && (
            <View className="items-center mt-2 pb-8">
              <Pressable
                onPress={() => setShowArchived(false)}
                style={{ backgroundColor: colors.backgroundTertiary, borderColor: colors.border }}
                className="flex-row items-center justify-center px-6 py-4 rounded-xl w-full border active:opacity-80 shadow-sm"
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={{ color: colors.text }} className="font-bold ml-2 text-base">Return to Main Habits</Text>
              </Pressable>
            </View>
          )}
          
          {(!habits || habits.length === 0) && !showArchived && (
            <View className="items-center py-12">
              <Ionicons name="add-circle-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-3 text-center">
                No habits yet
              </Text>
              <Pressable
                style={{ backgroundColor: colors.primary }}
                className="mt-4 px-6 py-3 rounded-xl shadow-sm"
                onPress={() => setIsModalOpen(true)}
              >
                <Text className="text-white font-bold">Add Your First Habit</Text>
              </Pressable>
            </View>
          )}

          {(!habits || habits.length === 0) && showArchived && (
            <View className="items-center py-8">
              <Ionicons name="archive-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-3 text-center">
                No archived habits
              </Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View style={{ backgroundColor: colors.background, borderTopColor: colors.border }} className="rounded-t-3xl p-6 border-t max-h-[90%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text }} className="text-xl font-bold">
                {showTemplates ? 'Choose Template' : showAIGenerator ? 'AI Habit Generator' : 'New Habit'}
              </Text>
              <Pressable onPress={() => {
                setShowTemplates(false);
                setShowAIGenerator(false);
                setAISuggestions([]);
                setAIPrompt('');
                setIsModalOpen(false);
              }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
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
                      style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }}
                      className="border rounded-xl px-4 py-3 text-base mb-4 min-h-[100px]"
                      placeholder="e.g., I want to be healthier and more productive. I work from home and want to establish a morning routine."
                      placeholderTextColor={colors.textMuted}
                      value={aiPrompt}
                      onChangeText={setAIPrompt}
                      multiline
                      textAlignVertical="top"
                    />

                    <Pressable
                      onPress={handleGenerateWithAI}
                      disabled={aiGenerating || !aiPrompt.trim()}
                      className={`rounded-xl py-4 items-center mb-4 flex-row justify-center ${aiGenerating || !aiPrompt.trim() ? '' : 'bg-gradient-to-r'}`}
                      style={{ backgroundColor: aiGenerating || !aiPrompt.trim() ? colors.backgroundTertiary : '#8b5cf6' }}
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
                      <View className="bg-indigo-500/10 rounded-xl p-3 mb-4 border border-indigo-500/20">
                        <Text className="text-indigo-400 text-sm text-center">
                          Offline Mode: Using local AI pattern matching
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
                        style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border }}
                        className="rounded-xl p-4 mb-3 border"
                      >
                        <View className="flex-row items-start">
                          <View
                            className="w-4 h-4 rounded-full mt-1 mr-3"
                            style={{ backgroundColor: suggestion.color }}
                          />
                          <View className="flex-1">
                            <Text style={{ color: colors.text }} className="font-medium">{suggestion.title}</Text>
                            <Text style={{ color: colors.textSecondary }} className="text-xs mt-1">{suggestion.description}</Text>
                            <View className="flex-row items-center mt-2">
                              <View style={{ backgroundColor: colors.backgroundTertiary }} className="px-2 py-1 rounded-full mr-2">
                                <Text style={{ color: colors.textMuted }} className="text-xs">{suggestion.category}</Text>
                              </View>
                              <View style={{ backgroundColor: colors.backgroundTertiary }} className="px-2 py-1 rounded-full">
                                <Text style={{ color: colors.textMuted }} className="text-xs">
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
                      style={{ backgroundColor: colors.backgroundSecondary }}
                      className="rounded-xl py-3 items-center mt-2 mb-4"
                    >
                      <Text style={{ color: colors.textMuted }}>Generate new suggestions</Text>
                    </Pressable>
                  </>
                )}

                <Pressable
                  onPress={() => setShowAIGenerator(false)}
                  style={{ backgroundColor: colors.backgroundSecondary }}
                  className="rounded-xl py-3 items-center mb-4"
                >
                  <Text style={{ color: colors.textMuted }}>Back to manual creation</Text>
                </Pressable>
              </ScrollView>
            ) : showTemplates ? (
              /* Template Picker */
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[500px]">
                {/* Template Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <Pressable
                    onPress={() => setSelectedTemplateCategory(null)}
                    style={{ backgroundColor: !selectedTemplateCategory ? colors.text : colors.backgroundSecondary }}
                    className="px-4 py-2 rounded-xl mr-2"
                  >
                    <Text style={{ color: !selectedTemplateCategory ? colors.background : colors.textMuted }} className="font-medium">All</Text>
                  </Pressable>
                  {getTemplateCategories().map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedTemplateCategory(cat)}
                      style={{ backgroundColor: selectedTemplateCategory === cat ? colors.text : colors.backgroundSecondary }}
                      className="px-4 py-2 rounded-xl mr-2"
                    >
                      <Text style={{ color: selectedTemplateCategory === cat ? colors.background : colors.textMuted }} className="font-medium">{cat}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Template List with Save buttons */}
                {HABIT_TEMPLATES
                  .filter(t => !selectedTemplateCategory || t.category === selectedTemplateCategory)
                  .map((template) => (
                    <View
                      key={template.id}
                      style={{ backgroundColor: colors.backgroundSecondary }}
                      className="rounded-xl p-4 mb-3 flex-row items-center"
                    >
                      <Text className="text-2xl mr-3">{template.icon}</Text>
                      <View className="flex-1">
                        <Text style={{ color: colors.text }} className="font-medium">{template.title}</Text>
                        <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5">{template.description}</Text>
                        <View className="flex-row items-center mt-1">
                          <View style={{ backgroundColor: colors.backgroundTertiary }} className="px-2 py-0.5 rounded-full mr-2">
                            <Text style={{ color: colors.textMuted }} className="text-xs">{template.category}</Text>
                          </View>
                          {template.goalType !== 'binary' && (
                            <Text style={{ color: colors.textSecondary }} className="text-xs">
                              {template.goalTarget} {template.unit}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleSelectTemplate(template)}
                        disabled={createHabit.isPending}
                        className="bg-amber-400 px-4 py-2 rounded-lg ml-2"
                      >
                        {createHabit.isPending ? (
                          <ActivityIndicator color="#18181b" size="small" />
                        ) : (
                          <Text className="text-zinc-900 font-bold text-sm">Save</Text>
                        )}
                      </Pressable>
                    </View>
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
                    style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border }}
                    className="flex-1 border rounded-xl px-4 py-3 mr-2 flex-row items-center justify-center"
                  >
                    <Ionicons name="flash" size={18} color="#f59e0b" />
                    <Text style={{ color: colors.text }} className="ml-2 text-sm">Templates</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowAIGenerator(true)}
                    className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="sparkles" size={18} color="#a855f7" />
                    <Text className="text-purple-500 ml-2 text-sm font-medium">AI Generate</Text>
                  </Pressable>
                </View>

                {/* Habit Title Input */}
                <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Habit Name *</Text>
                <TextInput
                  style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }}
                  className="border rounded-xl px-4 py-3 text-base mb-4"
                  placeholder="e.g., Morning Exercise"
                  placeholderTextColor={colors.textMuted}
                  value={newHabitTitle}
                  onChangeText={setNewHabitTitle}
                />

                {/* Description Input */}
                <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Description (optional)</Text>
                <TextInput
                  style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }}
                  className="border rounded-xl px-4 py-3 text-base mb-4"
                  placeholder="Add details about this habit"
                  placeholderTextColor={colors.textMuted}
                  value={newHabitDescription}
                  onChangeText={setNewHabitDescription}
                  multiline
                />

                {/* Goal Type */}
                <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Goal Type</Text>
                <View className="flex-row mb-4">
                  {(['binary', 'duration', 'quantity'] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setGoalType(type)}
                      style={{ backgroundColor: goalType === type ? colors.text : colors.backgroundSecondary }}
                      className="flex-1 py-2.5 rounded-xl mr-2"
                    >
                      <Text style={{ color: goalType === type ? colors.background : colors.textMuted }} className="text-center text-sm font-medium">
                        {type === 'binary' ? 'Yes/No' : type === 'duration' ? 'Duration' : 'Count'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Goal Target (for duration/quantity) */}
                {goalType !== 'binary' && (
                  <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                      <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Target</Text>
                      <TextInput
                        style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }}
                        className="border rounded-xl px-4 py-3 text-base"
                        placeholder="e.g., 30"
                        placeholderTextColor={colors.textMuted}
                        value={goalTarget}
                        onChangeText={setGoalTarget}
                        keyboardType="numeric"
                      />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Unit</Text>
                      <TextInput
                        style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }}
                        className="border rounded-xl px-4 py-3 text-base"
                        placeholder={goalType === 'duration' ? 'minutes' : 'times'}
                        placeholderTextColor={colors.textMuted}
                        value={goalUnit}
                        onChangeText={setGoalUnit}
                      />
                    </View>
                  </View>
                )}

                {/* Category Picker */}
                <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      style={{ backgroundColor: selectedCategory === cat ? colors.text : colors.backgroundSecondary }}
                      className="px-4 py-2 rounded-xl mr-2"
                    >
                      <Text style={{ color: selectedCategory === cat ? colors.background : colors.textMuted }} className="font-medium">
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Color Picker */}
                <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2">Color</Text>
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
                  style={{ backgroundColor: createHabit.isPending ? colors.backgroundSecondary : colors.text }}
                  className="rounded-xl py-4 items-center mb-4"
                >
                  {createHabit.isPending ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={{ color: colors.background }} className="font-bold text-base">Add Habit</Text>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
