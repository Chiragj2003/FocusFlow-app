import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALL_ACHIEVEMENTS } from '@/lib/constants';
import { useUserChallenges, useJoinChallenge } from '@/lib/hooks';

function AchievementCard({ 
  achievement, 
  userChallenge, 
  onJoin,
  isJoining,
}: { 
  achievement: any;
  userChallenge?: any;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const { colors, isDark } = useTheme();
  
  const isJoined = !!userChallenge;
  const progress = userChallenge?.progress || 0;
  const progressPercent = Math.min((progress / achievement.target) * 100, 100);
  const isCompleted = userChallenge?.completed || progress >= achievement.target;

  const getIcon = (type: string) => {
    switch (type) {
      case 'streak': return 'flame';
      case 'completion': return 'checkmark-done';
      case 'focus': return 'time';
      case 'quantity': return 'trending-up';
      default: return 'trophy';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'streak': return ['#f97316', '#ea580c'];
      case 'completion': return ['#10b981', '#059669'];
      case 'focus': return ['#3b82f6', '#2563eb'];
      case 'quantity': return ['#a855f7', '#9333ea'];
      default: return ['#eab308', '#ca8a04'];
    }
  };

  const gradientColors = getColor(achievement.type);

  return (
    <View 
      style={{ 
        backgroundColor: colors.surface,
        borderColor: isCompleted ? '#10b981' : colors.border
      }}
      className="rounded-2xl p-5 mb-4 shadow-sm border"
    >
      <View className="flex-row items-start">
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={getIcon(achievement.type) as any} size={28} color="#fff" />
        </LinearGradient>
        
        <View className="flex-1 ml-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text style={{ color: colors.text }} className="font-bold text-lg flex-1 mr-2">{achievement.title}</Text>
            {isCompleted && (
              <View className="bg-emerald-500/10 px-2.5 py-1 rounded-md">
                <Text className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Done</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textMuted }} className="text-sm mb-3 leading-relaxed">{achievement.description}</Text>
          
          {/* Progress bar */}
          {isJoined && (
            <View className="mt-1 mb-2">
              <View className="flex-row justify-between mb-2 items-center">
                <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider opacity-80">Progress</Text>
                <Text style={{ color: colors.text }} className="text-xs font-semibold">
                  {progress} / {achievement.target}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-2.5 rounded-full overflow-hidden">
                <LinearGradient
                  colors={isCompleted ? ['#10b981', '#059669'] : gradientColors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ width: `${progressPercent}%`, height: '100%', borderRadius: 9999 }}
                />
              </View>
            </View>
          )}

          {/* Instructions and Action */}
          <View className="mt-2 space-y-3">
            {!isJoined ? (
              <View className="bg-zinc-500/5 p-3 rounded-lg border border-zinc-500/10 mb-2">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }} className="text-xs font-bold ml-1 uppercase">How to earn</Text>
                </View>
                <Text style={{ color: colors.text }} className="text-xs leading-relaxed">
                  Join this achievement and track your habits consistently to reach the target. All entries automatically sync to update your progress!
                </Text>
              </View>
            ) : isCompleted ? (
              <View className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 mb-2">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="trophy-outline" size={14} color="#10b981" />
                  <Text className="text-emerald-500 text-xs font-bold ml-1 uppercase">Achieved</Text>
                </View>
                <Text style={{ color: colors.text }} className="text-xs leading-relaxed">
                  Congratulations! You've completely crushed this goal. The XP has been added to your profile.
                </Text>
              </View>
            ) : null}
            
            <View className="flex-row items-center justify-between mt-1">
              <View className="flex-row items-center bg-yellow-500/10 px-3 py-1.5 rounded-lg">
                <Ionicons name="star" size={16} color="#eab308" />
                <Text className="text-yellow-600 dark:text-yellow-500 text-sm font-bold ml-1.5">{achievement.reward} XP</Text>
              </View>
              
              {!isJoined ? (
                <Pressable
                  onPress={onJoin}
                  disabled={isJoining}
                  className="overflow-hidden rounded-lg shadow-sm"
                  style={{ backgroundColor: colors.primary }}
                >
                  <View
                    style={{ paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', minWidth: 80 }}
                  >
                    {isJoining ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={{ color: colors.primaryForeground }} className="font-bold text-sm">Join</Text>
                    )}
                  </View>
                </Pressable>
              ) : (
                <View className="flex-row items-center bg-zinc-500/10 px-3 py-1.5 rounded-lg">
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }} className="text-xs font-medium ml-1">
                    {achievement.duration} days left
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AchievementsScreen() {
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'available' | 'joined'>('available');
  const [refreshing, setRefreshing] = useState(false);
  const [isJoiningId, setIsJoiningId] = useState<string | null>(null);

  const { data: userChallenges, isLoading: userChallengesLoading, refetch: refetchUserChallenges } = useUserChallenges();
  const joinChallenge = useJoinChallenge();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchUserChallenges();
    setRefreshing(false);
  }, [refetchUserChallenges]);

  const handleJoin = async (id: string) => {
    setIsJoiningId(id);
    try {
      await joinChallenge.mutateAsync(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchUserChallenges();
    } catch (error) {
      console.error('Failed to join achievement:', error);
    } finally {
      setIsJoiningId(null);
    }
  };

  const isLoading = userChallengesLoading;

  const available = ALL_ACHIEVEMENTS.filter(
    (c: any) => !userChallenges?.some((uc: any) => uc.challengeId === c.id)
  );
  
  const joined = (userChallenges || []).filter((uc: any) => 
    ALL_ACHIEVEMENTS.some((c: any) => c.id === uc.challengeId)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View className="px-6 pt-2 pb-4">
        <Text style={{ color: colors.text }} className="text-3xl font-black tracking-tight">Achievements</Text>
        <Text style={{ color: colors.textMuted }} className="mt-1 font-medium">Challenge yourself and earn huge XP rewards.</Text>
      </View>

      {/* Custom Tab Bar */}
      <View className="px-6 mb-4">
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }} 
          className="flex-row p-1 rounded-xl border shadow-sm"
        >
          <Pressable 
            className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'available' ? 'shadow-sm' : ''}`}
            style={{ backgroundColor: activeTab === 'available' ? colors.backgroundSecondary : 'transparent' }}
            onPress={() => {
              setActiveTab('available');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text 
              style={{ color: activeTab === 'available' ? colors.text : colors.textMuted }} 
              className="font-bold text-sm tracking-wide"
            >
              Available ({available.length})
            </Text>
          </Pressable>
          <Pressable 
            className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'joined' ? 'shadow-sm' : ''}`}
            style={{ backgroundColor: activeTab === 'joined' ? colors.backgroundSecondary : 'transparent' }}
            onPress={() => {
              setActiveTab('joined');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text 
              style={{ color: activeTab === 'joined' ? colors.text : colors.textMuted }} 
              className="font-bold text-sm tracking-wide"
            >
              Joined ({joined.length})
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textMuted }} className="mt-4">Loading achievements...</Text>
          </View>
        ) : activeTab === 'available' ? (
          <View className="pb-8">
            {available.length === 0 ? (
              <View className="py-12 items-center">
                <Ionicons name="star-outline" size={48} color={colors.textMuted} className="mb-4 opacity-50" />
                <Text style={{ color: colors.text }} className="text-lg font-bold mb-2">You're a legend!</Text>
                <Text style={{ color: colors.textMuted }} className="text-center">You've joined every single achievement available.</Text>
              </View>
            ) : (
              available.map((achievement: any) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isJoined={false}
                  onJoin={() => handleJoin(achievement.id)}
                  isJoining={isJoiningId === achievement.id}
                />
              ))
            )}
          </View>
        ) : (
          <View className="pb-8">
            {joined.length === 0 ? (
              <View className="py-12 items-center">
                <Ionicons name="rocket-outline" size={48} color={colors.textMuted} className="mb-4 opacity-50" />
                <Text style={{ color: colors.text }} className="text-lg font-bold mb-2">No achievements joined</Text>
                <Text style={{ color: colors.textMuted }} className="text-center">Join some achievements to push your limits and earn XP!</Text>
              </View>
            ) : (
              joined.map((uc: any) => {
                const achievement = ALL_ACHIEVEMENTS.find((c: any) => c.id === uc.challengeId);
                if (!achievement) return null;
                return (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    userChallenge={uc}
                    isJoined={true}
                    onJoin={() => {}}
                    isJoining={false}
                  />
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
