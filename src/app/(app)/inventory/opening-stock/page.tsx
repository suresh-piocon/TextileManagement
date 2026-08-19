"use client";

import { usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoonPage() {
  const pathname = usePathname();
  const pageName = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " "))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" → ");

  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <Construction className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h2>
          <p className="text-slate-500 mb-4">
            The <strong>{pageName}</strong> module is under development and will be available in the next phase.
          </p>
          <p className="text-xs text-slate-400">
            Phase 2+ feature
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

