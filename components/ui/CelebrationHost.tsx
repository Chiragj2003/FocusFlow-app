import { CelebrationEvent, ToastEvent, onCelebrate, onToast } from '@/lib/celebrate';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from './GradientButton';
import { Mascot } from './Mascot';

const CONFETTI_COLORS = ['#f97316', '#fbbf24', '#fde68a', '#fb923c', '#ef4444', '#ffffff'];
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function ConfettiPiece({ index }: { index: number }) {
  const seed = useMemo(
    () => ({
      x: Math.random() * SCREEN_W,
      drift: (Math.random() - 0.5) * 120,
      delay: Math.random() * 400,
      duration: 1800 + Math.random() * 1200,
      rotate: 360 + Math.random() * 540,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      round: index % 3 === 0,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }),
    [index]
  );
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(seed.delay, withTiming(1, { duration: seed.duration, easing: Easing.out(Easing.quad) }));
  }, [seed, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: seed.x + seed.drift * t.value },
      { translateY: -40 + t.value * (SCREEN_H * 0.85) },
      { rotate: `${seed.rotate * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: seed.w,
          height: seed.round ? seed.w : seed.h,
          borderRadius: seed.round ? seed.w : 2,
          backgroundColor: seed.color,
        },
        style,
      ]}
    />
  );
}

function CelebrationCard({ event, onClose }: { event: CelebrationEvent; onClose: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.7);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [scale]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, paddingHorizontal: 24 }}>
      {!reduceMotion && Array.from({ length: 36 }).map((_, i) => <ConfettiPiece key={i} index={i} />)}

      <Animated.View
        accessibilityViewIsModal
        accessibilityLiveRegion="assertive"
        style={[
          {
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.card,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingTop: 12,
            paddingBottom: 24,
            paddingHorizontal: 24,
            alignItems: 'center',
            shadowColor: '#f97316',
            shadowOpacity: 0.3,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          },
          cardStyle,
        ]}
      >
        <Mascot mood={event.mood ?? 'celebrate'} source={event.image} size={180} />

        {event.highlight && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primarySoft,
              borderColor: 'rgba(249,115,22,0.35)',
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginTop: -6,
              marginBottom: 12,
            }}
          >
            <Ionicons name={event.highlightIcon ?? 'flame'} size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', marginLeft: 6, fontSize: 14 }}>{event.highlight}</Text>
          </View>
        )}

        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
          {event.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, marginBottom: 22 }}>
          {event.message}
        </Text>

        {event.week && (
          <View
            accessibilityLabel={`This week: ${event.week.filter((d) => d.done).length} of 7 days`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignSelf: 'stretch',
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 10,
              marginTop: -8,
              marginBottom: 22,
            }}
          >
            {event.week.map((d, i) => (
              <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: d.today ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{d.label}</Text>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: d.done ? colors.primary : 'transparent',
                    borderWidth: d.done ? 0 : 2,
                    borderColor: d.today ? colors.primary : colors.borderSecondary,
                  }}
                >
                  {d.done && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                </View>
              </View>
            ))}
          </View>
        )}

        <GradientButton label={event.cta ?? 'Keep going'} onPress={onClose} size="lg" style={{ alignSelf: 'stretch' }} />
      </Animated.View>
    </View>
  );
}

const TOAST_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  error: 'alert-circle',
};

/**
 * Renders celebrations (one at a time, queued) and toasts.
 * Mount once, inside ThemeProvider, near the root.
 */
export function CelebrationHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);
  const [toastEvent, setToastEvent] = useState<(ToastEvent & { id: number }) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onCelebrate((e) => setQueue((q) => [...q, e])), []);

  useEffect(
    () =>
      onToast((e) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToastEvent({ ...e, id: Date.now() });
        toastTimer.current = setTimeout(() => setToastEvent(null), e.tone === 'error' ? 4500 : 2600);
      }),
    []
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const closeCelebration = useCallback(() => setQueue((q) => q.slice(1)), []);
  const current = queue[0];
  const tone = toastEvent?.tone ?? 'success';
  const toneColor = tone === 'error' ? colors.error : tone === 'info' ? colors.info : colors.success;

  return (
    <>
      <Modal visible={!!current} transparent animationType="fade" onRequestClose={closeCelebration} statusBarTranslucent>
        {current && <CelebrationCard key={`${current.title}-${queue.length}`} event={current} onClose={closeCelebration} />}
      </Modal>

      {toastEvent && (
        <Animated.View
          key={toastEvent.id}
          entering={SlideInDown.springify().damping(16)}
          exiting={SlideOutDown.duration(200)}
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, alignItems: 'center' }}
        >
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Pressable
              onPress={() => setToastEvent(null)}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 12,
                paddingHorizontal: 16,
                maxWidth: 420,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Ionicons name={TOAST_ICON[tone]} size={20} color={toneColor} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginLeft: 8, flexShrink: 1 }}>{toastEvent.message}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </>
  );
}
