"use client";

import { AppProvider } from "@/hooks/use-app";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-50">
          <Sidebar />
          <div className="lg:ml-64">
            <Header />
            <main className="p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
