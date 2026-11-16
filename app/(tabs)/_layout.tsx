import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { hasSeenOnboarding } from '@/lib/onboarding';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;

/** Tab icon with the brand's soft orange pill behind the active tab. */
function TabIcon({ name, focusedName, focused, color, activeBg }: {
  name: IconName;
  focusedName: IconName;
  focused: boolean;
  color: string;
  activeBg: string;
}) {
  return (
    <View
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? activeBg : 'transparent',
      }}
    >
      <Ionicons name={focused ? focusedName : name} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding().then(setOnboarded);
  }, []);

  // Show loading while Clerk initializes
  if (!isLoaded || (isSignedIn && onboarded === null)) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // First launch on this device: show the 3-screen intro once
  if (onboarded === false) {
    return <Redirect href="/onboarding" />;
  }

  const bottomPad = Math.max(insets.bottom, 10);
  const icon = (name: IconName, focusedName: IconName) =>
    ({ color, focused }: { color: unknown; focused: boolean }) => (
      <TabIcon name={name} focusedName={focusedName} focused={focused} color={color as string} activeBg={colors.primarySoft} />
    );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 62 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        sceneStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus', tabBarIcon: icon('timer-outline', 'timer') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
      <Tabs.Screen name="achievements" options={{ href: null }} />
      <Tabs.Screen name="badges" options={{ href: null }} />
    </Tabs>
  );
}
