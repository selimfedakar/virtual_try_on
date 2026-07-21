import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_FLAG_KEY = 'vto_daily_outfit_reminder_enabled';
const NOTIFICATION_ID_KEY = 'vto_daily_outfit_reminder_id';

// Show local notifications as banners even if the app happens to be foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function isDailyOutfitReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_FLAG_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * Schedules the local "what to wear" reminder, repeating daily at 9:00 AM.
 * Requests notification permission if needed.
 * @returns true when scheduled, false when permission was denied.
 */
export async function enableDailyOutfitReminder(): Promise<boolean> {
  let settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) {
    settings = await Notifications.requestPermissionsAsync();
  }
  if (!settings.granted) return false;

  // Cancel a possible stale schedule before re-scheduling.
  await cancelScheduled();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'What are you wearing today?',
      body: 'Try it on in VTO ✨',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id).catch(() => {});
  await AsyncStorage.setItem(ENABLED_FLAG_KEY, '1').catch(() => {});
  return true;
}

export async function disableDailyOutfitReminder(): Promise<void> {
  await cancelScheduled();
  await AsyncStorage.removeItem(ENABLED_FLAG_KEY).catch(() => {});
}

async function cancelScheduled(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }
  } catch {}
}
