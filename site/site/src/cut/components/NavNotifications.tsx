"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/queries/notifications";

// Real per-user notifications — populated when a submission gets reviewed
// or a withdrawal/giveaway payout changes status. Polls every 30s.
export function NavNotifications() {
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative grid size-9 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[popup-open]:bg-sidebar-accent"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-primary" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" side="bottom">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.isLoading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !notifications.data?.notifications.length ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {notifications.data.notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead();

  const content = (
    <div
      className={cn(
        "block rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/60",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-2">
        {!notification.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{notification.title}</p>
          {notification.body && (
            <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );

  const onClick = () => {
    if (!notification.read) markRead.mutate(notification.id);
  };

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="block w-full">
      {content}
    </button>
  );
}
