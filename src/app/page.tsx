"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const stored = localStorage.getItem("retailtex_auth");
    if (stored) {
      const data = JSON.parse(stored);
      if (data.user && data.company && data.session) {
        router.push("/dashboard");
      } else if (data.user && !data.company) {
        router.push("/company");
      } else {
        router.push("/login");
      }
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
    </div>
  );
}
