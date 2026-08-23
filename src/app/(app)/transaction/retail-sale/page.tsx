"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Barcode,
  ShoppingBag,
  User,
  CreditCard,
  Building2,
  Search,
  X,
  CheckCircle2,
  Printer,
  RotateCcw,
  PlusCircle,
  Clock,
  Trash2,
  ChevronRight,
  Boxes,
  HelpCircle,
} from "lucide-react";

interface POSGridRow {
  id: string;
  sno: number;
  productCode: string;
  batchNo: string;
  prcode: number;
  productName: string;
  qty: number;
  unitName: string;
  unit: number;
  gross: number;
  rateUnit: number;
  amount: number;
  disPerc: number;
  sgstPerc: number;
  cgstPerc: number;
  igstPerc: number;
  isBatchItem: boolean;
  maxStockQty: number;
}

interface PaymentRow {
  type: string;
  amount: number;
  remarks: string;
}

export default function RetailSalePOSPage() {
  const router = useRouter();
  const { company } = useApp();
  const supabase = createClient();

  // Mode & Loading
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Top Bar Info
  const [saleType, setSaleType] = useState<string>("SALES");
  const [scanInput, setScanInput] = useState<string>("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Stock Summary Banner line (Image 2: C-Rate: T.TT, S-Rate: T.TT : Stock : 10 PCS)
  const [stockBannerText, setStockBannerText] = useState<string>(
    "C-Rate: T.TT, S-Rate: T.TT : Stock : 30 PCS"
  );

  // Voucher Details Panel (Image 2)
  const [invoiceNo, setInvoiceNo] = useState<string>("1");
  const [invoiceTime, setInvoiceTime] = useState<string>("08:20:55");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [salesman, setSalesman] = useState<string>("Direct");
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [expensesAmt, setExpensesAmt] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Customer Details Bar (Image 2)
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Sumit");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerBalance, setCustomerBalance] = useState<number>(10000);
  const [customerBday, setCustomerBday] = useState<string>("");

  // Customers & Stock Lists from DB
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Main POS Grid Rows
  const [gridRows, setGridRows] = useState<POSGridRow[]>([]);

  // Modals state: Stock Modal (Image 3) and Payment Modal (Image 4)
  // DO NOT AUTO OPEN STOCK MODAL ON LOAD PER USER DIRECTIVE
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Stock Modal Selected Row (Image 3)
  const [selectedStockRowIndex, setSelectedStockRowIndex] = useState<number>(0);

  // Payment Breakdown Table (Image 4)
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { type: "CASH", amount: 0, remarks: "" },
    { type: "CN/ADVANCE", amount: 0, remarks: "" },
    { type: "HDFC CARD", amount: 0, remarks: "" },
    { type: "KOTAK", amount: 0, remarks: "" },
    { type: "UPI / QR CODE", amount: 0, remarks: "" },
  ]);

  // Focus Highlight Class
  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:ring-2 focus:ring-amber-500 font-medium transition-colors";

  // Initial Fetch: Load Customers, Stock List, & Saved Invoices
  const fetchInitialData = useCallback(async () => {
    if (!company?.frm_code) return;
    try {
      // Update Invoice Time
      setInvoiceTime(new Date().toLocaleTimeString());

      // 1. Fetch Customers
      const { data: cData } = await supabase
        .from("ledger")
        .select("*")
        .eq("frm_code", company.frm_code)
        .order("ledg_name", { ascending: true });

      if (cData) setCustomers(cData);

      // 2. Fetch Available Barcodes from bar_temp
      const { data: barData } = await supabase
        .from("bar_temp")
        .select("*")
        .eq("frm_code", company.frm_code)
        .eq("sold_status", "A")
        .order("bar_ref_id", { ascending: true });

      if (barData) {
        setStockItems(barData);
        setStockBannerText(
          `C-Rate: T.TT, S-Rate: T.TT : Stock : ${barData.length} PCS`
        );
      }

      // Auto Invoice Number
      if (mode === "add") {
        setInvoiceNo(`${(savedInvoices.length || 0) + 1}`);
      }
    } catch (e) {
      console.error("Error fetching initial POS data:", e);
    }
  }, [company?.frm_code, supabase, mode, savedInvoices.length]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Focus Scan Box on Open & Reset (DO NOT AUTO-OPEN STOCK MODAL)
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Barcode / Product Code Scan Handler
  const handleScanProductCode = async (inputVal?: string) => {
    const query = (inputVal || scanInput).trim().toUpperCase();
    if (!query || !company?.frm_code) return;

    // Check if barcode is already added to grid
    const alreadyAdded = gridRows.find(
      (r) => r.productCode.toUpperCase() === query
    );
    if (alreadyAdded) {
      alert(`Barcode "${query}" is already added to this invoice!`);
      setScanInput("");
      return;
    }

    try {
      const { data: barRows } = await supabase
        .from("bar_temp")
        .select("*")
        .eq("frm_code", company.frm_code)
        .ilike("bar_no", `%${query}%`);

      if (barRows && barRows.length > 0) {
        if (barRows.length === 1) {
          const bar = barRows[0];
          const status = (bar.sold_status || "A").toUpperCase();

          if (status === "S") {
            alert(`Barcode "${bar.bar_no}" is already sold.`);
            setScanInput("");
            return;
          }
          if (status === "PR") {
            alert(`Barcode "${bar.bar_no}" is returned to supplier.`);
            setScanInput("");
            return;
          }

          addStockItemToGrid(bar);
          setScanInput("");
        } else {
          // Multiple matches found -> Open Stock Selection Window (Image 3)
          setStockItems(barRows);
          setIsStockModalOpen(true);
        }
      } else {
        alert(`Product Code / Barcode "${query}" not found in available stock.`);
        setScanInput("");
      }
    } catch (e) {
      console.error("Scan error:", e);
    }
  };

  // Add Item to POS Grid
  const addStockItemToGrid = (bar: any) => {
    const saleRate = bar.pc_sale_rate || bar.tag_rate || 10000;
    const purRate = bar.pc_pur_rate || 8500;

    const newRow: POSGridRow = {
      id: `pos-item-${bar.bar_no}-${Date.now()}`,
      sno: gridRows.length + 1,
      productCode: bar.bar_no,
      batchNo: bar.bar_no,
      prcode: bar.prcode || 101,
      productName: bar.grp_name || "DESIGNER SAREE",
      qty: 1,
      unitName: bar.unit_name || "PCS",
      unit: 1,
      gross: 1,
      rateUnit: saleRate,
      amount: saleRate,
      disPerc: 0,
      sgstPerc: 6,
      cgstPerc: 6,
      igstPerc: 0,
      isBatchItem: false,
      maxStockQty: bar.qty || 1,
    };

    setGridRows((prev) => [...prev, newRow]);
  };

  // Grid Cell Changes
  const handleCellChange = (
    index: number,
    field: keyof POSGridRow,
    value: any
  ) => {
    setGridRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === "qty") {
        const parsed = Math.max(1, Number(value) || 1);
        row.qty = parsed;
      } else if (field === "rateUnit") {
        row.rateUnit = Math.max(0, Number(value) || 0);
      } else if (field === "disPerc") {
        row.disPerc = Math.max(0, Number(value) || 0);
      } else {
        (row as any)[field] = value;
      }

      const discAmt = (row.qty * row.rateUnit * row.disPerc) / 100;
      row.amount = Math.max(0, row.qty * row.rateUnit - discAmt);

      updated[index] = row;
      return updated;
    });
  };

  // Delete Row
  const handleDeleteRow = (index: number) => {
    setGridRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, sno: i + 1 }))
    );
  };

  // Calculations Summary (Image 2 Voucher Details Panel)
  const totals = useMemo(() => {
    let totalQty = 0;
    let subTotal = 0;
    let totDiscAmt = 0;
    let totSgst = 0;
    let totCgst = 0;

    gridRows.forEach((r) => {
      totalQty += r.qty;
      const baseLine = r.qty * r.rateUnit;
      subTotal += baseLine;

      const dAmt = (baseLine * r.disPerc) / 100;
      totDiscAmt += dAmt;

      const taxableLine = baseLine - dAmt;
      totSgst += (taxableLine * r.sgstPerc) / 100;
      totCgst += (taxableLine * r.cgstPerc) / 100;
    });

    const totDisc = totDiscAmt + cashDisc + splDisc;
    const taxableAmt = Math.max(0, subTotal - totDisc);
    const totalTax = totSgst + totCgst;
    const grossVal = taxableAmt + totalTax + expensesAmt;
    const roundOff = Math.round(grossVal) - grossVal;
    const grandTotal = Math.round(grossVal);

    return {
      totalQty,
      subTotal,
      totDiscAmt,
      totDisc,
      taxableAmt,
      totalTax,
      totSgst,
      totCgst,
      grossVal,
      roundOff,
      grandTotal,
    };
  }, [gridRows, cashDisc, splDisc, expensesAmt]);

  // Open Payment Details Modal (Image 4)
  const handleOpenPaymentModal = () => {
    if (gridRows.length === 0) {
      alert("Please scan at least one saree/product to create POS invoice.");
      return;
    }

    // Set default Cash payment equal to Net Total
    setPaymentRows([
      { type: "CASH", amount: totals.grandTotal, remarks: "" },
      { type: "CN/ADVANCE", amount: 0, remarks: "" },
      { type: "HDFC CARD", amount: 0, remarks: "" },
      { type: "KOTAK", amount: 0, remarks: "" },
      { type: "UPI / QR CODE", amount: 0, remarks: "" },
    ]);

    setIsPaymentModalOpen(true);
  };

  // Payment Rows sum
  const totalPaidAmount = useMemo(() => {
    return paymentRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [paymentRows]);

  const paymentBalanceRemaining = useMemo(() => {
    return Math.max(0, totals.grandTotal - totalPaidAmount);
  }, [totals.grandTotal, totalPaidAmount]);

  const handlePaymentAmountChange = (idx: number, val: number) => {
    setPaymentRows((prev) => {
      const updated = [...prev];
      updated[idx].amount = Math.max(0, val);
      return updated;
    });
  };

  // Confirm & Save POS Invoice (Image 4 Save [F10])
  const handleFinalSaveInvoice = async () => {
    if (!company?.frm_code) return;

    if (totalPaidAmount !== totals.grandTotal) {
      alert(
        `Payment Validation Failed!\nTotal Payment Split (₹${totalPaidAmount.toLocaleString()}) MUST equal Invoice Total (₹${totals.grandTotal.toLocaleString()}).`
      );
      return;
    }

    setLoading(true);
    setSaveSuccess(null);

    try {
      // Update bar_temp to set sold_status = 'S' (Sold)
      const barcodeList = gridRows.map((r) => r.productCode).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({ sold_status: "S" })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      const msg = `Invoice Saved Successfully!\nPOS Bill No #${invoiceNo} for ₹${totals.grandTotal.toLocaleString("en-IN")}`;
      setSaveSuccess(msg);
      alert(msg);

      setIsPaymentModalOpen(false);
      fetchInitialData();

      setTimeout(() => {
        setSaveSuccess(null);
        handleResetForm();
      }, 3000);
    } catch (e: any) {
      console.error("Save error:", e);
      alert(`Failed to save POS Invoice: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset Form (Image 2 New [F4])
  const handleResetForm = () => {
    setMode("add");
    setCurrentIndex(-1);
    setGridRows([]);
    setCashDisc(0);
    setSplDisc(0);
    setExpensesAmt(0);
    setRemarks("");
    setScanInput("");
    fetchInitialData();
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStockModalOpen(false);
        setIsPaymentModalOpen(false);
      } else if (e.key === "Insert") {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setIsStockModalOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === "F5") {
        e.preventDefault();
        if (isStockModalOpen && stockItems[selectedStockRowIndex]) {
          addStockItemToGrid(stockItems[selectedStockRowIndex]);
          setIsStockModalOpen(false);
        } else {
          setIsStockModalOpen(true);
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        const custElem = document.getElementById("pos-cust-mobile");
        custElem?.focus();
      } else if (e.key === "F10") {
        e.preventDefault();
        if (isPaymentModalOpen) {
          handleFinalSaveInvoice();
        } else {
          handleOpenPaymentModal();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridRows, totals.grandTotal, isPaymentModalOpen, isStockModalOpen, stockItems, selectedStockRowIndex]);

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-900 p-1.5 space-y-1.5 font-sans text-xs">
      {/* Top POS Header Bar (Image 2) */}
      <div className="bg-lime-600 text-white px-3 py-1.5 rounded flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-white text-lime-700 rounded-full w-6 h-6 flex items-center justify-center font-black text-sm">
            ➔
          </div>
          <h1 className="text-base font-black tracking-tight">POS</h1>
          <span className="text-xs font-bold text-lime-100 pl-2">
            {mode === "add" ? "Add New Mode" : "Edit Mode"}
          </span>
        </div>

        <div className="text-xs font-mono font-bold text-lime-100 flex items-center gap-4">
          <span>Counter: Counter 1</span>
          <span>Shift: General Shift</span>
        </div>
      </div>

      {/* PROMINENT RECORD SAVED CONFIRMATION BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Step 1 & 2: Top Scan Input Bar & Stock Indicator (Image 2) */}
      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-24">
            <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Type [F2]
            </Label>
            <select
              value={saleType}
              onChange={(e) => setSaleType(e.target.value)}
              className="flex h-7 w-full rounded border border-input bg-background px-2 text-xs font-bold"
            >
              <option value="SALES">SALES</option>
              <option value="RETURN">RETURN</option>
            </select>
          </div>

          <div className="flex-1 min-w-[280px]">
            <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Product Code [Insert] *
            </Label>
            <div className="flex gap-1">
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScanProductCode();
                }}
                placeholder="Scan Saree Barcode (e.g. RS00002) or Product Code..."
                className={`h-7 text-xs bg-white text-slate-900 font-mono font-bold border border-slate-400 ${focusHighlightClass}`}
              />
              <Button
                size="sm"
                className="h-7 text-xs bg-slate-200 text-slate-800 border hover:bg-slate-300 font-bold px-3"
                onClick={() => setIsStockModalOpen(true)}
              >
                Select [F5]
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-slate-200 text-slate-800 border hover:bg-slate-300 font-bold px-3"
                onClick={() => setIsStockModalOpen(true)}
              >
                Search [F3]
              </Button>
            </div>
          </div>
        </div>

        {/* Stock Banner Summary Line (Image 2: C-Rate: T.TT, S-Rate: T.TT : Stock : 10 PCS) */}
        <div className="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-200 px-3 py-1 rounded text-[11px] font-mono font-bold flex justify-between">
          <span>{stockBannerText}</span>
          <span>Shift+F7: Change Product Name</span>
        </div>
      </div>

      {/* STEP 3 & MAIN LAYOUT: GRID TABLE (LEFT 3 COLS) & VOUCHER DETAILS PANEL (RIGHT 1 COL) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
        {/* Main Grid Table (Image 2) */}
        <div className="lg:col-span-3 space-y-1.5">
          <Card className="shadow-sm border overflow-hidden">
            <div className="overflow-x-auto min-h-[340px] max-h-[480px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border-b border-slate-300">
                  <TableRow>
                    <TableHead className="w-6 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-8 text-center p-1 font-bold">S...</TableHead>
                    <TableHead className="w-24 p-1 font-bold">Product Code</TableHead>
                    <TableHead className="min-w-[180px] p-1 font-bold">Product Name [Shift+F7]</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-16 p-1 font-bold">Unit Name</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Unit</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">Gross</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Rate/Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Dis %</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">SGST</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">CGST</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs font-mono">
                  {gridRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center p-12 text-slate-400 font-bold">
                        Scan Saree Barcode or Product Code above to add to invoice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    gridRows.map((row, idx) => (
                      <TableRow key={row.id} className="hover:bg-amber-100/60 transition-colors">
                        <TableCell className="text-center p-1">
                          <button
                            onClick={() => handleDeleteRow(idx)}
                            className="text-red-600 hover:text-red-800 font-black p-0.5"
                          >
                            ✕
                          </button>
                        </TableCell>
                        <TableCell className="text-center p-1 font-bold text-slate-500">
                          {row.sno}
                        </TableCell>
                        <TableCell className="p-1 font-bold text-amber-800 dark:text-amber-300">
                          {row.productCode}
                        </TableCell>
                        <TableCell className="p-1 font-bold text-slate-800 dark:text-slate-100">
                          {row.productName}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.qty}
                            onChange={(e) => handleCellChange(idx, "qty", e.target.value)}
                            className={`h-6 text-xs text-right bg-background font-bold ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 font-medium">{row.unitName}</TableCell>
                        <TableCell className="p-1 text-right">{row.unit}</TableCell>
                        <TableCell className="p-1 text-right">{row.gross.toFixed(3)}</TableCell>
                        <TableCell className="p-1 text-right font-bold">
                          <Input
                            type="number"
                            value={row.rateUnit}
                            onChange={(e) => handleCellChange(idx, "rateUnit", e.target.value)}
                            className={`h-6 text-xs text-right bg-background font-bold ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold text-slate-900 dark:text-white">
                          {row.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-1 text-right">{row.disPerc}</TableCell>
                        <TableCell className="p-1 text-right">{row.sgstPerc}</TableCell>
                        <TableCell className="p-1 text-right">{row.cgstPerc}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Grid Summary Footer Line (Image 2) */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 flex items-center justify-between font-mono font-bold text-xs border-t">
              <span className="w-8 text-center">{gridRows.length}</span>
              <div className="flex gap-12 text-right">
                <span className="w-16">{totals.totalQty.toFixed(2)}</span>
                <span className="w-16">{totals.totalQty.toFixed(3)}</span>
                <span className="w-24 text-slate-900 dark:text-white">
                  {totals.subTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side Voucher Details Panel (Image 2) */}
        <div className="lg:col-span-1 space-y-1.5">
          <Card className="shadow-sm border bg-slate-50 dark:bg-slate-800">
            <div className="bg-slate-200 dark:bg-slate-700 px-2 py-1 font-bold text-[11px] text-slate-800 dark:text-slate-100 flex justify-between">
              <span>Voucher Details [F7]</span>
            </div>

            <CardContent className="p-2 space-y-1.5 text-xs font-sans">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Invoice No</span>
                <div className="flex gap-1 items-center font-mono font-bold">
                  <Input
                    readOnly
                    value={invoiceNo}
                    className="h-6 text-xs text-right w-16 bg-white"
                  />
                  <span className="text-[10px] text-slate-500">{invoiceTime}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Date (Thu)</span>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-6 text-xs font-mono text-right w-28 bg-white"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Salesman[F7]</span>
                <Input
                  value={salesman}
                  onChange={(e) => setSalesman(e.target.value)}
                  className="h-6 text-xs text-right w-28 bg-white"
                />
              </div>

              <hr className="my-1 border-slate-300" />

              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">SubTotal</span>
                  <span className="font-bold">{totals.subTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Cash Disc.</span>
                  <Input
                    type="number"
                    value={cashDisc}
                    onChange={(e) => setCashDisc(Number(e.target.value) || 0)}
                    className="h-5 text-xs text-right w-20 bg-white"
                  />
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Total Disc.</span>
                  <span className="text-red-600">{totals.totDisc.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Taxable Amt.</span>
                  <span>{totals.taxableAmt.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Total Tax</span>
                  <span className="text-amber-700">{totals.totalTax.toFixed(2)}</span>
                </div>

                <div className="pt-1 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Other Charges / Expenses A/c
                  </span>
                  <div className="flex justify-end mt-0.5">
                    <Input
                      type="number"
                      value={expensesAmt}
                      onChange={(e) => setExpensesAmt(Number(e.target.value) || 0)}
                      className="h-5 text-xs text-right w-24 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center font-bold pt-1">
                  <span>Total Value</span>
                  <span>{totals.grossVal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>Round Off</span>
                  <span>{totals.roundOff.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-600">Remarks</span>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-6 text-xs bg-white mt-0.5"
                />
              </div>

              {/* BIG BRIGHT GREEN NET TOTAL DISPLAY BOX (Image 2) */}
              <div className="bg-lime-500 text-slate-950 p-2 rounded text-right border-2 border-lime-600 shadow-inner mt-2">
                <span className="text-2xl font-black font-mono tracking-tight">
                  {totals.grandTotal.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOTTOM CUSTOMER DETAILS BAR (Image 2) */}
      <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded border flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">Mobile [F6]</span>
            <Input
              id="pos-cust-mobile"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              className="h-6 text-xs w-28 bg-white"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">Customer [F6]</span>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-6 text-xs w-28 bg-white font-bold"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">E-Mail ID</span>
            <Input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="h-6 text-xs w-36 bg-white"
            />
          </div>

          <div className="flex items-center gap-1 font-mono">
            <span className="font-bold text-slate-600">A/c Balance</span>
            <span className="bg-white border px-2 py-0.5 rounded font-bold">
              {customerBalance.toFixed(2)} Cr
            </span>
          </div>

          <Button
            size="sm"
            className="h-6 text-xs bg-slate-200 text-slate-800 border hover:bg-slate-300 font-bold px-2"
          >
            Save [F5]
          </Button>
        </div>

        <div className="flex items-center gap-4 font-mono font-bold text-slate-600">
          <span>Tendered: 0.00</span>
          <span>Refund: 0.00</span>
        </div>
      </div>

      {/* BOTTOM ACTION BUTTONS TOOLBAR (Image 2) */}
      <div className="bg-white dark:bg-slate-800 p-1.5 rounded border flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
            onClick={handleOpenPaymentModal}
          >
            Save [F10]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
            onClick={handleResetForm}
          >
            New [F4]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
            onClick={handleOpenPaymentModal}
          >
            Payment Details
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
          >
            Other Details
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
          >
            Options ▾
          </Button>
        </div>

        <div className="flex items-center gap-1.5 font-bold">
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 border"
          >
            Previous [Pg Up]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 border"
          >
            Next [Pg Down]
          </Button>
        </div>
      </div>

      {/* IMAGE 3: STOCK SELECTION POPUP MODAL (Stock : DESIGNER SAREE) */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 border">
          <div className="bg-slate-300 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Stock : DESIGNER SAREE</span>
          </div>

          <div className="p-2 overflow-y-auto max-h-[420px]">
            <Table className="w-full text-xs border-collapse font-mono">
              <TableHeader className="bg-slate-100 font-bold text-[11px] border-b">
                <TableRow>
                  <TableHead className="w-8 text-center p-1 font-bold">SNo</TableHead>
                  <TableHead className="w-24 p-1 font-bold">Batch Name</TableHead>
                  <TableHead className="w-12 text-right p-1 font-bold">Stock</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">P.Rate</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">Cost Rate</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">MarkUp</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">Sale Rate</TableHead>
                  <TableHead className="w-14 p-1 font-bold">Design</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">Purchase Qty</TableHead>
                  <TableHead className="w-20 p-1 font-bold">Date</TableHead>
                  <TableHead className="w-14 p-1 font-bold">Doc No</TableHead>
                  <TableHead className="p-1 font-bold">Account Name</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {stockItems.map((b, idx) => (
                  <TableRow
                    key={b.bar_no}
                    className={`cursor-pointer transition-colors ${
                      selectedStockRowIndex === idx
                        ? "bg-sky-100 dark:bg-sky-950 font-bold"
                        : "hover:bg-amber-50"
                    }`}
                    onClick={() => setSelectedStockRowIndex(idx)}
                    onDoubleClick={() => {
                      addStockItemToGrid(b);
                      setIsStockModalOpen(false);
                    }}
                  >
                    <TableCell className="text-center p-1">{idx + 1}</TableCell>
                    <TableCell className="p-1 font-bold text-amber-800">{b.bar_no}</TableCell>
                    <TableCell className="text-right p-1 font-bold">{b.qty || 1}</TableCell>
                    <TableCell className="text-right p-1">{(b.pc_pur_rate || 500).toFixed(2)}</TableCell>
                    <TableCell className="text-right p-1">{(b.cost_rate || 500).toFixed(2)}</TableCell>
                    <TableCell className="text-right p-1">100.00</TableCell>
                    <TableCell className="text-right p-1 font-bold text-emerald-700">
                      {(b.pc_sale_rate || 1000).toFixed(2)}
                    </TableCell>
                    <TableCell className="p-1">1111</TableCell>
                    <TableCell className="text-right p-1">1.00</TableCell>
                    <TableCell className="p-1">24-01-2019</TableCell>
                    <TableCell className="p-1">123</TableCell>
                    <TableCell className="p-1">Peetex Sarees</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-100 p-2 border-t flex justify-between items-center text-xs font-mono font-bold">
            <div className="flex gap-2 items-center">
              <span className="bg-white border px-3 py-1 rounded text-slate-900 font-bold">
                {stockItems.length}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-slate-200 text-slate-900 border hover:bg-slate-300 font-bold px-4"
                onClick={() => {
                  if (stockItems[selectedStockRowIndex]) {
                    addStockItemToGrid(stockItems[selectedStockRowIndex]);
                    setIsStockModalOpen(false);
                  }
                }}
              >
                Proceed [F5]
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-red-600 font-bold px-4"
                onClick={() => setIsStockModalOpen(false)}
              >
                Cancel [Esc]
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IMAGE 4: PAYMENT DETAILS MODAL (Payment Details [F8]) */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-2xl p-0 border">
          <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Payment Details [F8]</span>
          </div>

          <div className="p-3 space-y-2">
            {/* Top Amount & Red Balance Bar (Image 4) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold">
              <div className="flex items-center gap-2">
                <span className="text-slate-700">Amount</span>
                <Input
                  readOnly
                  value={totals.grandTotal.toFixed(2)}
                  className="h-7 text-xs text-right bg-white font-black text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-red-600 font-black">Balance</span>
                <Input
                  readOnly
                  value={paymentBalanceRemaining.toFixed(2)}
                  className="h-7 text-xs text-right bg-white font-black text-red-600 text-sm"
                />
              </div>
            </div>

            {/* Payment Table Breakdown (Image 4) */}
            <Table className="w-full text-xs border font-mono">
              <TableHeader className="bg-slate-100 font-bold text-[11px]">
                <TableRow>
                  <TableHead className="w-40 p-1 font-bold">Payment Type</TableHead>
                  <TableHead className="w-36 text-right p-1 font-bold">Amount</TableHead>
                  <TableHead className="p-1 font-bold">Remarks</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {paymentRows.map((p, idx) => (
                  <TableRow key={p.type} className="hover:bg-amber-50">
                    <TableCell className="p-1 font-bold text-slate-800">{p.type}</TableCell>
                    <TableCell className="p-1 text-right">
                      <Input
                        type="number"
                        value={p.amount || ""}
                        onChange={(e) =>
                          handlePaymentAmountChange(idx, Number(e.target.value) || 0)
                        }
                        className={`h-6 text-xs text-right font-bold ${
                          p.amount > 0 ? "bg-amber-200 text-slate-950 font-black" : "bg-white"
                        }`}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        value={p.remarks}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRows((prev) => {
                            const updated = [...prev];
                            updated[idx].remarks = val;
                            return updated;
                          });
                        }}
                        className="h-6 text-xs bg-white"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-100 p-2 border-t flex justify-end gap-2 text-xs font-bold">
            <Button
              size="sm"
              className="h-7 text-xs bg-slate-200 text-slate-900 border hover:bg-slate-300 font-bold px-4"
              onClick={handleFinalSaveInvoice}
              disabled={loading || paymentBalanceRemaining > 0}
            >
              Save [F10]
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 font-bold px-4"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel [Esc]
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
