import toast from "react-hot-toast";

export interface NotifyOptions {
  duration?: number;
}

export const notify = {
  success: (message: string, options?: NotifyOptions) =>
    toast.success(message, { duration: options?.duration ?? 3500 }),
  error: (message: string, options?: NotifyOptions) =>
    toast.error(message, { duration: options?.duration ?? 5000 }),
  info: (message: string, options?: NotifyOptions) =>
    toast(message, { duration: options?.duration ?? 3500 }),
  warning: (message: string, options?: NotifyOptions) =>
    toast(message, { duration: options?.duration ?? 4000, icon: "!" }),
};
