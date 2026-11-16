import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import {
  sparky_celebrate,
  sparky_checklist,
  sparky_focus,
  sparky_happy,
  sparky_sleeping,
  sparky_streak,
} from '@/assets/mascots/sparky';

export type MascotMood = 'happy' | 'celebrate' | 'focus' | 'streak' | 'checklist' | 'sleeping';

const MASCOT_SVG: Record<MascotMood, string> = {
  happy: sparky_happy,
  celebrate: sparky_celebrate,
  focus: sparky_focus,
  streak: sparky_streak,
  checklist: sparky_checklist,
  sleeping: sparky_sleeping,
};

/**
 * Drop-in slot for final artwork. When the PNG renders are ready
 * (transparent background, square), add them here, e.g.
 *   happy: require('@/assets/mascots/sparky-happy.png'),
 * and they replace the vector version everywhere.
 */
const MASCOT_PNG: Partial<Record<MascotMood, ImageSourcePropType>> = {};

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Gentle idle bob. Disabled automatically when the OS asks for reduced motion. */
  animated?: boolean;
}

export function Mascot({ mood = 'happy', size = 120, animated = true }: MascotProps) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (!animated || reduceMotion) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [animated, reduceMotion, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const png = MASCOT_PNG[mood];

  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {png ? (
        <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <View style={{ width: size, height: size }}>
          <SvgXml xml={MASCOT_SVG[mood]} width={size} height={size} />
        </View>
      )}
    </Animated.View>
  );
}
