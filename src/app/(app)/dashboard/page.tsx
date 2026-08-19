"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/hooks/use-app";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingCart, Store, Package, Users, TrendingUp,
  TrendingDown, IndianRupee, AlertTriangle,
} from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  totalLedgers: number;
  totalPurchases: number;
  totalSales: number;
  purchaseAmount: number;
  salesAmount: number;
  lowStockItems: number;
  pendingEstimates: number;
}

export default function DashboardPage() {
  const { company, session } = useApp();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalLedgers: 0,
    totalPurchases: 0,
    totalSales: 0,
    purchaseAmount: 0,
    salesAmount: 0,
    lowStockItems: 0,
    pendingEstimates: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (company) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const loadStats = async () => {
    if (!company) return;
    setLoading(true);

    try {
      const frmCode = company.frm_code;

      // Product count
      const { count: productCount } = await supabase
        .from("product")
        .select("*", { count: "exact", head: true })
        .eq("frm_code", frmCode);

      // Ledger count
      const { count: ledgerCount } = await supabase
        .from("ledger")
        .select("*", { count: "exact", head: true })
        .eq("frm_code", frmCode);

      // Purchase count and total
      const { data: purchases } = await supabase
        .from("pur_mast")
        .select("pm_net_total")
        .eq("pm_frm_code", frmCode);

      // Sales count and total
      const { data: sales } = await supabase
        .from("retail_sale_mast")
        .select("rm_net_total")
        .eq("rm_frm_code", frmCode);

      // Pending estimates
      const { count: pendingEst } = await supabase
        .from("estimate_mast")
        .select("*", { count: "exact", head: true })
        .eq("frm_code", frmCode)
        .eq("status", "Pending");

      setStats({
        totalProducts: productCount || 0,
        totalLedgers: ledgerCount || 0,
        totalPurchases: purchases?.length || 0,
        totalSales: sales?.length || 0,
        purchaseAmount: purchases?.reduce((sum, p) => sum + (p.pm_net_total || 0), 0) || 0,
        salesAmount: sales?.reduce((sum, s) => sum + (s.rm_net_total || 0), 0) || 0,
        lowStockItems: 0,
        pendingEstimates: pendingEst || 0,
      });
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    }

    setLoading(false);
  };

  const statCards = [
    {
      title: "Total Products",
      value: stats.totalProducts.toString(),
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Ledger Accounts",
      value: stats.totalLedgers.toString(),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Total Purchases",
      value: stats.totalPurchases.toString(),
      subtitle: formatCurrency(stats.purchaseAmount),
      icon: ShoppingCart,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Total Sales",
      value: stats.totalSales.toString(),
      subtitle: formatCurrency(stats.salesAmount),
      icon: Store,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Purchase Value",
      value: formatCurrency(stats.purchaseAmount),
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Sales Value",
      value: formatCurrency(stats.salesAmount),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Pending Estimates",
      value: stats.pendingEstimates.toString(),
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Net Profit/Loss",
      value: formatCurrency(stats.salesAmount - stats.purchaseAmount),
      icon: IndianRupee,
      color: stats.salesAmount >= stats.purchaseAmount ? "text-green-600" : "text-red-600",
      bg: stats.salesAmount >= stats.purchaseAmount ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome to RetailTex{company ? ` — ${company.frm_name}` : ""}
          {session ? ` | FY ${session.header}` : ""}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-8 bg-slate-200 rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{card.title}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {card.value}
                    </p>
                    {card.subtitle && (
                      <p className="text-sm text-slate-500 mt-1">{card.subtitle}</p>
                    )}
                  </div>
                  <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "New Purchase", href: "/transaction/purchase", icon: ShoppingCart },
            { label: "POS Sale", href: "/transaction/retail-sale", icon: Store },
            { label: "Receipt", href: "/voucher/receipt", icon: TrendingUp },
            { label: "Payment", href: "/voucher/payment", icon: TrendingDown },
            { label: "New Ledger", href: "/master/ledger", icon: Users },
            { label: "Stock Report", href: "/reports/stock-report", icon: Package },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all text-center"
            >
              <action.icon className="h-6 w-6 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
