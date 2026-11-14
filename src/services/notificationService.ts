import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { NotificationItem } from '../types/database';

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return data as NotificationItem[];
}

export async function markNotificationRead(notificationId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: NotificationItem) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const client = supabase;
  let active = true;
  const topic = `notifications:${userId}:${Math.random().toString(36).slice(2, 8)}`;
  const channel = client
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (active && payload.new) {
          onInsert(payload.new as NotificationItem);
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    void client.removeChannel(channel);
  };
}
