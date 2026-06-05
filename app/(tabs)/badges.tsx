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

import { ALL_BADGES } from '@/lib/constants';

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
        backgroundColor: isUnlocked ? colors.surface : colors.surface + '80',
        borderColor: isUnlocked ? badge.color : colors.border,
        borderWidth: isUnlocked ? 1 : 1
      }}
      className="w-full p-4 rounded-xl mb-3 flex-row items-center"
    >
      <View 
        className="w-16 h-16 rounded-xl items-center justify-center mr-4"
        style={{ 
          backgroundColor: isUnlocked ? `${badge.color}20` : colors.backgroundTertiary,
          opacity: isUnlocked ? 1 : 0.4
        }}
      >
        <Ionicons 
          name={badge.icon as any} 
          size={32} 
          color={isUnlocked ? badge.color : colors.textMuted} 
        />
      </View>
      
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-1">
          <Text style={{ color: isUnlocked ? colors.text : colors.textMuted }} className="font-bold text-base">
            {badge.name}
          </Text>
          {isUnlocked ? (
            <View className="bg-emerald-500/10 px-2 py-0.5 rounded-md flex-row items-center">
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider ml-1">Earned</Text>
            </View>
          ) : (
            <View className="bg-zinc-500/10 px-2 py-0.5 rounded-md flex-row items-center">
              <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold uppercase tracking-wider ml-1">Locked</Text>
            </View>
          )}
        </View>

        {!isUnlocked && (
          <View className="mt-1 flex-row items-start">
            <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.textMuted }} className="text-xs ml-1 flex-1 leading-snug">
              <Text className="font-semibold text-zinc-500">How to unlock: </Text>
              {badge.description}
            </Text>
          </View>
        )}

        {isUnlocked && (
          <>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5 leading-snug">
              {badge.description}
            </Text>
            {awardedAt && (
              <Text style={{ color: badge.color }} className="text-[10px] font-bold mt-2 uppercase tracking-wide opacity-80">
                Unlocked {new Date(awardedAt).toLocaleDateString()}
              </Text>
            )}
          </>
        )}
      </View>
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
