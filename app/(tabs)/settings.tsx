import { useTheme } from '@/lib/ThemeContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsManager } from '@/lib/notifications';
import { useHabits, useInsights, useStreaks } from '../../lib/hooks';
import { guestStorage } from '../../lib/localStorage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://focus-flow-web-weld.vercel.app';
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || API_URL;

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isDark, mode, setMode, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
        const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');
        const hapticVal = await AsyncStorage.getItem('@focusflow_settings_haptic');

        if (notifyVal !== null) setNotifications(notifyVal === 'true');
        if (dailyVal !== null) setDailyReminder(dailyVal === 'true');
        if (hapticVal !== null) setHapticFeedback(hapticVal === 'true');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    try {
      await AsyncStorage.setItem('@focusflow_settings_notifications', String(value));
      await notificationsManager.updateScheduledReminders();
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  };

  const handleToggleDailyReminder = async (value: boolean) => {
    setDailyReminder(value);
    try {
      await AsyncStorage.setItem('@focusflow_settings_daily_reminder', String(value));
      await notificationsManager.updateScheduledReminders();
    } catch (error) {
      console.error('Failed to save daily reminder settings:', error);
    }
  };

  const handleToggleHaptic = async (value: boolean) => {
    setHapticFeedback(value);
    try {
      await AsyncStorage.setItem('@focusflow_settings_haptic', String(value));
    } catch (error) {
      console.error('Failed to save haptic settings:', error);
    }
  };


  // Fetch user stats
  const { data: habits = [] } = useHabits(true);
  const { data: insights } = useInsights();
  const { data: streaks } = useStreaks();

  // Calculate user stats
  const totalHabits = habits.length;
  const currentStreak = streaks?.currentStreak || 0;
  const completionRate = insights?.overallCompletionRate || 0;

  // Get user info - show Guest if not signed in
  const userName = isSignedIn
    ? (user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User')
    : 'Guest User';
  const userEmail = isSignedIn
    ? (user?.emailAddresses?.[0]?.emailAddress || '')
    : 'Data stored locally on device';

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your cloud data will remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              queryClient.clear();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will delete all habits and entries stored on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await guestStorage.clearGuestData();
            queryClient.clear();
            Alert.alert('Success', 'Local data has been cleared.');
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact Support', 'Please contact support to delete your account.');
          }
        }
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your habit data will be prepared for export. This feature opens the web app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Web App', onPress: () => Linking.openURL(`${WEB_URL}/settings`) }
      ]
    );
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header - Web Aligned */}
        <View className="mb-6 mt-2">
          <Text style={{ color: colors.text }} className="text-3xl font-bold">Settings</Text>
          <Text style={{ color: colors.textMuted }} className="mt-1 text-base text-zinc-400">
            Manage your preferences
          </Text>
        </View>

        {/* Profile Section - Zinc Style */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-2xl border p-5"
        >
          <View className="flex-row items-center">
            <View 
              style={{ backgroundColor: colors.backgroundSecondary }}
              className="w-16 h-16 rounded-2xl items-center justify-center overflow-hidden"
            >
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={{ width: 64, height: 64, resizeMode: 'cover' }} />
              ) : (
                <Ionicons name="person" size={28} color={colors.textMuted} />
              )}
            </View>
            <View className="ml-4 flex-1">
              <Text style={{ color: colors.text }} className="text-xl font-bold">{userName}</Text>
              <Text style={{ color: colors.textMuted }} className="text-sm">{userEmail}</Text>
            </View>
            {isSignedIn ? (
              <Pressable
                className="p-2"
                onPress={() => Linking.openURL(`${WEB_URL}/settings`)}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable onPress={handleSignIn}>
                <View
                  style={{ backgroundColor: colors.primary }}
                  className="px-5 py-2.5 rounded-xl"
                >
                  <Text className="text-white font-bold">Sign In</Text>
                </View>
              </Pressable>
            )}
          </View>

        </View>

        {/* Notifications Section */}
        <View className="mt-6">
          <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2 px-1">NOTIFICATIONS</Text>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-2xl border">
            <SettingRow
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Receive habit reminders"
              value={notifications}
              onToggle={handleToggleNotifications}
              isDark={isDark}
              colors={colors}
            />
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingRow
              icon="alarm-outline"
              title="Daily Reminder"
              subtitle="Get reminded to track habits"
              value={dailyReminder}
              onToggle={handleToggleDailyReminder}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View className="mt-6">
          <Text style={{ color: isDark ? '#a1a1aa' : '#71717a' }} className="text-sm font-medium mb-2 px-1">APPEARANCE</Text>
          <View style={{ backgroundColor: isDark ? 'rgba(24, 24, 27, 0.5)' : '#f9fafb', borderColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="rounded-2xl border">
            {/* Theme Selection */}
            <View className="p-4">
              <View className="flex-row items-center mb-3">
                <View style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} className="w-10 h-10 rounded-xl items-center justify-center">
                  <Ionicons name="color-palette-outline" size={20} color={isDark ? '#a1a1aa' : '#52525b'} />
                </View>
                <View className="flex-1 ml-3">
                  <Text style={{ color: isDark ? '#ffffff' : '#18181b' }} className="font-medium">Theme</Text>
                  <Text style={{ color: isDark ? '#71717a' : '#52525b' }} className="text-xs mt-0.5">Choose your preferred theme</Text>
                </View>
              </View>
              <View className="flex-row mt-2">
                <Pressable
                  onPress={() => setMode('light')}
                  style={{
                    backgroundColor: mode === 'light' ? '#f97316' : (isDark ? '#27272a' : '#e4e4e7'),
                  }}
                  className="flex-1 py-3 rounded-xl mr-2 items-center flex-row justify-center"
                >
                  <Ionicons name="sunny" size={16} color={mode === 'light' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b')} />
                  <Text style={{ color: mode === 'light' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b') }} className="ml-2 font-medium">Light</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('dark')}
                  style={{
                    backgroundColor: mode === 'dark' ? '#f97316' : (isDark ? '#27272a' : '#e4e4e7'),
                  }}
                  className="flex-1 py-3 rounded-xl mr-2 items-center flex-row justify-center"
                >
                  <Ionicons name="moon" size={16} color={mode === 'dark' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b')} />
                  <Text style={{ color: mode === 'dark' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b') }} className="ml-2 font-medium">Dark</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('system')}
                  style={{
                    backgroundColor: mode === 'system' ? '#f97316' : (isDark ? '#27272a' : '#e4e4e7'),
                  }}
                  className="flex-1 py-3 rounded-xl items-center flex-row justify-center"
                >
                  <Ionicons name="phone-portrait" size={16} color={mode === 'system' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b')} />
                  <Text style={{ color: mode === 'system' ? '#fff' : (isDark ? '#a1a1aa' : '#52525b') }} className="ml-2 font-medium">Auto</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingRow
              icon="phone-portrait-outline"
              title="Haptic Feedback"
              subtitle="Vibration on interactions"
              value={hapticFeedback}
              onToggle={handleToggleHaptic}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        {/* Data Section */}
        <View className="mt-6">
          <Text style={{ color: isDark ? '#a1a1aa' : '#71717a' }} className="text-sm font-medium mb-2 px-1">DATA</Text>
          <View style={{ backgroundColor: isDark ? 'rgba(24, 24, 27, 0.5)' : '#f9fafb', borderColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="rounded-2xl border">
            <SettingButton
              icon="download-outline"
              title="Export Data"
              subtitle="Download your habit data"
              onPress={handleExportData}
              isDark={isDark}
              colors={colors}
            />
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingButton
              icon="cloud-upload-outline"
              title="Sync with Web"
              subtitle="Open FocusFlow web app"
              onPress={() => Linking.openURL(WEB_URL)}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        {/* Support Section */}
        <View className="mt-6">
          <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2 px-1">SUPPORT</Text>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-2xl border">
            <SettingButton
              icon="help-circle-outline"
              title="Help Center"
              subtitle="FAQs and guides"
              onPress={() => Linking.openURL(`${WEB_URL}/help`)}
              isDark={isDark}
              colors={colors}
            />
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingButton
              icon="chatbubble-outline"
              title="Send Feedback"
              subtitle="Help us improve"
              onPress={() => Linking.openURL('mailto:support@focusflow.app?subject=FocusFlow%20Feedback')}
              isDark={isDark}
              colors={colors}
            />
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingButton
              icon="globe-outline"
              title="Visit Website"
              subtitle="Open FocusFlow web"
              onPress={() => Linking.openURL(WEB_URL)}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        {/* Legal Section */}
        <View className="mt-6">
          <Text style={{ color: colors.textMuted }} className="text-sm font-medium mb-2 px-1">LEGAL</Text>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-2xl border">
            <SettingButton
              icon="document-text-outline"
              title="Privacy Policy"
              onPress={() => Linking.openURL(`${WEB_URL}/privacy`)}
              isDark={isDark}
              colors={colors}
            />
            <View style={{ backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7' }} className="h-px mx-4" />
            <SettingButton
              icon="shield-checkmark-outline"
              title="Terms of Service"
              onPress={() => Linking.openURL(`${WEB_URL}/terms`)}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View className="mt-6">
          {isSignedIn ? (
            <>
              <Pressable
                onPress={handleLogout}
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="rounded-2xl border p-4 flex-row items-center justify-center"
              >
                <Ionicons name="log-out-outline" size={20} color="#f97316" />
                <Text className="text-orange-500 font-medium ml-2">Sign Out</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteAccount}
                className="mt-3 bg-red-500/10 rounded-2xl border border-red-500/20 p-4 flex-row items-center justify-center"
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text className="text-red-500 font-medium ml-2">Delete Account</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Guest Mode Info Banner */}
              <View className="bg-amber-500/10 rounded-2xl border border-amber-500/20 p-4 mb-3">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="information-circle" size={20} color="#f59e0b" />
                  <Text className="text-amber-500 font-medium ml-2">Guest Mode</Text>
                </View>
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  Your data is stored locally on this device. Sign in to sync across devices and back up to the cloud.
                </Text>
              </View>

              <Pressable
                onPress={handleSignIn}
                className="bg-orange-500 rounded-2xl p-4 flex-row items-center justify-center"
              >
                <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                <Text className="text-white font-medium ml-2">Sign In to Sync Data</Text>
              </Pressable>

              <Pressable
                onPress={handleClearLocalData}
                className="mt-3 bg-red-500/10 rounded-2xl border border-red-500/20 p-4 flex-row items-center justify-center"
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text className="text-red-500 font-medium ml-2">Clear Local Data</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* App Version */}
        <View className="mt-6 mb-8 items-center">
          <Text style={{ color: colors.textMuted }} className="text-sm">FocusFlow v1.0.0</Text>
          <Text style={{ color: colors.textMuted }} className="text-xs mt-1 opacity-70">
            {isSignedIn ? `Synced with ${API_URL.replace('https://', '')}` : 'Data stored locally'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Setting Row with Toggle
function SettingRow({ icon, title, subtitle, value, onToggle, isDark = true, colors }: {
  icon: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  isDark?: boolean;
  colors: any;
}) {
  return (
    <View className="flex-row items-center p-4">
      <View style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} className="w-10 h-10 rounded-xl items-center justify-center">
        <Ionicons name={icon as any} size={20} color={isDark ? '#a1a1aa' : '#52525b'} />
      </View>
      <View className="flex-1 ml-3">
        <Text style={{ color: colors.text }} className="font-medium">{title}</Text>
        {subtitle && <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: isDark ? '#27272a' : '#d4d4d8', true: '#f97316' }}
        thumbColor={value ? '#ffffff' : (isDark ? '#71717a' : '#a1a1aa')}
      />
    </View>
  );
}

// Setting Button (navigable)
function SettingButton({ icon, title, subtitle, onPress, isDark = true, colors }: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDark?: boolean;
  colors: any;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center p-4">
      <View style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} className="w-10 h-10 rounded-xl items-center justify-center">
        <Ionicons name={icon as any} size={20} color={isDark ? '#a1a1aa' : '#52525b'} />
      </View>
      <View className="flex-1 ml-3">
        <Text style={{ color: colors.text }} className="font-medium">{title}</Text>
        {subtitle && <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
