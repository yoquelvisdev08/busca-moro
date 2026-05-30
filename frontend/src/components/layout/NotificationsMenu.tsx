import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotificationStore,
  type AppNotification,
  type NotificationType,
} from "@/stores/notification-store";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
  warning: "text-warning",
};

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString();
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
}) {
  const Icon = TYPE_ICON[item.type];

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "w-full text-left px-3 py-2.5 flex gap-3 transition-colors rounded-md",
        "hover:bg-surface-high/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !item.read && "bg-primary/5 border-l-2 border-l-primary",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0 mt-0.5", TYPE_COLOR[item.type])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-text truncate">
            {item.title}
          </span>
          <span className="text-[10px] font-mono text-text-muted shrink-0">
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
          {item.message}
        </p>
      </div>
    </button>
  );
}

export function NotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const remove = useNotificationStore((s) => s.remove);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const handleOpenItem = (item: AppNotification) => {
    markRead(item.id);
    setOpen(false);
    if (item.href) {
      navigate(item.href);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  const panel =
    open &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[10001] bg-black/20 md:bg-transparent"
          aria-hidden
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificaciones"
          className={cn(
            "fixed z-[10002] w-[min(100vw-1.5rem,380px)]",
            "rounded-xl border border-border bg-surface-high shadow-lg",
            "flex flex-col overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-150",
          )}
          style={{
            top: triggerRef.current
              ? triggerRef.current.getBoundingClientRect().bottom + 8
              : 56,
            right: 16,
            maxHeight: "min(70vh, 440px)",
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
            <h2 className="text-sm font-headline font-semibold text-text">
              Notificaciones
              {unread > 0 && (
                <span className="ml-2 text-[10px] font-mono text-primary">
                  {unread} nuevas
                </span>
              )}
            </h2>
            <div className="flex items-center gap-0.5">
              {items.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => markAllRead()}
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-danger hover:text-danger"
                    onClick={() => clearAll()}
                    title="Vaciar todas"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-1">
            {items.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-10 px-4">
                No hay notificaciones. Las acciones del sistema aparecerán aquí.
              </p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="group relative">
                  <NotificationRow item={item} onOpen={handleOpenItem} />
                  <button
                    type="button"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-danger transition-opacity"
                    aria-label="Eliminar notificación"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(item.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-border p-2 shrink-0">
              <button
                type="button"
                className="w-full text-xs text-center text-primary hover:underline py-1"
                onClick={() => markAllRead()}
              >
                Marcar todas como leídas
              </button>
            </div>
          )}
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : "Notificaciones"
        }
        className={cn(
          "relative p-2 rounded text-text-muted hover:text-primary",
          "hover:bg-surface transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-surface text-primary",
        )}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-container text-[10px] font-bold text-white flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
