import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'habit-reminders';
const PROMPTED_KEY = '@focusflow_notifications_prompted';

// Set up the default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export const notificationsManager = {
  /** True if notifications are already allowed. Never shows a prompt. */
  async hasPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[Notifications] Failed to read permission status:', error);
      return false;
    }
  },

  /**
   * Shows the system permission prompt if needed. Only call this in response to
   * a user action (e.g. turning reminders on), never on app start.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      if (await this.hasPermission()) return true;

      // Android 8+ needs a channel before the prompt can be shown (Android 13+).
      await ensureAndroidChannel();
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('[Notifications] Permission not granted for local notifications.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Notifications] Failed to request permissions:', error);
      return false;
    }
  },

  /**
   * Asks for permission once, at a moment where it makes sense (after the user
   * creates a habit), and only if reminders are enabled in settings.
   */
  async askOnceIfRemindersEnabled(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      if (await AsyncStorage.getItem(PROMPTED_KEY)) return;
      const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
      const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');
      if (notifyVal === 'false' || dailyVal === 'false') return;

      await AsyncStorage.setItem(PROMPTED_KEY, 'true');
      if (await this.requestPermissions()) {
        await this.updateScheduledReminders('permission granted after first habit');
      }
    } catch (error) {
      console.error('[Notifications] Failed to ask for permission:', error);
    }
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
  async scheduleOfflineReminders(askPermission = false): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // Background refreshes only check; the prompt is shown only when asked for.
      const hasPermission = askPermission ? await this.requestPermissions() : await this.hasPermission();
      if (!hasPermission) return;

      await ensureAndroidChannel();

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
              channelId: REMINDER_CHANNEL_ID,
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
  async initializeNotifications(isEnabled: boolean, askPermission = false): Promise<void> {
    if (isEnabled) {
      await this.scheduleOfflineReminders(askPermission);
    } else {
      await this.cancelAllReminders();
    }
  },

  /**
   * Loads settings and refreshes scheduled reminders.
   * Pass `askPermission: true` only from a user action; otherwise no prompt is shown.
   */
  async updateScheduledReminders(
    reason: string,
    debounceMs = 0,
    options: { askPermission?: boolean } = {}
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    console.log(`[Notifications] updateScheduledReminders triggered. Reason: ${reason}`);

    const execute = async () => {
      try {
        console.log(`[Notifications] Executing update of scheduled reminders. Trigger reason: ${reason}`);
        const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
        const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');

        const notificationsEnabled = notifyVal !== null ? notifyVal === 'true' : true;
        const dailyReminderEnabled = dailyVal !== null ? dailyVal === 'true' : true;

        await this.initializeNotifications(
          notificationsEnabled && dailyReminderEnabled,
          options.askPermission ?? false
        );
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
