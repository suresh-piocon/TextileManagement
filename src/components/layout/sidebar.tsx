"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MENU_ITEMS, type MenuItem } from "@/lib/constants";
import {
  LayoutDashboard, Database, ArrowLeftRight, CreditCard, Factory,
  Warehouse, BarChart3, Settings, ChevronDown, ChevronRight,
  FolderTree, BookOpen, Layers, Package, Palette, Rows3, Columns3,
  Ruler, Receipt, ShoppingCart, RotateCcw, FileText, Store, PackageX,
  Truck, Building2, Undo2, PackagePlus, Download, Upload, ArrowUpDown,
  FileDown, FileUp, Boxes, Cable, Pipette, Grid3x3, Cog, Workflow,
  Calculator, Barcode, TrendingUp, ClipboardList, ScanBarcode, FolderOpen,
  FileSpreadsheet, IndianRupee, Scale, Sheet, Clock,
  Building, SlidersHorizontal, Users, Shield, CalendarRange, Menu, X,
} from "lucide-react";

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Database, ArrowLeftRight, CreditCard, Factory,
  Warehouse, BarChart3, Settings, FolderTree, BookOpen, Layers, Package,
  Palette, Rows3, Columns3, Ruler, Receipt, ShoppingCart, RotateCcw,
  FileText, Store, PackageX, Truck, Building2, Undo2, PackagePlus,
  Download, Upload, ArrowUpDown, FileDown, FileUp, Boxes, Cable,
  Pipette, Grid3x3, Cog, Workflow, Calculator, Barcode, TrendingUp,
  ClipboardList, ScanBarcode, FolderOpen, FileSpreadsheet, IndianRupee,
  Scale, Sheet, Clock, Building, SlidersHorizontal, Users, Shield, CalendarRange,
};

function getIcon(name: string) {
  return iconMap[name] || LayoutDashboard;
}

function SidebarItem({ item, depth = 0 }: { item: MenuItem; depth?: number }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(
    item.children?.some((child) =>
      child.href ? pathname.startsWith(child.href) : false
    ) || false
  );

  const Icon = getIcon(item.icon);
  const isActive = item.href === pathname;
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center w-full gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
            "hover:bg-slate-100 text-slate-700",
            depth > 0 && "pl-9"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        {isOpen && (
          <div className="ml-2 mt-1 space-y-0.5">
            {item.children!.map((child) => (
              <SidebarItem key={child.id} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || "#"}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
        isActive
          ? "bg-slate-900 text-white font-medium"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        depth > 0 && "pl-9"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200">
          <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">RetailTex</h1>
            <p className="text-xs text-slate-500">Textile Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {MENU_ITEMS.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
