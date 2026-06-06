import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set up the default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

export const notificationsManager = {
  // Request user permissions for push notifications
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Failed to get permissions for local notifications.');
      return false;
    }

    return true;
  },

  // Cancel all scheduled notifications
  async cancelAllReminders(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] Cancelled all scheduled notifications.');
    } catch (error) {
      console.error('[Notifications] Failed to cancel notifications:', error);
    }
  },

  // Schedule reminders for the next 7 days (at 6 AM, 11 AM, 4 PM, 9 PM)
  async scheduleOfflineReminders(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // 1. Cancel existing reminders first to avoid duplicates
      await this.cancelAllReminders();

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // 2. Fetch habits and entries from AsyncStorage
      const habitsData = await AsyncStorage.getItem('@focusflow_habits');
      const entriesData = await AsyncStorage.getItem('@focusflow_entries');

      const habits: any[] = habitsData ? JSON.parse(habitsData) : [];
      const entries: any[] = entriesData ? JSON.parse(entriesData) : [];

      // Only count active habits
      const activeHabits = habits.filter(h => h.active !== false);
      if (activeHabits.length === 0) {
        console.log('[Notifications] No active habits. Skipping scheduling.');
        return;
      }

      // Check today's completions (using YYYY-MM-DD local format)
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const todayEntries = entries.filter(e => e.entryDate === todayStr && e.completed === true);
      const incompleteCount = activeHabits.length - todayEntries.length;
      const allCompletedToday = incompleteCount <= 0;

      const reminderTimes = [
        { hour: 6, title: "Morning Habit Check 🌅", body: "Rise and shine! Your habits are waiting. Don't start the day with unfinished business - check off your morning goals now!" },
        { hour: 11, title: "Mid-day Consistency Check ⚡", body: "Focus check! You still have incomplete habits for today. Don't let your streak slip away—take action now!" },
        { hour: 16, title: "Afternoon Habit Sync 🧘", body: "Consistency is power! Some of your daily tasks are still marked as 'not done'. Take a quick 2-minute break and complete them!" },
        { hour: 21, title: "Evening Reflection 🌙", body: "Day's ending soon! Guard your streaks. Make sure you don't sleep on incomplete habits. Log your progress now!" },
      ];

      const now = new Date();

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date();
        checkDate.setDate(now.getDate() + dayOffset);

        // For today (dayOffset === 0)
        if (dayOffset === 0) {
          if (allCompletedToday) {
            console.log('[Notifications] Today\'s habits are all complete. Skipping today\'s reminders.');
            continue;
          }
        }

        for (const time of reminderTimes) {
          const triggerDate = new Date(checkDate);
          triggerDate.setHours(time.hour, 0, 0, 0);

          // If trigger time is in the past, skip it
          if (triggerDate <= now) {
            continue;
          }

          // For today, customize the message with the exact number of incomplete habits!
          let title = time.title;
          let body = time.body;

          if (dayOffset === 0) {
            title = "Habits Pending! ⚠️";
            body = `You have ${incompleteCount} habit${incompleteCount > 1 ? 's' : ''} left to complete today. Keep your streak alive!`;
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: title,
              body: body,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
            },
          });
        }
      }
      console.log('[Notifications] Successfully scheduled all reminders for the next 7 days.');
    } catch (error) {
      console.error('[Notifications] Error scheduling reminders:', error);
    }
  },

  // Initialize notifications state
  async initializeNotifications(isEnabled: boolean): Promise<void> {
    if (isEnabled) {
      await this.scheduleOfflineReminders();
    } else {
      await this.cancelAllReminders();
    }
  },

  // Helper to load settings and refresh scheduled reminders
  async updateScheduledReminders(debounceMs = 0): Promise<void> {
    if (Platform.OS === 'web') return;

    const execute = async () => {
      try {
        const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
        const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');

        const notificationsEnabled = notifyVal !== null ? notifyVal === 'true' : true;
        const dailyReminderEnabled = dailyVal !== null ? dailyVal === 'true' : true;

        await this.initializeNotifications(notificationsEnabled && dailyReminderEnabled);
      } catch (error) {
        console.error('[Notifications] Failed to update scheduled reminders:', error);
      }
    };

    if (debounceMs > 0) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        execute();
      }, debounceMs);
    } else {
      await execute();
    }
  }
};

