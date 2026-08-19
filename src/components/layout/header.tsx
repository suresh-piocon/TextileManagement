"use client";

import { useApp } from "@/hooks/use-app";
import { formatDate } from "@/lib/utils";
import { Building, CalendarRange, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, company, session, logout } = useApp();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
      {/* Left: Company & Session Info */}
      <div className="flex items-center gap-6 ml-10 lg:ml-0">
        {company && (
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-900">{company.frm_name}</span>
          </div>
        )}
        {session && (
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
            <CalendarRange className="h-4 w-4" />
            <span>
              {formatDate(session.sn_from_year)} — {formatDate(session.sn_to_year)}
            </span>
          </div>
        )}
      </div>

      {/* Right: User Info & Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div className="hidden sm:block">
              <p className="font-medium text-slate-900">{user.user_name}</p>
              <p className="text-xs text-slate-500">{user.user_type}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
