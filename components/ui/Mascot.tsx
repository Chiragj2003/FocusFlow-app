import React, { useEffect } from 'react';
import { Image, ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Sparky's moods. Each maps to one pose from assets/sparky. */
export type MascotMood =
  | 'idle'
  | 'happy' // waving hello
  | 'celebrate' // jumping cheer
  | 'proud'
  | 'streak' // proud, used for streak moments
  | 'checklist' // proud, used for "all done"
  | 'thinking'
  | 'sad'
  | 'sleeping'
  | 'focus';

const POSES = {
  idle: require('@/assets/sparky/idle.png'),
  wave: require('@/assets/sparky/wave-hello.png'),
  cheer: require('@/assets/sparky/jump-cheer.png'),
  proud: require('@/assets/sparky/proud.png'),
  thinking: require('@/assets/sparky/thinking.png'),
  sad: require('@/assets/sparky/sad.png'),
  sleeping: require('@/assets/sparky/sleeping.png'),
  focus: require('@/assets/sparky/focus.png'),
};

const MOOD_POSE: Record<MascotMood, ImageSourcePropType> = {
  idle: POSES.idle,
  happy: POSES.wave,
  celebrate: POSES.cheer,
  proud: POSES.proud,
  streak: POSES.proud,
  checklist: POSES.proud,
  thinking: POSES.thinking,
  sad: POSES.sad,
  sleeping: POSES.sleeping,
  focus: POSES.focus,
};

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Gentle idle bob. Disabled automatically when the OS asks for reduced motion. */
  animated?: boolean;
  /** Override the pose with any image (e.g. a streak milestone scene). */
  source?: ImageSourcePropType;
}

export function Mascot({ mood = 'happy', size = 120, animated = true, source }: MascotProps) {
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

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={source ?? MOOD_POSE[mood]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}
