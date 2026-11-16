import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';

const FLAMES = {
  out: require('@/assets/flames/flame-out.png'),
  spark: require('@/assets/flames/flame-1-spark.png'),
  small: require('@/assets/flames/flame-2-small.png'),
  medium: require('@/assets/flames/flame-3-medium.png'),
  large: require('@/assets/flames/flame-4-large.png'),
  blue: require('@/assets/flames/flame-5-blue.png'),
  legendary: require('@/assets/flames/flame-6-legendary.png'),
  frozen: require('@/assets/flames/flame-frozen.png'),
};

/** The flame grows with the streak: out → spark → small → medium → large → blue → legendary. */
export function flameForStreak(days: number): ImageSourcePropType {
  if (days <= 0) return FLAMES.out;
  if (days < 3) return FLAMES.spark;
  if (days < 7) return FLAMES.small;
  if (days < 14) return FLAMES.medium;
  if (days < 30) return FLAMES.large;
  if (days < 100) return FLAMES.blue;
  return FLAMES.legendary;
}

export const FROZEN_FLAME = FLAMES.frozen;

export function StreakFlame({ days, size = 28 }: { days: number; size?: number }) {
  return (
    <Image
      source={flameForStreak(days)}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const MILESTONE_IMAGES: Record<number, ImageSourcePropType> = {
  3: require('@/assets/milestones/m3.png'),
  7: require('@/assets/milestones/m7.png'),
  14: require('@/assets/milestones/m14.png'),
  21: require('@/assets/milestones/m21.png'),
  30: require('@/assets/milestones/m30.png'),
  60: require('@/assets/milestones/m60.png'),
  100: require('@/assets/milestones/m100.png'),
  365: require('@/assets/milestones/m365.png'),
};

/** Milestone scene for an exact streak day (3, 7, 14, 21, 30, 60, 100, 365), else undefined. */
export function milestoneImage(days: number): ImageSourcePropType | undefined {
  return MILESTONE_IMAGES[days];
}

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 100, 365];
