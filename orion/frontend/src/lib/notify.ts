import toast, { type Toast } from "react-hot-toast";
import type { NotificationType } from "@/stores/notification-store";
import { useNotificationStore } from "@/stores/notification-store";

export interface NotifyOptions {
  title?: string;
  href?: string;
  /** Solo guardar en el panel, sin toast flotante */
  silent?: boolean;
  duration?: number;
}

const DEFAULT_TITLES: Record<NotificationType, string> = {
  success: "Éxito",
  error: "Error",
  info: "Información",
  warning: "Aviso",
};

function pushHistory(
  type: NotificationType,
  message: string,
  options?: NotifyOptions,
) {
  useNotificationStore.getState().add({
    type,
    title: options?.title ?? DEFAULT_TITLES[type],
    message,
    href: options?.href,
  });
}

function showToast(
  type: NotificationType,
  message: string,
  options?: NotifyOptions,
) {
  const duration = options?.duration ?? (type === "error" ? 5000 : 3500);
  const toastOpts = { duration };

  switch (type) {
    case "success":
      toast.success(message, toastOpts);
      break;
    case "error":
      toast.error(message, toastOpts);
      break;
    case "warning":
      toast(message, { ...toastOpts, icon: "⚠" });
      break;
    default:
      toast(message, toastOpts);
  }
}

function emit(type: NotificationType, message: string, options?: NotifyOptions) {
  pushHistory(type, message, options);
  if (!options?.silent) {
    showToast(type, message, options);
  }
}

export const notify = {
  success: (message: string, options?: NotifyOptions) =>
    emit("success", message, options),
  error: (message: string, options?: NotifyOptions) =>
    emit("error", message, options),
  info: (message: string, options?: NotifyOptions) =>
    emit("info", message, options),
  warning: (message: string, options?: NotifyOptions) =>
    emit("warning", message, options),

  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string | ((err: unknown) => string);
    },
    options?: NotifyOptions,
  ): Promise<T> {
    const resolveError = (err: unknown) =>
      typeof messages.error === "function"
        ? messages.error(err)
        : err instanceof Error
          ? err.message
          : messages.error;

    return toast
      .promise(
        promise,
        {
          loading: messages.loading,
          success: messages.success,
          error: (err) => resolveError(err),
        },
        { duration: 4000 },
      )
      .then((result) => {
        pushHistory("success", messages.success, options);
        return result;
      })
      .catch((err: unknown) => {
        pushHistory("error", resolveError(err), options);
        throw err;
      });
  },

  /** Compatibilidad con APIs que devuelven id de toast */
  dismiss: (toastId?: string) => {
    if (toastId) toast.dismiss(toastId);
    else toast.dismiss();
  },

  custom: toast.custom,
  loading: (message: string, options?: NotifyOptions): string => {
    pushHistory("info", message, {
      ...options,
      title: options?.title ?? "Cargando",
    });
    return toast.loading(message);
  },
};

export type { Toast };
