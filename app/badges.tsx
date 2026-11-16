import { ProgressRing } from '@/components/ui/ProgressRing';
import { BADGE_ART, BADGES, BadgeDef, findEarned } from '@/lib/badgeCatalog';
import { useBadges } from '@/lib/hooks';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GROUPS: BadgeDef['group'][] = ['Milestones', 'Streaks', 'Completions'];

export default function BadgesScreen() {
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const { data: earned, isLoading, refetch } = useBadges();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const earnedCount = BADGES.filter((b) => findEarned(earned, b)).length;
  const card = { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Badges</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: 16 }}>Earn badges by showing up every day.</Text>

        {/* Progress */}
        <View style={{ ...card, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Your collection</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
              {earnedCount} of {BADGES.length} earned
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {earnedCount === BADGES.length ? 'You earned them all. Legend!' : 'Keep your streak going to unlock more.'}
            </Text>
          </View>
          <ProgressRing size={72} strokeWidth={8} progress={earnedCount / BADGES.length} trackColor={colors.backgroundSecondary}>
            <Ionicons name="trophy" size={24} color={colors.accent} />
          </ProgressRing>
        </View>

        {isLoading && !earned ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          GROUPS.map((group) => {
            const list = BADGES.filter((b) => b.group === group);
            const got = list.filter((b) => findEarned(earned, b)).length;
            return (
              <View key={group} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{group}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{got}/{list.length}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {list.map((badge) => {
                    const record = findEarned(earned, badge);
                    const unlocked = !!record;
                    const art = BADGE_ART[badge.id];
                    const image = art ? (unlocked ? art.earned : art.locked ?? art.earned) : undefined;
                    return (
                      <View
                        key={badge.id}
                        accessibilityLabel={`${badge.name}, ${unlocked ? 'earned' : 'locked'}. ${badge.description}`}
                        style={{ ...card, width: '48.5%', borderRadius: 22, padding: 14, marginBottom: 10, alignItems: 'center', opacity: unlocked ? 1 : 0.75 }}
                      >
                        {image ? (
                          <Image source={image} style={{ width: 72, height: 72, opacity: unlocked || art?.locked ? 1 : 0.35 }} resizeMode="contain" />
                        ) : (
                          <View
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 32,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: unlocked ? colors.primarySoft : colors.backgroundSecondary,
                              borderWidth: 2,
                              borderColor: unlocked ? colors.primary : colors.borderSecondary,
                            }}
                          >
                            <Ionicons name={unlocked ? badge.icon : 'lock-closed'} size={26} color={unlocked ? colors.primary : colors.textMuted} />
                          </View>
                        )}
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' }} numberOfLines={1}>
                          {badge.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 3, lineHeight: 16 }} numberOfLines={2}>
                          {badge.description}
                        </Text>
                        {unlocked && record?.awardedAt && (
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 6 }}>
                            {new Date(record.awardedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
