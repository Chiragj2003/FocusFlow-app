import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 'primary' = orange gradient pill, 'ghost' = subtle pill for secondary actions */
  variant?: 'primary' | 'ghost';
  ghostColors?: { bg: string; text: string; border: string };
}

const SIZES = {
  sm: { h: 36, px: 14, font: 13, icon: 15 },
  md: { h: 48, px: 20, font: 15, icon: 18 },
  lg: { h: 56, px: 24, font: 16, icon: 20 },
};

/** Brand pill button: orange→amber gradient (primary) or a quiet outlined pill (ghost). */
export function GradientButton({
  label,
  onPress,
  icon,
  size = 'md',
  disabled,
  loading,
  style,
  variant = 'primary',
  ghostColors,
}: GradientButtonProps) {
  const s = SIZES[size];
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: s.h, paddingHorizontal: s.px }}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#1c0a00' : ghostColors?.text} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={s.icon}
              color={variant === 'primary' ? '#1c0a00' : ghostColors?.text}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={{
              fontSize: s.font,
              fontWeight: '700',
              color: variant === 'primary' ? '#1c0a00' : ghostColors?.text,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        { borderRadius: 999, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'primary' && {
          shadowColor: '#f97316',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#f97316', '#fbbf24']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ borderRadius: 999 }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={{
            borderRadius: 999,
            backgroundColor: ghostColors?.bg,
            borderWidth: 1,
            borderColor: ghostColors?.border,
          }}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}
