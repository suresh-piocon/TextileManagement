"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Boxes,
  PackageCheck,
  PackageX,
  Building2,
  Calendar,
  Eye,
  Layers,
  Hash,
  TrendingUp,
  Printer,
  ChevronRight,
  ChevronDown,
  Info,
  ArrowUpDown,
  PlusCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Individual Product Stock Record
export interface StockItem {
  sno: number;
  productId: number;
  productName: string;
  productCode: string;
  groupName: string;
  groupId: number;
  hsnCode: string;
  vendorName: string;
  vendorId: number;
  // Metrics matching Excel sheet
  opQty: number;
  opRate: number;
  opAmount: number;
  inwQty: number;
  inwRate: number;
  inwAmount: number;
  outQty: number;
  outRate: number;
  outAmount: number;
  stock: number;
  clRate: number;
  clAmount: number;
  cogsValue: number;
  profit: number;
  margin: number;
  // Raw batches for drill-down
  batches?: {
    batchNo: string;
    purcRate: number;
    salesRate: number;
    costRate: number;
    vendorName: string;
    soldStatus: string;
    qty: number;
  }[];
}

// Grouped Structure for Section Rendering
export interface StockSectionGroup {
  key: string;
  title: string;
  items: StockItem[];
  totals: {
    count: number;
    opQty: number;
    opAmount: number;
    inwQty: number;
    inwAmount: number;
    outQty: number;
    outAmount: number;
    stock: number;
    clAmount: number;
    cogsValue: number;
    profit: number;
  };
}

export default function StockReportPage() {
  const router = useRouter();
  const { company } = useApp();
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [rawStockItems, setRawStockItems] = useState<StockItem[]>([]);

  // Report View Mode: 'closing' (Group-wise) | 'detailed' (HSN-wise) | 'flat' (Flat List)
  const [viewMode, setViewMode] = useState<"closing" | "detailed" | "flat">("closing");

  // Filters State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedHsn, setSelectedHsn] = useState<string>("");
  const [stockStatus, setStockStatus] = useState<string>("all"); // all | in_stock | out_of_stock | negative
  const [fromDate, setFromDate] = useState<string>("2026-04-01");
  const [toDate, setToDate] = useState<string>("2027-03-31");

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Drilldown Modal
  const [drilldownItem, setDrilldownItem] = useState<StockItem | null>(null);

  // Data Loading Engine
  const loadStockData = useCallback(async () => {
    setLoading(true);
    try {
      if (!company?.frm_code) {
        setRawStockItems([]);
        setLoading(false);
        return;
      }

      const frmCode = company.frm_code;

      // 1. Fetch Products, Product Groups, Ledgers, Barcode Batches, Opening Stock, and Transactions in Parallel
      const [
        prodRes,
        grpRes,
        ledgRes,
        barRes,
        oppRes,
        purChildRes,
        purRetRes,
        retSaleRes,
        retSaleRetRes,
        wsSaleRes,
        wsRetRes,
        inwRes,
      ] = await Promise.all([
        supabase.from("product").select("*").eq("frm_code", frmCode),
        supabase.from("product_group").select("*").eq("frm_code", frmCode),
        supabase.from("ledger").select("ledg_code, ledg_name").eq("frm_code", frmCode),
        supabase.from("bar_temp").select("*").eq("frm_code", frmCode).order("bar_ref_id", { ascending: true }),
        supabase.from("prod_opp_bal").select("*").eq("frm_code", frmCode),
        supabase.from("pur_child").select("*").eq("frm_code", frmCode),
        supabase.from("pur_ret_child").select("*").eq("frm_code", frmCode),
        supabase.from("retail_sale_child").select("*").eq("frm_code", frmCode),
        supabase.from("retail_sale_ret_child").select("*").eq("frm_code", frmCode),
        supabase.from("wholesale_child").select("*").eq("frm_code", frmCode),
        supabase.from("wholesale_ret_child").select("*").eq("frm_code", frmCode),
        supabase.from("inward").select("*").eq("frm_code", frmCode),
      ]);

      const products = prodRes.data || [];
      const groups = grpRes.data || [];
      const ledgers = ledgRes.data || [];
      const barcodes = barRes.data || [];
      const oppBalances = oppRes.data || [];
      const purRows = purChildRes.data || [];
      const purRetRows = purRetRes.data || [];
      const retSaleRows = retSaleRes.data || [];
      const retSaleRetRows = retSaleRetRes.data || [];
      const wsSaleRows = wsSaleRes.data || [];
      const wsRetRows = wsRetRes.data || [];
      const inwRows = inwRes.data || [];

      // Lookups
      const groupMap = new Map<number, any>(groups.map((g) => [g.ref_no, g]));
      const ledgerMap = new Map<number, string>(ledgers.map((l) => [l.ledg_code, l.ledg_name]));

      // Aggregators per Product ID
      // 1. Opening Balance Map
      const oppMap = new Map<number, { qty: number; rate: number; amount: number; vendorId: number }>();
      oppBalances.forEach((op: any) => {
        const pId = op.prd_code || 0;
        const q = Number(op.opp_qty) || 0;
        const r = Number(op.prate) || 0;
        const val = Number(op.value) || q * r;
        const vId = op.cr_code || 0;
        const prev = oppMap.get(pId) || { qty: 0, rate: 0, amount: 0, vendorId: vId };
        oppMap.set(pId, {
          qty: prev.qty + q,
          rate: r || prev.rate,
          amount: prev.amount + val,
          vendorId: vId || prev.vendorId,
        });
      });

      // 2. Purchases & Inward Map
      const inwMap = new Map<number, { qty: number; amount: number; lastRate: number; vendorId: number }>();
      purRows.forEach((pc: any) => {
        const pId = pc.pc_prcode || 0;
        const q = Number(pc.pc_qty) || 0;
        const r = Number(pc.pc_pur_rate) || 0;
        const tot = Number(pc.pc_net_tot || pc.pc_total) || q * r;
        const vId = pc.cr_code || 0;
        const prev = inwMap.get(pId) || { qty: 0, amount: 0, lastRate: r, vendorId: vId };
        inwMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: r || prev.lastRate,
          vendorId: vId || prev.vendorId,
        });
      });

      inwRows.forEach((iw: any) => {
        const pId = iw.pc_prcode || 0;
        const q = Number(iw.pc_qty) || 0;
        const r = Number(iw.pc_pc_rate) || 0;
        const tot = q * r;
        const vId = iw.cr_code || 0;
        const prev = inwMap.get(pId) || { qty: 0, amount: 0, lastRate: r, vendorId: vId };
        inwMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: r || prev.lastRate,
          vendorId: vId || prev.vendorId,
        });
      });

      // Add Sales Returns into Inward
      retSaleRetRows.forEach((sr: any) => {
        const pId = sr.dc_prcode || 0;
        const q = Number(sr.dc_qty) || 0;
        const r = Number(sr.dc_rate) || 0;
        const tot = Number(sr.dc_net_tot) || q * r;
        const prev = inwMap.get(pId) || { qty: 0, amount: 0, lastRate: r, vendorId: 0 };
        inwMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: prev.lastRate || r,
          vendorId: prev.vendorId,
        });
      });

      wsRetRows.forEach((wr: any) => {
        const pId = wr.prcode || 0;
        const q = Number(wr.qty) || 0;
        const r = Number(wr.rate) || 0;
        const tot = Number(wr.net_tot) || q * r;
        const prev = inwMap.get(pId) || { qty: 0, amount: 0, lastRate: r, vendorId: 0 };
        inwMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: prev.lastRate || r,
          vendorId: prev.vendorId,
        });
      });

      // 3. Outward (Sales + Purchase Returns) Map
      const outMap = new Map<number, { qty: number; amount: number; lastRate: number }>();
      retSaleRows.forEach((rs: any) => {
        const pId = rs.dc_prcode || 0;
        const q = Number(rs.dc_qty) || 0;
        const r = Number(rs.dc_rate) || 0;
        const tot = Number(rs.dc_net_tot) || q * r;
        const prev = outMap.get(pId) || { qty: 0, amount: 0, lastRate: r };
        outMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: r || prev.lastRate,
        });
      });

      wsSaleRows.forEach((ws: any) => {
        const pId = ws.prcode || 0;
        const q = Number(ws.qty) || 0;
        const r = Number(ws.rate) || 0;
        const tot = Number(ws.net_tot) || q * r;
        const prev = outMap.get(pId) || { qty: 0, amount: 0, lastRate: r };
        outMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: r || prev.lastRate,
        });
      });

      purRetRows.forEach((pr: any) => {
        const pId = pr.prc_prcode || 0;
        const q = Number(pr.prc_qty) || 0;
        const r = Number(pr.prc_pur_rate) || 0;
        const tot = Number(pr.prc_net_tot || pr.prc_total) || q * r;
        const prev = outMap.get(pId) || { qty: 0, amount: 0, lastRate: r };
        outMap.set(pId, {
          qty: prev.qty + q,
          amount: prev.amount + tot,
          lastRate: r || prev.lastRate,
        });
      });

      // 4. Barcode Batches Aggregation Map (Live Barcode Tracking fallback & per-product batches)
      const barProductMap = new Map<
        number,
        {
          batches: any[];
          inwardQty: number;
          inwardAmt: number;
          outwardQty: number;
          outwardAmt: number;
          closingQty: number;
          closingAmt: number;
          vendorName: string;
          vendorId: number;
        }
      >();

      barcodes.forEach((b: any) => {
        const pId = b.prcode || 0;
        const baseQty = Number(b.qty) || 1;
        const purcRate = Number(b.pc_pur_rate) || 0;
        const costRate = Number(b.cost_rate) || purcRate;
        const salesRate = Number(b.pc_sale_rate) || 0;
        const status = (b.sold_status || "A").toUpperCase();
        const vName = b.cr_code ? ledgerMap.get(b.cr_code) || "" : "";

        let inw = baseQty;
        let out = 0;
        if (status === "S" || status === "PR") {
          out = baseQty;
        }

        const closing = Math.max(0, inw - out);
        const inwVal = inw * purcRate;
        const outVal = out * (salesRate || costRate);
        const clVal = closing * costRate;

        if (!barProductMap.has(pId)) {
          barProductMap.set(pId, {
            batches: [],
            inwardQty: 0,
            inwardAmt: 0,
            outwardQty: 0,
            outwardAmt: 0,
            closingQty: 0,
            closingAmt: 0,
            vendorName: vName,
            vendorId: b.cr_code || 0,
          });
        }

        const cur = barProductMap.get(pId)!;
        cur.batches.push({
          batchNo: b.bar_no,
          purcRate,
          salesRate,
          costRate,
          vendorName: vName || "SRI KRISHNA SILKS",
          soldStatus: status,
          qty: baseQty,
        });
        cur.inwardQty += inw;
        cur.inwardAmt += inwVal;
        cur.outwardQty += out;
        cur.outwardAmt += outVal;
        cur.closingQty += closing;
        cur.closingAmt += clVal;
        if (!cur.vendorName && vName) {
          cur.vendorName = vName;
          cur.vendorId = b.cr_code || 0;
        }
      });

      // 5. Build Master Product List with Accurate Calculations
      const allProductIds = new Set<number>();
      products.forEach((p) => allProductIds.add(p.ref_no));
      barcodes.forEach((b) => {
        if (b.prcode) allProductIds.add(b.prcode);
      });
      purRows.forEach((p) => {
        if (p.pc_prcode) allProductIds.add(p.pc_prcode);
      });

      const items: StockItem[] = [];
      let runningSno = 1;

      Array.from(allProductIds).forEach((pId) => {
        const prod = products.find((p) => p.ref_no === pId);
        const barData = barProductMap.get(pId);
        const oppData = oppMap.get(pId) || { qty: 0, rate: 0, amount: 0, vendorId: 0 };
        const inwData = inwMap.get(pId) || { qty: 0, amount: 0, lastRate: 0, vendorId: 0 };
        const outData = outMap.get(pId) || { qty: 0, amount: 0, lastRate: 0 };

        const grpId = prod?.grp_code || (barData?.batches[0] ? barcodes.find((b) => b.prcode === pId)?.grp_code : 0) || 0;
        const grpObj = groupMap.get(grpId);
        const groupName = grpObj?.grp_name || "GENERAL";
        const hsnCode = prod?.hsn_code || grpObj?.hsn_code || "52081120";

        // Product Name formatting matching the Excel model (e.g. DHOTHIES SET-50072090 or SAREES-50072010)
        let rawName = prod?.prd_name || "PRODUCT " + pId;
        let displayName = rawName;
        if (hsnCode && !rawName.includes(hsnCode)) {
          displayName = `${rawName}-${hsnCode}`;
        }

        // Opening Metrics
        const opQty = oppData.qty;
        const opRate = oppData.rate || prod?.rate || 0;
        const opAmount = oppData.amount || opQty * opRate;

        // Inward Metrics: Combine Transaction Inward and Barcode Inward
        let inwQty = inwData.qty;
        let inwAmount = inwData.amount;
        if (inwQty === 0 && barData) {
          inwQty = barData.inwardQty;
          inwAmount = barData.inwardAmt;
        }
        const inwRate = inwQty > 0 ? inwAmount / inwQty : inwData.lastRate || prod?.rate || 0;

        // Outward Metrics: Combine Transaction Outward and Barcode Outward
        let outQty = outData.qty;
        let outAmount = outData.amount;
        if (outQty === 0 && barData && barData.outwardQty > 0) {
          outQty = barData.outwardQty;
          outAmount = barData.outwardAmt;
        }
        const outRate = outQty > 0 ? outAmount / outQty : outData.lastRate || prod?.sales_price || 0;

        // Closing Stock Quantity = Opening + Inward - Outward
        let stock = opQty + inwQty - outQty;
        if (stock === 0 && opQty === 0 && inwQty === 0 && barData) {
          stock = barData.closingQty;
          inwQty = barData.inwardQty;
          inwAmount = barData.inwardAmt;
        }

        // Closing Rate & Amount (Valuation)
        let clRate = inwRate || opRate || prod?.rate || 0;
        let clAmount = stock * clRate;
        if (barData && barData.closingAmt > 0 && stock === barData.closingQty) {
          clAmount = barData.closingAmt;
          clRate = stock > 0 ? clAmount / stock : clRate;
        }

        // COGS Value = Cost of Goods Sold = outQty * (Inward Cost Rate or Avg Purchase Rate)
        const costRate = inwRate || opRate || prod?.rate || 0;
        const cogsValue = outQty * costRate;

        // Profit calculation as per Excel model
        let profit = 0;
        if (outQty > 0) {
          profit = outAmount - cogsValue;
        } else {
          profit = Math.max(0, clAmount - (opAmount + inwAmount));
        }

        const margin = clAmount > 0 ? (profit / clAmount) * 100 : 0;

        // Vendor resolution
        const vId = inwData.vendorId || oppData.vendorId || barData?.vendorId || 0;
        const vendorName =
          (vId ? ledgerMap.get(vId) : "") ||
          barData?.vendorName ||
          "SRI KRISHNA SILKS";

        items.push({
          sno: runningSno++,
          productId: pId,
          productName: displayName,
          productCode: prod?.prd_code || String(pId),
          groupName,
          groupId: grpId,
          hsnCode,
          vendorName,
          vendorId: vId,
          opQty,
          opRate,
          opAmount,
          inwQty,
          inwRate,
          inwAmount,
          outQty,
          outRate,
          outAmount,
          stock,
          clRate,
          clAmount,
          cogsValue,
          profit,
          margin,
          batches: barData?.batches || [],
        });
      });

      // Sort by Group Name, then Product Name
      items.sort((a, b) => {
        if (a.groupName === b.groupName) {
          return a.productName.localeCompare(b.productName);
        }
        return a.groupName.localeCompare(b.groupName);
      });

      // Re-assign sequential SNo
      items.forEach((item, index) => {
        item.sno = index + 1;
      });

      setRawStockItems(items);
    } catch (e) {
      console.error("Error loading live stock summary report:", e);
      setRawStockItems([]);
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase]);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  // Distinct Filter Options
  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    rawStockItems.forEach((i) => {
      if (i.vendorName) set.add(i.vendorName.trim());
    });
    return Array.from(set).sort();
  }, [rawStockItems]);

  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    rawStockItems.forEach((i) => {
      if (i.groupName) set.add(i.groupName.trim());
    });
    return Array.from(set).sort();
  }, [rawStockItems]);

  const productOptions = useMemo(() => {
    return Array.from(new Set(rawStockItems.map((i) => i.productName))).sort();
  }, [rawStockItems]);

  const hsnOptions = useMemo(() => {
    const set = new Set<string>();
    rawStockItems.forEach((i) => {
      if (i.hsnCode) set.add(i.hsnCode.trim());
    });
    return Array.from(set).sort();
  }, [rawStockItems]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return rawStockItems.filter((item) => {
      // Vendor Filter
      if (
        selectedVendor &&
        item.vendorName.trim().toLowerCase() !== selectedVendor.trim().toLowerCase()
      ) {
        return false;
      }

      // Group Filter
      if (
        selectedGroup &&
        item.groupName.trim().toLowerCase() !== selectedGroup.trim().toLowerCase()
      ) {
        return false;
      }

      // Product Filter
      if (
        selectedProduct &&
        item.productName.trim().toLowerCase() !== selectedProduct.trim().toLowerCase()
      ) {
        return false;
      }

      // HSN Code Filter
      if (
        selectedHsn &&
        item.hsnCode.trim().toLowerCase() !== selectedHsn.trim().toLowerCase()
      ) {
        return false;
      }

      // Stock Status Filter
      if (stockStatus === "in_stock" && item.stock <= 0) return false;
      if (stockStatus === "out_of_stock" && item.stock !== 0) return false;
      if (stockStatus === "negative" && item.stock >= 0) return false;

      // Search Query
      if (search) {
        const inName = item.productName.toLowerCase().includes(search);
        const inGroup = item.groupName.toLowerCase().includes(search);
        const inHsn = item.hsnCode.toLowerCase().includes(search);
        const inVendor = item.vendorName.toLowerCase().includes(search);
        const inCode = item.productCode.toLowerCase().includes(search);
        if (!inName && !inGroup && !inHsn && !inVendor && !inCode) return false;
      }

      return true;
    });
  }, [
    rawStockItems,
    searchTerm,
    selectedVendor,
    selectedGroup,
    selectedProduct,
    selectedHsn,
    stockStatus,
  ]);

  // Section Grouping: According to View Mode (Closing Stock = Group-wise, Detailed = HSN-wise)
  const sectionGroups = useMemo<StockSectionGroup[]>(() => {
    const map = new Map<string, StockItem[]>();

    filteredItems.forEach((item) => {
      let key = "";
      if (viewMode === "detailed") {
        key = `HSN Code: ${item.hsnCode || "UNSPECIFIED"}`;
      } else if (viewMode === "closing") {
        key = `Group: ${item.groupName || "GENERAL"}`;
      } else {
        key = "All Products";
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    return Array.from(map.entries()).map(([key, items]) => {
      const opQty = items.reduce((s, i) => s + i.opQty, 0);
      const opAmount = items.reduce((s, i) => s + i.opAmount, 0);
      const inwQty = items.reduce((s, i) => s + i.inwQty, 0);
      const inwAmount = items.reduce((s, i) => s + i.inwAmount, 0);
      const outQty = items.reduce((s, i) => s + i.outQty, 0);
      const outAmount = items.reduce((s, i) => s + i.outAmount, 0);
      const stock = items.reduce((s, i) => s + i.stock, 0);
      const clAmount = items.reduce((s, i) => s + i.clAmount, 0);
      const cogsValue = items.reduce((s, i) => s + i.cogsValue, 0);
      const profit = items.reduce((s, i) => s + i.profit, 0);

      return {
        key,
        title: key,
        items,
        totals: {
          count: items.length,
          opQty,
          opAmount,
          inwQty,
          inwAmount,
          outQty,
          outAmount,
          stock,
          clAmount,
          cogsValue,
          profit,
        },
      };
    });
  }, [filteredItems, viewMode]);

  // Grand KPI Totals
  const grandTotals = useMemo(() => {
    let opQty = 0;
    let opAmount = 0;
    let inwQty = 0;
    let inwAmount = 0;
    let outQty = 0;
    let outAmount = 0;
    let stock = 0;
    let clAmount = 0;
    let cogsValue = 0;
    let profit = 0;

    filteredItems.forEach((i) => {
      opQty += i.opQty;
      opAmount += i.opAmount;
      inwQty += i.inwQty;
      inwAmount += i.inwAmount;
      outQty += i.outQty;
      outAmount += i.outAmount;
      stock += i.stock;
      clAmount += i.clAmount;
      cogsValue += i.cogsValue;
      profit += i.profit;
    });

    const overallMargin = clAmount > 0 ? (profit / clAmount) * 100 : 0;

    return {
      productCount: filteredItems.length,
      groupCount: new Set(filteredItems.map((i) => i.groupName)).size,
      hsnCount: new Set(filteredItems.map((i) => i.hsnCode)).size,
      opQty,
      opAmount,
      inwQty,
      inwAmount,
      outQty,
      outAmount,
      stock,
      clAmount,
      cogsValue,
      profit,
      overallMargin,
    };
  }, [filteredItems]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedVendor("");
    setSelectedGroup("");
    setSelectedProduct("");
    setSelectedHsn("");
    setStockStatus("all");
    setFromDate("2026-04-01");
    setToDate("2027-03-31");
  };

  // Toggle Collapse Section
  const toggleCollapse = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Export to Excel (.xlsx / .xls model structure)
  const exportToExcel = () => {
    const rows: any[][] = [];

    const modeTitle =
      viewMode === "detailed"
        ? "Detailed Stock Summary"
        : "Closing Stock Summary";

    // Row 0: Title Banner matching reference Excel
    rows.push([
      `Stock Summary   ${modeTitle} From ${fromDate.split("-").reverse().join("-")} To ${toDate.split("-").reverse().join("-")}`,
    ]);

    // Row 1: Columns Header
    rows.push([
      "SNo",
      "",
      "Product Name",
      "",
      "Op Qty",
      "Op Rate",
      "Op Amount",
      "Inw Qty",
      "Inw Rate",
      "Inw Amount",
      "Out Qty",
      "Out Rate",
      "Out Amount",
      "Stock",
      "Cl Rate",
      "Cl Amount",
      "COGS Value",
      "Profit",
      "Margin",
    ]);

    let runningSno = 1;

    sectionGroups.forEach((group) => {
      // Group Header Row
      rows.push([`${group.title} `]);

      // Items Rows
      group.items.forEach((item) => {
        rows.push([
          "",
          runningSno++,
          item.productName,
          "",
          item.opQty || "",
          item.opRate || "",
          item.opAmount || "",
          item.inwQty || "",
          item.inwRate ? Number(item.inwRate.toFixed(3)) : "",
          item.inwAmount || "",
          item.outQty || "",
          item.outRate ? Number(item.outRate.toFixed(3)) : "",
          item.outAmount || "",
          item.stock || "",
          item.clRate ? Number(item.clRate.toFixed(3)) : "",
          item.clAmount || "",
          item.cogsValue || "",
          item.profit || 0,
          item.margin ? Number(item.margin.toFixed(2)) : 0,
        ]);
      });

      // Group Subtotal Row
      rows.push([
        "",
        "",
        "",
        "",
        group.totals.opQty || 0,
        "",
        group.totals.opAmount || 0,
        group.totals.inwQty || 0,
        "",
        group.totals.inwAmount || 0,
        group.totals.outQty || 0,
        "",
        group.totals.outAmount || 0,
        group.totals.stock || 0,
        "",
        group.totals.clAmount || 0,
        group.totals.cogsValue || 0,
        group.totals.profit || 0,
      ]);
    });

    // Grand Total Row
    rows.push([
      "",
      "",
      "",
      "",
      grandTotals.opQty || 0,
      "",
      grandTotals.opAmount || 0,
      grandTotals.inwQty || 0,
      "",
      grandTotals.inwAmount || 0,
      grandTotals.outQty || 0,
      "",
      grandTotals.outAmount || 0,
      grandTotals.stock || 0,
      "",
      grandTotals.clAmount || 0,
      grandTotals.cogsValue || 0,
      grandTotals.profit || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set Column Widths
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 6 },
      { wch: 32 },
      { wch: 4 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Summary");

    const fileName =
      viewMode === "detailed"
        ? `Stock_Summary_detailed_${fromDate}_to_${toDate}.xlsx`
        : `Stock_Summary_closing_${fromDate}_to_${toDate}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  // Export to PDF (.pdf)
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companyTitle = company?.frm_name || "RetailTex - Textile Management";
    const modeTitle =
      viewMode === "detailed"
        ? "DETAILED STOCK SUMMARY (HSN CODE-WISE)"
        : "CLOSING STOCK SUMMARY (PRODUCT GROUP-WISE)";

    // Top Brand Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`STOCK SUMMARY - ${modeTitle}`, 14, 11);

    doc.setFontSize(8.5);
    doc.text(`Period: ${fromDate} to ${toDate}  |  Company: ${companyTitle}`, 175, 11);

    // KPI Summary Bar
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 21, 269, 10, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Products: ${grandTotals.productCount}  |  Inward Qty: ${grandTotals.inwQty.toLocaleString()} (₹${grandTotals.inwAmount.toLocaleString('en-IN')})  |  Outward Qty: ${grandTotals.outQty.toLocaleString()}  |  Closing Stock: ${grandTotals.stock.toLocaleString()}  |  Stock Valuation: ₹${grandTotals.clAmount.toLocaleString('en-IN')}  |  Stock Profit: ₹${grandTotals.profit.toLocaleString('en-IN')}`,
      17,
      27.5
    );

    let startY = 34;
    let runningSno = 1;

    sectionGroups.forEach((group) => {
      doc.setFillColor(226, 232, 240);
      doc.rect(14, startY, 269, 5.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`${group.title}`, 17, startY + 4);

      startY += 6.5;

      const bodyData = group.items.map((item) => [
        runningSno++,
        item.productName,
        item.opQty || "-",
        item.opAmount ? `₹${item.opAmount.toLocaleString('en-IN')}` : "-",
        item.inwQty || "-",
        item.inwRate ? `₹${item.inwRate.toFixed(2)}` : "-",
        item.inwAmount ? `₹${item.inwAmount.toLocaleString('en-IN')}` : "-",
        item.outQty || "-",
        item.outAmount ? `₹${item.outAmount.toLocaleString('en-IN')}` : "-",
        item.stock || "0",
        item.clRate ? `₹${item.clRate.toFixed(2)}` : "-",
        `₹${item.clAmount.toLocaleString('en-IN')}`,
        item.profit ? `₹${item.profit.toLocaleString('en-IN')}` : "-",
      ]);

      // Subtotal line
      bodyData.push([
        "",
        `SUBTOTAL (${group.totals.count} Items)`,
        group.totals.opQty || "-",
        group.totals.opAmount ? `₹${group.totals.opAmount.toLocaleString('en-IN')}` : "-",
        group.totals.inwQty || "-",
        "",
        group.totals.inwAmount ? `₹${group.totals.inwAmount.toLocaleString('en-IN')}` : "-",
        group.totals.outQty || "-",
        group.totals.outAmount ? `₹${group.totals.outAmount.toLocaleString('en-IN')}` : "-",
        group.totals.stock || "0",
        "",
        `₹${group.totals.clAmount.toLocaleString('en-IN')}`,
        group.totals.profit ? `₹${group.totals.profit.toLocaleString('en-IN')}` : "-",
      ]);

      autoTable(doc, {
        startY: startY,
        head: [
          [
            "SNo",
            "Product Name",
            "Op Qty",
            "Op Amt",
            "Inw Qty",
            "Inw Rate",
            "Inw Amt",
            "Out Qty",
            "Out Amt",
            "Stock",
            "Cl Rate",
            "Cl Amount",
            "Profit",
          ],
        ],
        body: bodyData,
        theme: "grid",
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.2,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 50, fontStyle: "bold" },
          2: { cellWidth: 14, halign: "right" },
          3: { cellWidth: 18, halign: "right" },
          4: { cellWidth: 14, halign: "right" },
          5: { cellWidth: 18, halign: "right" },
          6: { cellWidth: 22, halign: "right" },
          7: { cellWidth: 14, halign: "right" },
          8: { cellWidth: 22, halign: "right" },
          9: { cellWidth: 16, halign: "right", fontStyle: "bold" },
          10: { cellWidth: 18, halign: "right" },
          11: { cellWidth: 25, halign: "right", fontStyle: "bold" },
          12: { cellWidth: 18, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 4;
    });

    if (startY > 175) {
      doc.addPage();
      startY = 20;
    }

    // Grand Total Banner
    doc.setFillColor(245, 158, 11);
    doc.rect(14, startY, 269, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `GRAND TOTAL -> Products: ${grandTotals.productCount}  |  Inward: ${grandTotals.inwQty}  |  Outward: ${grandTotals.outQty}  |  Closing Stock: ${grandTotals.stock}  |  Stock Valuation: Rs.${grandTotals.clAmount.toLocaleString('en-IN')}  |  Profit: Rs.${grandTotals.profit.toLocaleString('en-IN')}`,
      17,
      startY + 5
    );

    const pdfDate = new Date().toISOString().split("T")[0];
    doc.save(`Stock_Summary_${viewMode}_${pdfDate}.pdf`);
  };

  // Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 space-y-4 font-sans text-xs print:p-0 print:bg-white">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-white rounded-lg w-9 h-9 flex items-center justify-center shadow">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Summary Report</h1>
            <p className="text-xs text-slate-300">
              Live Stock Valuation, Movement & Detailed Profit Margin Analysis
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher Pills */}
          <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700">
            <button
              onClick={() => setViewMode("closing")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                viewMode === "closing"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5 inline mr-1" />
              Closing Stock (Group-wise)
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                viewMode === "detailed"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Hash className="h-3.5 w-3.5 inline mr-1" />
              Detailed Stock (HSN-wise)
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                viewMode === "flat"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Flat View
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white text-slate-800 hover:bg-slate-100 font-bold border-slate-300"
            onClick={loadStockData}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow"
            onClick={exportToExcel}
            disabled={filteredItems.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            Excel (.xlsx)
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow"
            onClick={exportToPDF}
            disabled={filteredItems.length === 0}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            PDF (.pdf)
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-slate-800 text-white hover:bg-slate-700 font-bold border-slate-700"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* KPI Cards Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2.5 print:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Products</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {grandTotals.productCount}{" "}
              <span className="text-[10px] font-normal text-slate-500">
                ({grandTotals.groupCount} Groups)
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Opening Qty</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {grandTotals.opQty.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Inward Qty</p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {grandTotals.inwQty.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Outward Qty</p>
            <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {grandTotals.outQty.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/50 dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase">Closing Stock</p>
            <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-0.5">
              {grandTotals.stock.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Stock Valuation</p>
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300 font-mono mt-0.5">
              ₹{grandTotals.clAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Stock Profit</p>
            <p className="text-sm font-bold text-teal-700 dark:text-teal-300 font-mono mt-0.5">
              ₹{grandTotals.profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Control Section */}
      <Card className="shadow-sm border print:hidden">
        <CardContent className="p-3 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 text-xs">
            {/* Supplier / Vendor Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                Supplier / Vendor
              </Label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Vendors ({vendorOptions.length})</option>
                {vendorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Group Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Layers className="h-3.5 w-3.5 text-amber-600" />
                Product Group
              </Label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Groups ({groupOptions.length})</option>
                {groupOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Boxes className="h-3.5 w-3.5 text-amber-600" />
                Product Name
              </Label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Products ({productOptions.length})</option>
                {productOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* HSN Code Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Hash className="h-3.5 w-3.5 text-amber-600" />
                HSN Code
              </Label>
              <select
                value={selectedHsn}
                onChange={(e) => setSelectedHsn(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All HSN Codes ({hsnOptions.length})</option>
                {hsnOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Filter className="h-3.5 w-3.5 text-amber-600" />
                Stock Status
              </Label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Products</option>
                <option value="in_stock">In Stock (Stock &gt; 0)</option>
                <option value="out_of_stock">Out of Stock (Stock = 0)</option>
                <option value="negative">Negative Stock (&lt; 0)</option>
              </select>
            </div>

            {/* Search Input */}
            <div>
              <Label className="text-xs font-bold flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Search className="h-3.5 w-3.5 text-amber-600" />
                  Quick Search
                </span>
                {(searchTerm ||
                  selectedVendor ||
                  selectedGroup ||
                  selectedProduct ||
                  selectedHsn ||
                  stockStatus !== "all") && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] text-rose-600 hover:underline font-bold"
                  >
                    Clear All
                  </button>
                )}
              </Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Product / HSN / Group..."
                className="h-8 text-xs bg-background mt-1"
              />
            </div>
          </div>

          {/* Date Period Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-600" />
                Financial Period:
              </span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-0.5">
                Active View:{" "}
                <span className="font-bold text-amber-600 dark:text-amber-400 ml-1">
                  {viewMode === "closing"
                    ? "Closing Stock Summary (Group-wise)"
                    : viewMode === "detailed"
                    ? "Detailed Stock Summary (HSN-wise)"
                    : "Flat Product View"}
                </span>
              </Badge>
              <Badge variant="secondary" className="text-xs py-0.5">
                {filteredItems.length} Products Found
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stock Report Table with Sticky Headers matching the exact Model */}
      <Card className="shadow-sm border overflow-hidden">
        {/* Table Banner Title Header */}
        <div className="p-3 bg-slate-900 text-white font-bold flex flex-wrap justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-amber-400" />
            <span className="text-sm uppercase tracking-wide">
              Stock Summary &mdash;{" "}
              {viewMode === "detailed"
                ? "Detailed Stock Summary (HSN-Wise)"
                : "Closing Stock Summary (Group-Wise)"}{" "}
              From {fromDate.split("-").reverse().join("-")} To{" "}
              {toDate.split("-").reverse().join("-")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>
              Products:{" "}
              <span className="text-amber-400 font-bold">{grandTotals.productCount}</span>
            </span>
            <span>
              Closing Stock:{" "}
              <span className="text-amber-400 font-bold">
                {grandTotals.stock.toLocaleString()}
              </span>
            </span>
            <span>
              Valuation:{" "}
              <span className="text-emerald-400 font-bold">
                ₹{grandTotals.clAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto min-h-[350px] max-h-[620px] relative">
          {loading ? (
            <div className="p-16 text-center text-slate-500 font-bold flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
              <span>Loading Live Stock Summary Data...</span>
            </div>
          ) : rawStockItems.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Boxes className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No Stock Items Found in Database
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Create products in <strong>Product Master [F3]</strong> or enter purchases to start tracking stock.
              </p>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={() => router.push("/master/product")}
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Go to Product Master
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold">
              No stock items matched the selected filters.
            </div>
          ) : (
            <Table className="w-full border-collapse text-xs">
              {/* STICKY HIGH-CONTRAST COLUMN HEADERS MATCHING MODEL EXACTLY */}
              <TableHeader className="bg-slate-900 text-white font-bold sticky top-0 z-20 shadow-md">
                <TableRow className="bg-slate-900 border-b-2 border-slate-700">
                  <TableHead className="w-10 text-center p-2 font-bold text-white bg-slate-900">
                    SNo
                  </TableHead>
                  <TableHead className="min-w-[220px] p-2 font-bold text-white bg-slate-900">
                    Product Name
                  </TableHead>
                  <TableHead className="w-16 text-right p-2 font-bold text-slate-300 bg-slate-900">
                    Op Qty
                  </TableHead>
                  <TableHead className="w-20 text-right p-2 font-bold text-slate-300 bg-slate-900">
                    Op Rate
                  </TableHead>
                  <TableHead className="w-24 text-right p-2 font-bold text-slate-300 bg-slate-900">
                    Op Amount
                  </TableHead>
                  <TableHead className="w-16 text-right p-2 font-bold text-emerald-400 bg-slate-900">
                    Inw Qty
                  </TableHead>
                  <TableHead className="w-20 text-right p-2 font-bold text-emerald-400 bg-slate-900">
                    Inw Rate
                  </TableHead>
                  <TableHead className="w-24 text-right p-2 font-bold text-emerald-400 bg-slate-900">
                    Inw Amount
                  </TableHead>
                  <TableHead className="w-16 text-right p-2 font-bold text-rose-400 bg-slate-900">
                    Out Qty
                  </TableHead>
                  <TableHead className="w-20 text-right p-2 font-bold text-rose-400 bg-slate-900">
                    Out Rate
                  </TableHead>
                  <TableHead className="w-24 text-right p-2 font-bold text-rose-400 bg-slate-900">
                    Out Amount
                  </TableHead>
                  <TableHead className="w-16 text-right p-2 font-black text-amber-400 bg-slate-900">
                    Stock
                  </TableHead>
                  <TableHead className="w-20 text-right p-2 font-bold text-white bg-slate-900">
                    Cl Rate
                  </TableHead>
                  <TableHead className="w-24 text-right p-2 font-black text-amber-300 bg-slate-900">
                    Cl Amount
                  </TableHead>
                  <TableHead className="w-24 text-right p-2 font-bold text-purple-300 bg-slate-900">
                    COGS Value
                  </TableHead>
                  <TableHead className="w-20 text-right p-2 font-bold text-teal-300 bg-slate-900">
                    Profit
                  </TableHead>
                  <TableHead className="w-14 text-right p-2 font-bold text-slate-300 bg-slate-900">
                    Margin%
                  </TableHead>
                  <TableHead className="w-12 text-center p-2 font-bold text-white bg-slate-900 print:hidden">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {sectionGroups.map((group, sIdx) => {
                  const isCollapsed = !!collapsedSections[group.key];

                  return (
                    <div key={sIdx} className="contents">
                      {/* Section Header Row (Group: ... or HSN Code: ...) */}
                      {viewMode !== "flat" && (
                        <TableRow className="bg-amber-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-b border-amber-300 dark:border-amber-700">
                          <TableCell colSpan={18} className="py-2 px-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                onClick={() => toggleCollapse(group.key)}
                                className="flex items-center gap-1 text-amber-950 dark:text-amber-300 font-black text-xs uppercase tracking-wide hover:opacity-80"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-amber-700" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-amber-700" />
                                )}
                                <span>{group.title}</span>
                                <Badge variant="outline" className="ml-2 text-[10px] bg-white/80 dark:bg-slate-900 font-bold">
                                  {group.totals.count} Items
                                </Badge>
                              </button>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                                <span>
                                  Inw Qty:{" "}
                                  <strong className="text-emerald-700 dark:text-emerald-400">
                                    {group.totals.inwQty}
                                  </strong>
                                </span>
                                <span>
                                  Out Qty:{" "}
                                  <strong className="text-rose-700 dark:text-rose-400">
                                    {group.totals.outQty}
                                  </strong>
                                </span>
                                <span>
                                  Stock:{" "}
                                  <strong className="text-amber-800 dark:text-amber-400 font-black">
                                    {group.totals.stock}
                                  </strong>
                                </span>
                                <span>
                                  Valuation:{" "}
                                  <strong className="text-purple-800 dark:text-purple-300">
                                    ₹{group.totals.clAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Item Rows */}
                      {!isCollapsed &&
                        group.items.map((item) => (
                          <TableRow
                            key={item.productId}
                            className="hover:bg-amber-50 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-200 dark:border-slate-800"
                          >
                            <TableCell className="text-center font-mono p-1.5 text-slate-500">
                              {item.sno}
                            </TableCell>

                            <TableCell className="p-1.5 font-bold text-slate-900 dark:text-white">
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate" title={item.productName}>
                                  {item.productName}
                                </span>
                                {item.vendorName && (
                                  <span className="text-[10px] text-slate-600 font-semibold truncate max-w-[140px]" title={`Vendor: ${item.vendorName}`}>
                                    [{item.vendorName}]
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Opening Qty, Rate, Amount */}
                            <TableCell className="text-right font-mono p-1.5 text-slate-600 dark:text-slate-400">
                              {item.opQty || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-slate-600 dark:text-slate-400">
                              {item.opRate ? item.opRate.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-slate-600 dark:text-slate-400">
                              {item.opAmount ? item.opAmount.toLocaleString("en-IN") : "-"}
                            </TableCell>

                            {/* Inward Qty, Rate, Amount */}
                            <TableCell className="text-right font-mono p-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                              {item.inwQty || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-emerald-700 dark:text-emerald-400">
                              {item.inwRate ? item.inwRate.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                              {item.inwAmount ? item.inwAmount.toLocaleString("en-IN") : "-"}
                            </TableCell>

                            {/* Outward Qty, Rate, Amount */}
                            <TableCell className="text-right font-mono p-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                              {item.outQty || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-rose-700 dark:text-rose-400">
                              {item.outRate ? item.outRate.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                              {item.outAmount ? item.outAmount.toLocaleString("en-IN") : "-"}
                            </TableCell>

                            {/* Closing Stock, Rate, Amount */}
                            <TableCell className="text-right font-mono p-1.5 font-black text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                              {item.stock}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5">
                              {item.clRate ? item.clRate.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 font-bold text-slate-900 dark:text-white">
                              {item.clAmount ? item.clAmount.toLocaleString("en-IN") : "0"}
                            </TableCell>

                            {/* COGS, Profit, Margin */}
                            <TableCell className="text-right font-mono p-1.5 text-slate-600 dark:text-slate-400">
                              {item.cogsValue ? item.cogsValue.toLocaleString("en-IN") : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 font-semibold text-teal-700 dark:text-teal-400">
                              {item.profit ? item.profit.toLocaleString("en-IN") : "0"}
                            </TableCell>
                            <TableCell className="text-right font-mono p-1.5 text-slate-600 dark:text-slate-400">
                              {item.margin ? `${item.margin.toFixed(1)}%` : "0%"}
                            </TableCell>

                            {/* Action Drilldown */}
                            <TableCell className="text-center p-1.5 print:hidden">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-slate-500 hover:text-amber-600"
                                title="View Batch Drilldown & Details"
                                onClick={() => setDrilldownItem(item)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}

                      {/* Subtotal Row per Section (Matching the Excel Subtotal Row) */}
                      {viewMode !== "flat" && !isCollapsed && (
                        <TableRow className="bg-slate-200/80 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-700 text-xs">
                          <TableCell colSpan={2} className="p-2 text-slate-800 dark:text-slate-200 font-black">
                            Subtotal ({group.totals.count} Items)
                          </TableCell>
                          <TableCell className="text-right font-mono p-2">
                            {group.totals.opQty || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono p-2"></TableCell>
                          <TableCell className="text-right font-mono p-2">
                            {group.totals.opAmount ? group.totals.opAmount.toLocaleString("en-IN") : 0}
                          </TableCell>

                          <TableCell className="text-right font-mono p-2 text-emerald-700 dark:text-emerald-400">
                            {group.totals.inwQty || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono p-2"></TableCell>
                          <TableCell className="text-right font-mono p-2 text-emerald-700 dark:text-emerald-400">
                            {group.totals.inwAmount ? group.totals.inwAmount.toLocaleString("en-IN") : 0}
                          </TableCell>

                          <TableCell className="text-right font-mono p-2 text-rose-700 dark:text-rose-400">
                            {group.totals.outQty || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono p-2"></TableCell>
                          <TableCell className="text-right font-mono p-2 text-rose-700 dark:text-rose-400">
                            {group.totals.outAmount ? group.totals.outAmount.toLocaleString("en-IN") : 0}
                          </TableCell>

                          <TableCell className="text-right font-mono p-2 text-amber-800 dark:text-amber-400 font-black">
                            {group.totals.stock || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono p-2"></TableCell>
                          <TableCell className="text-right font-mono p-2 font-black">
                            {group.totals.clAmount ? group.totals.clAmount.toLocaleString("en-IN") : 0}
                          </TableCell>

                          <TableCell className="text-right font-mono p-2">
                            {group.totals.cogsValue ? group.totals.cogsValue.toLocaleString("en-IN") : 0}
                          </TableCell>
                          <TableCell className="text-right font-mono p-2 text-teal-700 dark:text-teal-400 font-bold">
                            {group.totals.profit ? group.totals.profit.toLocaleString("en-IN") : 0}
                          </TableCell>
                          <TableCell colSpan={2} className="text-right font-mono p-2"></TableCell>
                        </TableRow>
                      )}
                    </div>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* GRAND TOTAL STICKY FOOTER BAR */}
        {filteredItems.length > 0 && (
          <div className="bg-amber-500 text-slate-950 p-3 border-t flex flex-wrap items-center justify-between font-bold text-xs shadow-inner">
            <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
              <Boxes className="h-5 w-5 text-slate-900" />
              <span>GRAND TOTAL REPORT SUMMARY</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
              <span>
                Total Items:{" "}
                <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-bold">
                  {grandTotals.productCount}
                </span>
              </span>
              <span>
                Inward Qty:{" "}
                <span className="bg-emerald-800 text-white px-2 py-0.5 rounded font-bold">
                  {grandTotals.inwQty.toLocaleString()}
                </span>
              </span>
              <span>
                Inward Value:{" "}
                <span className="bg-emerald-900 text-white px-2 py-0.5 rounded font-bold">
                  ₹{grandTotals.inwAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </span>
              <span>
                Outward Qty:{" "}
                <span className="bg-rose-800 text-white px-2 py-0.5 rounded font-bold">
                  {grandTotals.outQty.toLocaleString()}
                </span>
              </span>
              <span>
                Closing Stock:{" "}
                <span className="bg-white text-slate-950 px-2.5 py-0.5 rounded font-black text-sm shadow">
                  {grandTotals.stock.toLocaleString()}
                </span>
              </span>
              <span>
                Closing Valuation:{" "}
                <span className="bg-purple-900 text-white px-2.5 py-0.5 rounded font-black text-sm shadow">
                  ₹{grandTotals.clAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </span>
              <span>
                Profit:{" "}
                <span className="bg-teal-900 text-white px-2.5 py-0.5 rounded font-bold">
                  ₹{grandTotals.profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Drilldown Modal for Selected Product */}
      {drilldownItem && (
        <Dialog open={!!drilldownItem} onOpenChange={(open) => !open && setDrilldownItem(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Boxes className="h-5 w-5 text-amber-500" />
                Product Stock Details: {drilldownItem.productName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Group: <strong>{drilldownItem.groupName}</strong> &bull; HSN Code:{" "}
                <strong>{drilldownItem.hsnCode}</strong> &bull; Primary Vendor:{" "}
                <strong>{drilldownItem.vendorName}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Opening Stock
                  </span>
                  <p className="text-base font-bold font-mono">
                    {drilldownItem.opQty}{" "}
                    <span className="text-xs font-normal">
                      (₹{drilldownItem.opAmount.toLocaleString("en-IN")})
                    </span>
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-400 uppercase font-bold">
                    Inward Qty
                  </span>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {drilldownItem.inwQty}{" "}
                    <span className="text-xs font-normal">
                      (₹{drilldownItem.inwAmount.toLocaleString("en-IN")})
                    </span>
                  </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-800 dark:text-rose-400 uppercase font-bold">
                    Outward Qty
                  </span>
                  <p className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">
                    {drilldownItem.outQty}{" "}
                    <span className="text-xs font-normal">
                      (₹{drilldownItem.outAmount.toLocaleString("en-IN")})
                    </span>
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-300">
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 uppercase font-bold">
                    Current Closing Stock
                  </span>
                  <p className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                    {drilldownItem.stock}{" "}
                    <span className="text-xs font-bold">
                      (₹{drilldownItem.clAmount.toLocaleString("en-IN")})
                    </span>
                  </p>
                </div>
              </div>

              {/* Barcode Batches Breakdown */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center justify-between mb-2">
                  <span>Tracked Barcode Batches ({drilldownItem.batches?.length || 0})</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Real-time Barcode inventory
                  </span>
                </h4>

                {drilldownItem.batches && drilldownItem.batches.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Batch / Barcode</TableHead>
                          <TableHead className="text-right">Purchase Rate</TableHead>
                          <TableHead className="text-right">Sales Rate</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldownItem.batches.map((b, bIdx) => (
                          <TableRow key={b.batchNo || bIdx}>
                            <TableCell className="text-center font-mono">{bIdx + 1}</TableCell>
                            <TableCell className="font-mono font-bold text-amber-700">
                              {b.batchNo}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{b.purcRate.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{b.salesRate.toFixed(2)}
                            </TableCell>
                            <TableCell>{b.vendorName}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={b.soldStatus === "A" ? "default" : "secondary"}
                                className={
                                  b.soldStatus === "A"
                                    ? "bg-emerald-600 text-white text-[10px]"
                                    : "bg-rose-100 text-rose-800 text-[10px]"
                                }
                              >
                                {b.soldStatus === "A" ? "Available" : "Sold/Out"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded text-center">
                    No individual barcode batches linked to this product. Stock managed by quantity balance.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
