import { FlameMark } from '@/components/ui/FlameMark';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mascot } from '@/components/ui/Mascot';
import { StreakFlame } from '@/components/ui/StreakFlame';
import { useTheme } from '@/lib/ThemeContext';
import { markOnboardingSeen } from '@/lib/onboarding';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SLIDES = [
  {
    key: 'goals',
    title: 'Set your goals',
    body: 'Pick a few small habits that matter to you. Check them off with one tap.',
    art: 'wave' as const,
  },
  {
    key: 'focus',
    title: 'Stay focused',
    body: 'Start a focus session with calming sounds. Your timer keeps going even when you leave the app.',
    art: 'focus' as const,
  },
  {
    key: 'grow',
    title: 'Watch your fire grow',
    body: 'Every day you show up, your flame grows. Hit milestones, earn badges, and keep the streak alive.',
    art: 'grow' as const,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await markOnboardingSeen();
    router.replace('/(tabs)');
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
    setIndex(index + 1);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const artSize = Math.min(width * 0.68, 300);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Warm glow behind the art */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '12%',
          alignSelf: 'center',
          width: artSize * 1.3,
          height: artSize * 1.3,
          borderRadius: artSize,
          backgroundColor: colors.primary,
          opacity: isDark ? 0.12 : 0.08,
        }}
      />

      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
        <FlameMark size={26} />
        <Text style={{ fontSize: 18, fontWeight: '800', marginLeft: 6, color: colors.text }}>
          Focus<Text style={{ color: colors.primary }}>Flow</Text>
        </Text>
        <View style={{ flex: 1 }} />
        {index < SLIDES.length - 1 && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            {s.art === 'grow' ? (
              <View style={{ alignItems: 'center' }}>
                <Mascot mood="celebrate" size={artSize * 0.85} source={require('@/assets/milestones/m30.png')} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
                  {[1, 3, 7, 14, 30, 100].map((d, i) => (
                    <StreakFlame key={d} days={d} size={22 + i * 5} />
                  ))}
                </View>
              </View>
            ) : (
              <Mascot mood={s.art === 'wave' ? 'happy' : 'focus'} size={artSize} />
            )}
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 28, letterSpacing: -0.5 }}>
              {s.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10 }}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + action */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 }} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.borderSecondary }}
            />
          ))}
        </View>
        <GradientButton
          label={index === SLIDES.length - 1 ? 'Get started' : 'Next'}
          icon={index === SLIDES.length - 1 ? 'flame' : 'arrow-forward'}
          size="lg"
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}
