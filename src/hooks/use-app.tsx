"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser, Company, Session, UserPermission } from "@/types/database";

interface AppContextType {
  user: AuthUser | null;
  company: Company | null;
  session: Session | null;
  permissions: UserPermission[];
  setUser: (user: AuthUser | null) => void;
  setCompany: (company: Company | null) => void;
  setSession: (session: Session | null) => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (menuId: number, right: "add" | "edit" | "delete" | "view" | "print") => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("retailtex_auth");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.user) setUser(data.user);
        if (data.company) setCompany(data.company);
        if (data.session) setSession(data.session);
      } catch {
        localStorage.removeItem("retailtex_auth");
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "retailtex_auth",
        JSON.stringify({ user, company, session })
      );
    }
  }, [user, company, session]);

  // Load permissions when user changes
  useEffect(() => {
    if (user) {
      loadPermissions(user.am_ref_no);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPermissions = async (userId: number) => {
    const { data } = await supabase
      .from("user_permission")
      .select("*")
      .eq("user_id", userId);
    if (data) setPermissions(data);
  };

  const login = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from("admin")
        .select("am_ref_no, user_name, user_type, user_status")
        .eq("user_name", username)
        .eq("user_password", password)
        .single();

      if (error || !data) {
        return { success: false, error: "Invalid username or password" };
      }

      if (data.user_status === "Inactive") {
        return { success: false, error: "User account is inactive" };
      }

      const authUser: AuthUser = {
        am_ref_no: data.am_ref_no,
        user_name: data.user_name,
        user_type: data.user_type,
      };

      setUser(authUser);

      // Log the login
      await supabase.from("user_log_info").insert({
        user_id: authUser.am_ref_no,
        log_date: new Date().toISOString(),
        log_in_time: new Date().toLocaleTimeString(),
        machine_name: navigator.userAgent.substring(0, 100),
      });

      return { success: true };
    } catch {
      return { success: false, error: "Login failed. Please try again." };
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setCompany(null);
    setSession(null);
    setPermissions([]);
    localStorage.removeItem("retailtex_auth");
  }, []);

  const hasPermission = (menuId: number, right: "add" | "edit" | "delete" | "view" | "print") => {
    if (user?.user_type === "Administrator") return true;
    const perm = permissions.find((p) => p.menu_id === menuId);
    if (!perm) return false;
    switch (right) {
      case "add": return perm.add_right;
      case "edit": return perm.edit_right;
      case "delete": return perm.delete_right;
      case "view": return perm.view_right;
      case "print": return perm.print_right;
      default: return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        company,
        session,
        permissions,
        setUser,
        setCompany,
        setSession,
        login,
        logout,
        isLoading,
        hasPermission,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
