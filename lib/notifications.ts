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
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Cancel existing reminders first to avoid duplicates
      await this.cancelAllReminders();

      const reminderTimes = [
        { hour: 6, title: "Morning Habit Check 🌅", body: "Rise and shine! Your habits are waiting. Don't start the day with unfinished business - check off your morning goals now!" },
        { hour: 11, title: "Mid-day Consistency Check ⚡", body: "Focus check! You still have incomplete habits for today. Don't let your streak slip away—take action now!" },
        { hour: 16, title: "Afternoon Habit Sync 🧘", body: "Consistency is power! Keep your daily goals on track and log your progress now!" },
        { hour: 21, title: "Evening Reflection 🌙", body: "Day's ending soon! Guard your streaks. Make sure you don't sleep on incomplete habits. Log your progress now!" },
      ];

      const now = new Date();

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date();
        checkDate.setDate(now.getDate() + dayOffset);

        for (const time of reminderTimes) {
          const triggerDate = new Date(checkDate);
          triggerDate.setHours(time.hour, 0, 0, 0);

          // If trigger time is in the past, skip it
          if (triggerDate <= now) {
            continue;
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: time.title,
              body: time.body,
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
  async updateScheduledReminders(reason: string, debounceMs = 0): Promise<void> {
    if (Platform.OS === 'web') return;

    console.log(`[Notifications] updateScheduledReminders triggered. Reason: ${reason}`);

    const execute = async () => {
      try {
        console.log(`[Notifications] Executing update of scheduled reminders. Trigger reason: ${reason}`);
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

