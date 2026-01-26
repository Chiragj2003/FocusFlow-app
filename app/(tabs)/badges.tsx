import { Badge } from '@/lib/api';
import { useBadges, useStreaks } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// All possible badges with their requirements
const ALL_BADGES = [
  // Starter badges
  { id: 'first_habit', name: 'First Habit', icon: 'leaf', color: '#22c55e', description: 'Create your first habit', category: 'Getting Started' },
  { id: 'first_completion', name: 'First Step', icon: 'footsteps', color: '#3b82f6', description: 'Complete your first habit entry', category: 'Getting Started' },
  
  // Streak badges
  { id: '3_day_streak', name: '3 Day Streak', icon: 'flame', color: '#f97316', description: 'Maintain a 3-day streak', category: 'Streaks' },
  { id: 'week_warrior', name: 'Week Warrior', icon: 'flame', color: '#ef4444', description: 'Maintain a 7-day streak', category: 'Streaks' },
  { id: 'two_week_titan', name: 'Two Week Titan', icon: 'flame', color: '#dc2626', description: 'Maintain a 14-day streak', category: 'Streaks' },
  { id: 'monthly_master', name: 'Monthly Master', icon: 'flame', color: '#b91c1c', description: 'Maintain a 30-day streak', category: 'Streaks' },
  
  // Completion badges
  { id: '10_completions', name: '10 Completions', icon: 'checkmark-circle', color: '#22c55e', description: 'Complete 10 habit entries', category: 'Milestones' },
  { id: '50_completions', name: 'Half Century', icon: 'checkmark-done', color: '#16a34a', description: 'Complete 50 habit entries', category: 'Milestones' },
  { id: 'century_club', name: 'Century Club', icon: 'ribbon', color: '#15803d', description: 'Complete 100 habit entries', category: 'Milestones' },
  { id: '500_completions', name: 'High Achiever', icon: 'medal', color: '#166534', description: 'Complete 500 habit entries', category: 'Milestones' },
  
  // Focus badges
  { id: 'focus_starter', name: 'Focus Starter', icon: 'time', color: '#3b82f6', description: 'Complete your first focus session', category: 'Focus' },
  { id: 'focus_hour', name: 'Hour of Power', icon: 'hourglass', color: '#2563eb', description: 'Accumulate 60 minutes of focus time', category: 'Focus' },
  { id: 'focus_marathon', name: 'Focus Marathon', icon: 'stopwatch', color: '#1d4ed8', description: 'Accumulate 10 hours of focus time', category: 'Focus' },
  
  // Special badges
  { id: 'perfect_week', name: 'Perfect Week', icon: 'star', color: '#eab308', description: 'Complete all habits for 7 consecutive days', category: 'Special' },
  { id: 'early_bird', name: 'Early Bird', icon: 'sunny', color: '#fbbf24', description: 'Complete a habit before 7 AM', category: 'Special' },
  { id: 'night_owl', name: 'Night Owl', icon: 'moon', color: '#6366f1', description: 'Complete a habit after 10 PM', category: 'Special' },
  { id: 'comeback_kid', name: 'Comeback Kid', icon: 'refresh', color: '#a855f7', description: 'Resume tracking after a break', category: 'Special' },
];

// Get theme colors
const useCardColors = () => {
  const { colors } = useTheme();
  return colors;
};

// Badge card component
function BadgeCard({ 
  badge, 
  isUnlocked, 
  awardedAt 
}: { 
  badge: typeof ALL_BADGES[0];
  isUnlocked: boolean;
  awardedAt?: string;
}) {
  const colors = useCardColors();
  
  return (
    <View 
      style={{ 
        backgroundColor: isUnlocked ? colors.surface : colors.surface + '50',
        opacity: isUnlocked ? 1 : 0.6
      }}
      className="w-[48%] p-4 rounded-xl mb-3"
    >
      <View 
        className="w-14 h-14 rounded-xl items-center justify-center mb-3"
        style={{ 
          backgroundColor: isUnlocked ? `${badge.color}20` : colors.backgroundTertiary,
          opacity: isUnlocked ? 1 : 0.3
        }}
      >
        <Ionicons 
          name={badge.icon as any} 
          size={28} 
          color={isUnlocked ? badge.color : colors.textMuted} 
        />
      </View>
      
      <Text style={{ color: isUnlocked ? colors.text : colors.textMuted }} className="font-semibold">
        {badge.name}
      </Text>
      
      <Text style={{ color: isUnlocked ? colors.textMuted : colors.textMuted }} className="text-xs mt-1">
        {badge.description}
      </Text>
      
      {isUnlocked && awardedAt && (
        <Text style={{ color: colors.textMuted }} className="text-xs mt-2">
          {new Date(awardedAt).toLocaleDateString()}
        </Text>
      )}
      
      {!isUnlocked && (
        <View className="flex-row items-center mt-2">
          <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }} className="text-xs ml-1">Locked</Text>
        </View>
      )}
    </View>
  );
}

export default function BadgesScreen() {
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const { data: earnedBadges, isLoading, refetch } = useBadges();
  const { data: streaks } = useStreaks();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Check if a badge is unlocked
  const isBadgeUnlocked = (badgeId: string) => {
    if (!earnedBadges || !Array.isArray(earnedBadges)) return false;
    
    // Map badge names to IDs
    const nameToId: Record<string, string> = {
      'First Habit': 'first_habit',
      '3 Day Streak': '3_day_streak',
      'Week Warrior': 'week_warrior',
      'Monthly Master': 'monthly_master',
      '10 Completions': '10_completions',
      '50 Completions': '50_completions',
      'Century Club': 'century_club',
    };
    
    return earnedBadges.some((b: Badge) => {
      const id = nameToId[b.name] || b.name.toLowerCase().replace(/\s+/g, '_');
      return id === badgeId;
    });
  };

  const getBadgeAwardDate = (badgeId: string) => {
    if (!earnedBadges || !Array.isArray(earnedBadges)) return undefined;
    
    const nameToId: Record<string, string> = {
      'First Habit': 'first_habit',
      '3 Day Streak': '3_day_streak',
      'Week Warrior': 'week_warrior',
      'Monthly Master': 'monthly_master',
      '10 Completions': '10_completions',
      '50 Completions': '50_completions',
      'Century Club': 'century_club',
    };
    
    const badge = earnedBadges.find((b: Badge) => {
      const id = nameToId[b.name] || b.name.toLowerCase().replace(/\s+/g, '_');
      return id === badgeId;
    });
    
    return badge?.awardedAt;
  };

  // Group badges by category
  const categories = [...new Set(ALL_BADGES.map(b => b.category))];
  
  // Count stats
  const unlockedCount = ALL_BADGES.filter(b => isBadgeUnlocked(b.id)).length;
  const totalCount = ALL_BADGES.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View className="px-6 pt-2 pb-4">
        <Text style={{ color: colors.text }} className="text-2xl font-bold">Badges</Text>
        <Text style={{ color: colors.textMuted }} className="mt-1">Collect badges as you build habits</Text>
      </View>

      {/* Progress Banner */}
      <View style={{ backgroundColor: colors.surface }} className="mx-6 mb-6 rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Ionicons name="trophy" size={24} color={colors.warning} />
            <Text style={{ color: colors.text }} className="font-semibold ml-2">Your Progress</Text>
          </View>
          <Text style={{ color: colors.textMuted }}>
            {unlockedCount}/{totalCount} badges
          </Text>
        </View>
        
        <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-3 rounded-full overflow-hidden">
          <View 
            style={{ width: `${progressPercent}%`, backgroundColor: colors.warning }}
            className="h-full rounded-full"
          />
        </View>
        
        <Text style={{ color: colors.textMuted }} className="text-sm mt-2 text-center">
          {progressPercent}% complete
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          categories.map(category => {
            const categoryBadges = ALL_BADGES.filter(b => b.category === category);
            const unlockedInCategory = categoryBadges.filter(b => isBadgeUnlocked(b.id)).length;
            
            return (
              <View key={category} className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text style={{ color: colors.text }} className="text-lg font-semibold">{category}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-sm">
                    {unlockedInCategory}/{categoryBadges.length}
                  </Text>
                </View>
                
                <View className="flex-row flex-wrap justify-between">
                  {categoryBadges.map(badge => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      isUnlocked={isBadgeUnlocked(badge.id)}
                      awardedAt={getBadgeAwardDate(badge.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}
        
        {/* Current Streak Info */}
        {streaks && (
          <View style={{ backgroundColor: colors.surface }} className="rounded-xl p-4 mb-8">
            <Text style={{ color: colors.text }} className="font-semibold mb-3">🔥 Streak Progress</Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text style={{ color: colors.primary }} className="text-2xl font-bold">{streaks.currentStreak}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">Current</Text>
              </View>
              <View className="items-center">
                <Text style={{ color: colors.warning }} className="text-2xl font-bold">{streaks.longestStreak}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">Best</Text>
              </View>
              <View className="items-center">
                <Text style={{ color: colors.success }} className="text-2xl font-bold">
                  {Math.max(0, 7 - streaks.currentStreak)}
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">To Next Badge</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
