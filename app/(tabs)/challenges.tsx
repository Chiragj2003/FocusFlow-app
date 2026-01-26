import { Challenge, UserChallenge } from '@/lib/api';
import { useChallenges, useJoinChallenge, useUserChallenges } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
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

// Get theme colors for challenge card
const useCardColors = () => {
  const { colors } = useTheme();
  return colors;
};

// Challenge card with progress
function ChallengeCard({ 
  challenge, 
  userChallenge, 
  onJoin,
  isJoining,
}: { 
  challenge: any;
  userChallenge?: any;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const colors = useCardColors();
  const isJoined = !!userChallenge;
  const progress = userChallenge?.progress || 0;
  const progressPercent = Math.min((progress / challenge.target) * 100, 100);
  const isCompleted = userChallenge?.completed;

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'streak': return 'flame';
      case 'completion': return 'checkmark-done';
      case 'focus': return 'time';
      case 'quantity': return 'trending-up';
      default: return 'trophy';
    }
  };

  const getChallengeColor = (type: string) => {
    switch (type) {
      case 'streak': return '#f97316';
      case 'completion': return '#22c55e';
      case 'focus': return '#3b82f6';
      case 'quantity': return '#a855f7';
      default: return '#eab308';
    }
  };

  const color = getChallengeColor(challenge.type);

  return (
    <View 
      style={{ 
        backgroundColor: colors.surface,
        borderWidth: isCompleted ? 1 : 0,
        borderColor: isCompleted ? colors.success + '50' : 'transparent'
      }}
      className="rounded-xl p-4 mb-3"
    >
      <View className="flex-row items-start">
        <View 
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Ionicons name={getChallengeIcon(challenge.type) as any} size={24} color={color} />
        </View>
        
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text style={{ color: colors.text }} className="font-semibold flex-1">{challenge.title}</Text>
            {isCompleted && (
              <View style={{ backgroundColor: colors.success + '20' }} className="px-2 py-1 rounded-full">
                <Text style={{ color: colors.success }} className="text-xs font-medium">Completed!</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textMuted }} className="text-sm mt-1">{challenge.description}</Text>
          
          {/* Progress bar */}
          {isJoined && (
            <View className="mt-3">
              <View className="flex-row justify-between mb-1">
                <Text style={{ color: colors.textMuted }} className="text-xs">Progress</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  {progress}/{challenge.target}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.backgroundTertiary }} className="h-2 rounded-full overflow-hidden">
                <View 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${progressPercent}%`, 
                    backgroundColor: isCompleted ? colors.success : color 
                  }}
                />
              </View>
            </View>
          )}

          {/* Reward and Action */}
          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-row items-center">
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text style={{ color: colors.warning }} className="text-sm ml-1">{challenge.reward} XP</Text>
            </View>
            
            {!isJoined ? (
              <Pressable
                onPress={onJoin}
                disabled={isJoining}
                style={{ backgroundColor: colors.text }}
                className="px-4 py-2 rounded-lg"
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={{ color: colors.background }} className="font-semibold text-sm">Join</Text>
                )}
              </Pressable>
            ) : (
              <View className="flex-row items-center">
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  {challenge.duration} days
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ChallengesScreen() {
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'available' | 'joined'>('available');
  const [refreshing, setRefreshing] = useState(false);
  
  const { 
    data: challenges, 
    isLoading: challengesLoading, 
    refetch: refetchChallenges 
  } = useChallenges();
  
  const { 
    data: userChallenges, 
    isLoading: userChallengesLoading,
    refetch: refetchUserChallenges,
  } = useUserChallenges();
  
  const joinChallenge = useJoinChallenge();

  const isLoading = challengesLoading || userChallengesLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchChallenges(), refetchUserChallenges()]);
    setRefreshing(false);
  }, [refetchChallenges, refetchUserChallenges]);

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await joinChallenge.mutateAsync(challengeId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchUserChallenges();
    } catch (error) {
      console.error('Failed to join challenge:', error);
    }
  };

  // Get user challenge data for each challenge
  const getUserChallenge = (challengeId: string) => {
    return userChallenges?.find((uc: UserChallenge) => uc.challengeId === challengeId);
  };

  // Filter challenges
  const availableChallenges = challenges?.filter(
    (c: Challenge) => !userChallenges?.some((uc: UserChallenge) => uc.challengeId === c.id)
  ) || [];
  
  const joinedChallenges: UserChallenge[] = userChallenges || [];

  // Calculate stats
  const completedCount = joinedChallenges.filter((uc: UserChallenge) => uc.completed).length;
  const totalXP = joinedChallenges
    .filter((uc: UserChallenge) => uc.completed)
    .reduce((sum: number, uc: UserChallenge) => sum + (uc.challenge?.reward || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View className="px-6 pt-2 pb-4">
        <Text style={{ color: colors.text }} className="text-2xl font-bold">Challenges</Text>
        <Text style={{ color: colors.textMuted }} className="mt-1">Complete challenges to earn XP</Text>
      </View>

      {/* Stats Banner */}
      <View style={{ backgroundColor: colors.surface }} className="mx-6 mb-4 rounded-xl p-4 flex-row">
        <View className="flex-1 items-center">
          <Ionicons name="trophy" size={24} color={colors.warning} />
          <Text style={{ color: colors.text }} className="text-2xl font-bold mt-1">{completedCount}</Text>
          <Text style={{ color: colors.textMuted }} className="text-xs">Completed</Text>
        </View>
        <View style={{ backgroundColor: colors.border }} className="w-px" />
        <View className="flex-1 items-center">
          <Ionicons name="star" size={24} color="#a855f7" />
          <Text style={{ color: colors.text }} className="text-2xl font-bold mt-1">{totalXP}</Text>
          <Text style={{ color: colors.textMuted }} className="text-xs">Total XP</Text>
        </View>
        <View style={{ backgroundColor: colors.border }} className="w-px" />
        <View className="flex-1 items-center">
          <Ionicons name="flame" size={24} color={colors.primary} />
          <Text style={{ color: colors.text }} className="text-2xl font-bold mt-1">{joinedChallenges.length}</Text>
          <Text style={{ color: colors.textMuted }} className="text-xs">Active</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ backgroundColor: colors.surface }} className="flex-row mx-6 mb-4 rounded-xl p-1">
        <Pressable
          onPress={() => setActiveTab('available')}
          style={{ backgroundColor: activeTab === 'available' ? colors.backgroundSecondary : 'transparent' }}
          className="flex-1 py-3 rounded-lg"
        >
          <Text style={{ color: activeTab === 'available' ? colors.text : colors.textMuted }} className="text-center font-medium">
            Available ({availableChallenges.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('joined')}
          style={{ backgroundColor: activeTab === 'joined' ? colors.backgroundSecondary : 'transparent' }}
          className="flex-1 py-3 rounded-lg"
        >
          <Text style={{ color: activeTab === 'joined' ? colors.text : colors.textMuted }} className="text-center font-medium">
            My Challenges ({joinedChallenges.length})
          </Text>
        </Pressable>
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
        ) : activeTab === 'available' ? (
          <>
            {availableChallenges.length === 0 ? (
              <View className="py-12 items-center">
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
                  You've joined all available challenges!
                </Text>
              </View>
            ) : (
              availableChallenges.map((challenge: Challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onJoin={() => handleJoinChallenge(challenge.id)}
                  isJoining={joinChallenge.isPending}
                />
              ))
            )}
          </>
        ) : (
          <>
            {joinedChallenges.length === 0 ? (
              <View className="py-12 items-center">
                <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
                  No challenges joined yet.{'\n'}Join a challenge to get started!
                </Text>
              </View>
            ) : (
              joinedChallenges.map((userChallenge: UserChallenge) => (
                <ChallengeCard
                  key={userChallenge.id}
                  challenge={userChallenge.challenge}
                  userChallenge={userChallenge}
                  onJoin={() => {}}
                  isJoining={false}
                />
              ))
            )}
          </>
        )}
        
        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
