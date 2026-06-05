import { Challenge, UserChallenge } from '@/lib/api';
import { useChallenges, useJoinChallenge, useUserChallenges } from '@/lib/hooks';
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
  const { colors, isDark } = useTheme();
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
      case 'streak': return ['#f97316', '#ea580c'];
      case 'completion': return ['#10b981', '#059669'];
      case 'focus': return ['#3b82f6', '#2563eb'];
      case 'quantity': return ['#a855f7', '#9333ea'];
      default: return ['#eab308', '#ca8a04'];
    }
  };

  const gradientColors = getChallengeColor(challenge.type);

  return (
    <View 
      style={{ 
        backgroundColor: colors.surface,
        borderWidth: isCompleted ? 2 : 1,
        borderColor: isCompleted ? '#10b981' : (isDark ? '#27272a' : '#e4e4e7')
      }}
      className="rounded-2xl p-5 mb-4 shadow-sm"
    >
      <View className="flex-row items-start">
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-14 h-14 rounded-2xl items-center justify-center shadow-md"
        >
          <Ionicons name={getChallengeIcon(challenge.type) as any} size={28} color="#fff" />
        </LinearGradient>
        
        <View className="flex-1 ml-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text style={{ color: colors.text }} className="font-bold text-lg flex-1 mr-2">{challenge.title}</Text>
            {isCompleted && (
              <View className="bg-emerald-500/10 px-2.5 py-1 rounded-md">
                <Text className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Done</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textMuted }} className="text-sm mb-3 leading-relaxed">{challenge.description}</Text>
          
          {/* Progress bar */}
          {isJoined && (
            <View className="mt-1">
              <View className="flex-row justify-between mb-2 items-center">
                <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider opacity-80">Progress</Text>
                <Text style={{ color: colors.text }} className="text-xs font-semibold">
                  {progress} / {challenge.target}
                </Text>
              </View>
              <View style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} className="h-2.5 rounded-full overflow-hidden">
                <LinearGradient
                  colors={isCompleted ? ['#10b981', '#059669'] : gradientColors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-full rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </View>
            </View>
          )}

          {/* Reward and Action */}
          <View className="flex-row items-center justify-between mt-4">
            <View className="flex-row items-center bg-yellow-500/10 px-3 py-1.5 rounded-lg">
              <Ionicons name="star" size={16} color="#eab308" />
              <Text className="text-yellow-600 dark:text-yellow-500 text-sm font-bold ml-1.5">{challenge.reward} XP</Text>
            </View>
            
            {!isJoined ? (
              <Pressable
                onPress={onJoin}
                disabled={isJoining}
                className="overflow-hidden rounded-lg shadow-sm"
              >
                <LinearGradient
                  colors={isDark ? ['#3f3f46', '#27272a'] : ['#18181b', '#27272a']}
                  className="px-5 py-2.5 flex-row justify-center min-w-[80px]"
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-sm">Join</Text>
                  )}
                </LinearGradient>
              </Pressable>
            ) : (
              <View className="flex-row items-center bg-zinc-500/10 px-3 py-1.5 rounded-lg">
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="text-xs font-medium ml-1">
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
      <View className="px-6 pt-4 pb-4">
        <Text style={{ color: colors.text }} className="text-3xl font-extrabold tracking-tight">Challenges</Text>
        <Text style={{ color: colors.textMuted }} className="mt-1 text-base">Push your limits & earn XP</Text>
      </View>

      {/* Stats Banner */}
      <View className="mx-6 mb-6 rounded-2xl overflow-hidden shadow-sm">
        <LinearGradient
          colors={isDark ? ['#27272a', '#18181b'] : ['#f4f4f5', '#ffffff']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          className="p-5 flex-row border border-zinc-200 dark:border-zinc-800 rounded-2xl"
        >
          <View className="flex-1 items-center justify-center">
            <View className="bg-yellow-500/20 w-12 h-12 rounded-full items-center justify-center mb-2">
              <Ionicons name="trophy" size={20} color="#eab308" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-black">{completedCount}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-bold tracking-wider mt-1">Completed</Text>
          </View>
          
          <View style={{ backgroundColor: isDark ? '#3f3f46' : '#e4e4e7' }} className="w-px h-full opacity-50" />
          
          <View className="flex-1 items-center justify-center">
            <View className="bg-purple-500/20 w-12 h-12 rounded-full items-center justify-center mb-2">
              <Ionicons name="star" size={20} color="#a855f7" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-black">{totalXP}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-bold tracking-wider mt-1">Total XP</Text>
          </View>
          
          <View style={{ backgroundColor: isDark ? '#3f3f46' : '#e4e4e7' }} className="w-px h-full opacity-50" />
          
          <View className="flex-1 items-center justify-center">
            <View className="bg-blue-500/20 w-12 h-12 rounded-full items-center justify-center mb-2">
              <Ionicons name="flame" size={20} color="#3b82f6" />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-black">{joinedChallenges.length}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-bold tracking-wider mt-1">Active</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Modern Segmented Control */}
      <View style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} className="flex-row mx-6 mb-6 rounded-xl p-1">
        <Pressable
          onPress={() => setActiveTab('available')}
          style={{ 
            backgroundColor: activeTab === 'available' ? (isDark ? '#3f3f46' : '#ffffff') : 'transparent',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: activeTab === 'available' ? 0.1 : 0,
            shadowRadius: 1,
            elevation: activeTab === 'available' ? 1 : 0,
          }}
          className="flex-1 py-3 rounded-lg"
        >
          <Text style={{ color: activeTab === 'available' ? colors.text : colors.textMuted }} className="text-center font-bold">
            Available ({availableChallenges.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('joined')}
          style={{ 
            backgroundColor: activeTab === 'joined' ? (isDark ? '#3f3f46' : '#ffffff') : 'transparent',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: activeTab === 'joined' ? 0.1 : 0,
            shadowRadius: 1,
            elevation: activeTab === 'joined' ? 1 : 0,
          }}
          className="flex-1 py-3 rounded-lg"
        >
          <Text style={{ color: activeTab === 'joined' ? colors.text : colors.textMuted }} className="text-center font-bold">
            My Challenges ({joinedChallenges.length})
          </Text>
        </Pressable>
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
          </View>
        ) : activeTab === 'available' ? (
          <>
            {availableChallenges.length === 0 ? (
              <View className="py-16 items-center">
                <View className="w-20 h-20 rounded-full bg-emerald-500/10 items-center justify-center mb-4">
                  <Ionicons name="checkmark-circle" size={40} color="#10b981" />
                </View>
                <Text style={{ color: colors.text }} className="text-lg font-bold text-center">
                  All Caught Up!
                </Text>
                <Text style={{ color: colors.textMuted }} className="mt-2 text-center text-sm">
                  You've joined all available challenges.{'\n'}Check back later for more.
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
              <View className="py-16 items-center">
                <View className="w-20 h-20 rounded-full bg-zinc-500/10 items-center justify-center mb-4">
                  <Ionicons name="flag-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={{ color: colors.text }} className="text-lg font-bold text-center">
                  No Active Challenges
                </Text>
                <Text style={{ color: colors.textMuted }} className="mt-2 text-center text-sm">
                  Join a challenge from the Available tab{'\n'}to start earning XP!
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
