"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastAction {
  label: string;
  onClick: () => void;
}
type ToastTone = "default" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  tone: ToastTone;
}

export interface ToastOptions {
  message: string;
  action?: ToastAction;
  tone?: ToastTone;
  duration?: number;
}

interface ToastCtx {
  toast: (opts: ToastOptions) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq.current;
      setItems((prev) => [
        ...prev,
        { id, message: opts.message, action: opts.action, tone: opts.tone ?? "default" },
      ]);
      const duration = opts.duration ?? (opts.action ? 6000 : 3200);
      window.setTimeout(() => remove(id), duration);
    },
    [remove]
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-fade-slide-in pointer-events-auto flex items-center gap-3 rounded-lg border bg-popover px-3.5 py-2.5 text-sm text-popover-foreground shadow-lg"
          >
            <span
              className={cn(
                t.tone === "success" && "text-emerald-500",
                t.tone === "error" && "text-rose-500"
              )}
            >
              {t.message}
            </span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  remove(t.id);
                }}
                className="shrink-0 font-medium text-primary hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
