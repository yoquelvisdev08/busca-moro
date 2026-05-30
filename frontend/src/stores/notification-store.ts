import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  href?: string;
}

const MAX_NOTIFICATIONS = 50;

interface NotificationState {
  items: AppNotification[];
  add: (item: Omit<AppNotification, "id" | "read" | "createdAt">) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

function createId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item) => {
        const id = createId();
        const notification: AppNotification = {
          ...item,
          id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          items: [notification, ...state.items].slice(0, MAX_NOTIFICATIONS),
        }));
        return id;
      },

      markRead: (id) =>
        set((state) => ({
          items: state.items.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllRead: () =>
        set((state) => ({
          items: state.items.map((n) => ({ ...n, read: true })),
        })),

      remove: (id) =>
        set((state) => ({
          items: state.items.filter((n) => n.id !== id),
        })),

      clearAll: () => set({ items: [] }),

      unreadCount: () => get().items.filter((n) => !n.read).length,
    }),
    {
      name: "siphon-notifications",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
