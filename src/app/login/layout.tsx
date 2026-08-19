import { AppProvider } from "@/hooks/use-app";
import { ToastProvider } from "@/components/ui/toast";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppProvider>
  );
}
