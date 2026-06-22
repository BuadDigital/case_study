"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { progressMessageForActionLabel } from "../lib/action-progress-message";
import { bindGlobalActionToast } from "../lib/action-toast-listener";
import { cn } from "../lib/cn";

export type ToastTone = "success" | "error" | "info" | "progress";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  persistent?: boolean;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
  showProgressToast: (message: string) => string;
  dismissToast: (id: string) => void;
  runWithActionToast: (
    actionLabel: string,
    action: () => void | Promise<void>,
  ) => Promise<void>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

const toneClasses: Record<ToastTone, string> = {
  success: "border-success/40 bg-success-bg text-success-text",
  error: "border-danger/40 bg-danger-bg text-danger-text",
  info: "border-border bg-surface text-text-2",
  progress: "border-primary/30 bg-teal-light text-primary",
};

function newToastId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = newToastId();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      dismissToast(id);
    }, TOAST_DURATION_MS);
  }, [dismissToast]);

  const showProgressToast = useCallback((message: string) => {
    const id = newToastId();
    setToasts((current) => [
      ...current,
      { id, message, tone: "progress", persistent: true },
    ]);
    window.setTimeout(() => {
      dismissToast(id);
    }, 15000);
    return id;
  }, [dismissToast]);

  const runWithActionToast = useCallback(
    async (actionLabel: string, action: () => void | Promise<void>) => {
      const progressId = showProgressToast(
        progressMessageForActionLabel(actionLabel),
      );
      try {
        await action();
      } finally {
        dismissToast(progressId);
      }
    },
    [dismissToast, showProgressToast],
  );

  const value = useMemo(
    () => ({ showToast, showProgressToast, dismissToast, runWithActionToast }),
    [dismissToast, runWithActionToast, showProgressToast, showToast],
  );

  useEffect(() => {
    return bindGlobalActionToast(showProgressToast, dismissToast);
  }, [dismissToast, showProgressToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 start-4 z-[200] flex max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-[var(--radius-DEFAULT)] border px-3 py-2 text-[12px] shadow-sm ui-animate-fade-in",
              toneClasses[toast.tone],
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}
