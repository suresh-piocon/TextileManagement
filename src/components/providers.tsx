"use client";

import { AppProvider } from "@/hooks/use-app";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppProvider>
  );
}
