import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../../services/notificationService';
import type { NotificationItem } from '../../types/database';

export function NotificationBell() {
  const { user, isConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !isConfigured) {
      setItems([]);
      return;
    }

    fetchNotifications(user.id)
      .then(setItems)
      .catch(() => undefined);

    const unsubscribe = subscribeToNotifications(user.id, (incoming) => {
      setItems((prev) => [incoming, ...prev]);
    });

    return unsubscribe;
  }, [user, isConfigured]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = items.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markNotificationRead(id).catch(() => undefined);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(user.id).catch(() => undefined);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="font-mono-tabular absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C62828] px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="In-app notifications"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#C62828] hover:underline dark:text-red-400"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications yet.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`px-4 py-3 transition-colors ${
                    item.is_read
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-red-50/50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(item.id)}
                        className="shrink-0 text-[11px] font-medium text-[#C62828] hover:underline dark:text-red-400"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.message}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    {item.link && (
                      <Link
                        to={item.link}
                        onClick={() => {
                          handleMarkRead(item.id);
                          setOpen(false);
                        }}
                        className="font-medium text-slate-700 hover:underline dark:text-slate-200"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
