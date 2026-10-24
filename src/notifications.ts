import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Note } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepareNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('notify-reminders', {
      name: 'Notify reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#F2B23D',
    });
  }
}

export async function syncReminder(note: Note): Promise<string | undefined> {
  if (note.notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(note.notificationId);
    } catch {
      // A reminder may already have fired or been removed by the operating system.
    }
  }

  if (!note.reminderAt || note.reminderAt <= Date.now()) return undefined;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return undefined;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: note.important ? '★ Important · Notify' : 'Notify reminder',
      body: note.title.trim() || note.body.trim() || 'You saved a reminder.',
      sound: true,
      data: { noteId: note.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(note.reminderAt),
      ...(Platform.OS === 'android' ? { channelId: 'notify-reminders' } : {}),
    },
  });
}
