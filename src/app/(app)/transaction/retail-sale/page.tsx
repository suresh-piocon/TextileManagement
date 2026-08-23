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
  barcodeNo: string;
  batchNo: string;
  prcode: number;
  prname: string;
  color?: string;
  size?: string;
  isBatchItem: boolean;
  qty: number;
  maxStockQty: number;
  unit: string;
  purRate: number;
  saleRate: number;
  amount: number;
  disPerc: number;
  discAmt: number;
  sgstPerc: number;
  cgstPerc: number;
  igstPerc: number;
  netAmount: number;
}

interface PaymentSplit {
  cash: number;
  upi: number;
  bankTransfer: number;
  neft: number;
  creditCard: number;
  debitCard: number;
  others: number;
  otherRemarks: string;
}

export default function RetailSalePOSPage() {
  const router = useRouter();
  const { company } = useApp();
  const supabase = createClient();

  // Mode & Loading
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Header POS Sales Info
  const [invoiceNo, setInvoiceNo] = useState<string>("POS-1001");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [userName] = useState<string>("admin");
  const [counterName] = useState<string>("Counter 1");
  const [shiftName] = useState<string>("General Shift");
  const [billType, setBillType] = useState<string>("CASH"); // CASH | CREDIT | CARD / UPI
  const [salesperson, setSalesperson] = useState<string>("Direct");

  // Customer State (F6)
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<any | null>(null);
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [customerBalance, setCustomerBalance] = useState<number>(0);

  // Barcode & Stock Scan Input (F3 / Insert)
  const [scanInput, setScanInput] = useState<string>("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Invoice Items Grid
  const [gridRows, setGridRows] = useState<POSGridRow[]>([]);

  // Discounts & Tax Settings
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [taxCode, setTaxCode] = useState<string>("LOCAL"); // LOCAL | INTERSTATE

  // Saved Invoices List for Navigation (PgUp / PgDn)
  const [savedInvoices, setSavedInvoices] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Payment Collection Modal State (F10 / Ctrl+P)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [payments, setPayments] = useState<PaymentSplit>({
    cash: 0,
    upi: 0,
    bankTransfer: 0,
    neft: 0,
    creditCard: 0,
    debitCard: 0,
    others: 0,
    otherRemarks: "",
  });

  // Stock List & Selection Popup Modal (F8)
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const [availableStockItems, setAvailableStockItems] = useState<any[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState<string>("");

  // Focus Highlight Class
  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:ring-2 focus:ring-amber-500 font-medium transition-colors";

  // Initial Fetch: Load Customers, Stock List, & Saved Invoices
  const fetchInitialData = useCallback(async () => {
    if (!company?.frm_code) return;
    try {
      // 1. Fetch Customers (Ledgers under Customers)
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

      if (barData) setAvailableStockItems(barData);

      // Set auto POS invoice sequence
      if (mode === "add") {
        const nextSeq = (savedInvoices.length || 0) + 1;
        setInvoiceNo(`POS-${1000 + nextSeq}`);
      }
    } catch (e) {
      console.error("Error fetching initial POS data:", e);
    }
  }, [company?.frm_code, supabase, mode, savedInvoices.length]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Focus Scan Box on Open & Reset
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Customer Selection Handler (F6)
  const handleCustomerSelect = (customerIdStr: string) => {
    const cId = Number(customerIdStr);
    setSelectedCustomerId(cId);

    const cust = customers.find((c) => c.ledg_code === cId);
    if (cust) {
      setSelectedCustomerObj(cust);
      setCustomerMobile(cust.ph_no || cust.cell_no1 || cust.cell_no || "");
      setCustomerBalance(cust.bal_amt || cust.op_bal || 0);
    } else {
      setSelectedCustomerObj(null);
      setCustomerMobile("");
      setCustomerBalance(0);
    }
  };

  // Barcode / Batch Scan Handler (Step 2 & 3)
  const handleScanBarcode = async (inputVal?: string) => {
    const query = (inputVal || scanInput).trim().toUpperCase();
    if (!query || !company?.frm_code) return;

    // Check if barcode is already added to grid
    const alreadyAdded = gridRows.find(
      (r) => r.barcodeNo.toUpperCase() === query
    );
    if (alreadyAdded) {
      alert(`Barcode "${query}" is already added to this invoice!`);
      setScanInput("");
      return;
    }

    try {
      // Search stock in bar_temp
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
            alert(`Barcode "${bar.bar_no}" is already sold to another customer.`);
            setScanInput("");
            return;
          }
          if (status === "PR") {
            alert(`Barcode "${bar.bar_no}" is returned to supplier.`);
            setScanInput("");
            return;
          }

          // Add exact item to grid automatically
          addStockItemToGrid(bar);
          setScanInput("");
        } else {
          // Multiple records found -> Display Stock Selection Window Popup
          setAvailableStockItems(barRows);
          setIsStockModalOpen(true);
        }
      } else {
        alert(`Barcode / Product "${query}" not found in available stock.`);
        setScanInput("");
      }
    } catch (e) {
      console.error("Barcode scan error:", e);
    }
  };

  // Add Item to Grid (Step 3 & 4)
  const addStockItemToGrid = (bar: any) => {
    const saleRate = bar.pc_sale_rate || bar.tag_rate || 1200;
    const purRate = bar.pc_pur_rate || 1000;

    const newRow: POSGridRow = {
      id: `pos-${bar.bar_no}-${Date.now()}`,
      sno: gridRows.length + 1,
      barcodeNo: bar.bar_no,
      batchNo: bar.bar_no,
      prcode: bar.prcode || 101,
      prname: bar.grp_name || "SILK SAREE / DHOTHIES SET",
      color: "Red / Gold",
      size: "Free Size",
      isBatchItem: false,
      qty: 1, // Barcode item qty fixed = 1
      maxStockQty: bar.qty || 1,
      unit: bar.unit_name || "NOS",
      purRate: purRate,
      saleRate: saleRate,
      amount: saleRate,
      disPerc: 0,
      discAmt: 0,
      sgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
      cgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
      igstPerc: taxCode === "INTERSTATE" ? 5 : 0,
      netAmount: saleRate,
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
        if (!row.isBatchItem) {
          alert("Unique barcode item quantity is fixed at 1.");
          row.qty = 1;
        } else {
          const parsed = Math.max(1, Number(value) || 1);
          if (parsed > row.maxStockQty) {
            alert(`Selling quantity (${parsed}) cannot exceed stock available (${row.maxStockQty}).`);
            row.qty = row.maxStockQty;
          } else {
            row.qty = parsed;
          }
        }
      } else if (field === "saleRate") {
        row.saleRate = Math.max(0, Number(value) || 0);
      } else if (field === "disPerc") {
        row.disPerc = Math.max(0, Number(value) || 0);
        row.discAmt = (row.qty * row.saleRate * row.disPerc) / 100;
      } else if (field === "discAmt") {
        row.discAmt = Math.max(0, Number(value) || 0);
      } else {
        (row as any)[field] = value;
      }

      const grossAmount = row.qty * row.saleRate - row.discAmt;
      row.amount = Math.max(0, grossAmount);
      row.netAmount = Math.max(0, grossAmount);

      updated[index] = row;
      return updated;
    });
  };

  // Delete Grid Row
  const handleDeleteRow = (index: number) => {
    setGridRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, sno: i + 1 }))
    );
  };

  // Calculations Summary
  const totals = useMemo(() => {
    let totQty = 0;
    let subTotal = 0;
    let totDiscAmt = 0;
    let totSgst = 0;
    let totCgst = 0;
    let totIgst = 0;

    gridRows.forEach((r) => {
      totQty += r.qty;
      const lineBase = r.qty * r.saleRate;
      subTotal += lineBase;
      totDiscAmt += r.discAmt;

      const taxableLine = lineBase - r.discAmt;
      totSgst += (taxableLine * r.sgstPerc) / 100;
      totCgst += (taxableLine * r.cgstPerc) / 100;
      totIgst += (taxableLine * r.igstPerc) / 100;
    });

    const totDisc = totDiscAmt + cashDisc + splDisc;
    const taxableAmt = subTotal - totDisc;
    const totalTax = totSgst + totCgst + totIgst;
    const grossVal = taxableAmt + totalTax;
    const roundOff = Math.round(grossVal) - grossVal;
    const grandTotal = Math.round(grossVal);

    return {
      totQty,
      subTotal,
      totDiscAmt,
      totDisc,
      taxableAmt,
      totalTax,
      totSgst,
      totCgst,
      totIgst,
      grossVal,
      roundOff,
      grandTotal,
    };
  }, [gridRows, cashDisc, splDisc]);

  // Open Payment Modal (Step 6)
  const handleOpenPaymentModal = () => {
    if (gridRows.length === 0) {
      alert("Please scan at least one barcode item to create invoice.");
      return;
    }
    if (billType === "CREDIT" && !selectedCustomerId) {
      alert("Customer selection [F6] is mandatory for Credit Sales.");
      return;
    }

    // Auto-fill Cash payment with full grand total as default
    setPayments({
      cash: totals.grandTotal,
      upi: 0,
      bankTransfer: 0,
      neft: 0,
      creditCard: 0,
      debitCard: 0,
      others: 0,
      otherRemarks: "",
    });
    setIsPaymentModalOpen(true);
  };

  // Payment Total Split Sum
  const totalPaymentSplit = useMemo(() => {
    return (
      payments.cash +
      payments.upi +
      payments.bankTransfer +
      payments.neft +
      payments.creditCard +
      payments.debitCard +
      payments.others
    );
  }, [payments]);

  // Save POS Invoice (Step 10)
  const handleFinalSaveInvoice = async () => {
    if (!company?.frm_code) return;

    if (billType === "CREDIT" && !selectedCustomerId) {
      alert("Customer selection [F6] is mandatory for Credit Sales.");
      return;
    }

    if (totalPaymentSplit !== totals.grandTotal) {
      alert(
        `Payment Split Validation Error:\nTotal Payments (₹${totalPaymentSplit.toLocaleString()}) MUST equal Invoice Grand Total (₹${totals.grandTotal.toLocaleString()}).`
      );
      return;
    }

    setLoading(true);
    setSaveSuccess(null);

    try {
      // Update bar_temp to set sold_status = 'S' (Sold) to reduce stock immediately
      const barcodeList = gridRows.map((r) => r.barcodeNo).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({ sold_status: "S" })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      const msg = `POS Retail Invoice ${invoiceNo} Saved Successfully!\nGrand Total Paid: ₹${totals.grandTotal.toLocaleString("en-IN")}`;
      setSaveSuccess(msg);
      alert(msg);

      setIsPaymentModalOpen(false);
      fetchInitialData();

      setTimeout(() => {
        setSaveSuccess(null);
        handleResetForm();
      }, 3000);
    } catch (e: any) {
      console.error("Error saving POS invoice:", e);
      alert(`Failed to save POS Invoice: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset Form (Step 11 - New Button F4)
  const handleResetForm = () => {
    setMode("add");
    setCurrentIndex(-1);
    setSelectedCustomerId("");
    setSelectedCustomerObj(null);
    setCustomerMobile("");
    setCustomerBalance(0);
    setGridRows([]);
    setCashDisc(0);
    setSplDisc(0);
    setScanInput("");
    fetchInitialData();
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // Keyboard Shortcuts (Step 18)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Insert") {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setIsStockModalOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === "F6") {
        e.preventDefault();
        const selectElem = document.getElementById("pos-customer-select");
        selectElem?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        setIsStockModalOpen(true);
      } else if (e.key === "F10" || (e.ctrlKey && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        handleOpenPaymentModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridRows, totals.grandTotal, billType, selectedCustomerId]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-2 space-y-2 font-sans text-xs">
      {/* Step 1: Top POS Sales Banner Header */}
      <div className="bg-amber-600 text-white px-3 py-2 rounded shadow flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-5 w-5" />
          <div>
            <h1 className="text-base font-bold tracking-tight">Retail Sale (POS)</h1>
            <p className="text-[11px] text-amber-100">Fast Barcode Billing & Multiple Split Payment Collection</p>
          </div>
          <span className="bg-amber-800 text-amber-100 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
            {mode === "add" ? "New Bill Mode" : "Edit Mode"}
          </span>
        </div>

        {/* Counter Info Badges */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="bg-amber-700 px-2 py-0.5 rounded font-bold">
            Invoice: <span className="text-amber-200">{invoiceNo}</span>
          </span>
          <span className="bg-amber-700 px-2 py-0.5 rounded">
            Date: {invoiceDate}
          </span>
          <span className="bg-amber-700 px-2 py-0.5 rounded">
            User: {userName}
          </span>
          <span className="bg-amber-700 px-2 py-0.5 rounded">
            Counter: {counterName}
          </span>
          <span className="bg-amber-700 px-2 py-0.5 rounded">
            Shift: {shiftName}
          </span>
        </div>
      </div>

      {/* PROMINENT RECORD SAVED CONFIRMATION BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-md font-bold text-sm flex items-center gap-2 shadow-md animate-bounce">
          <CheckCircle2 className="h-5 w-5" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* STEP 2: BARCODE SCAN BOX & CUSTOMER SELECTION BAR */}
      <Card className="shadow-sm border-2 border-amber-500 bg-amber-50/50 dark:bg-slate-800">
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            {/* Step 2: Barcode / Batch Scan Box (Primary Focus) */}
            <div className="md:col-span-2">
              <Label className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1 uppercase tracking-wide">
                <Barcode className="h-4 w-4 text-amber-600" />
                Scan Barcode / Batch No [F3 / Insert] *
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScanBarcode();
                  }}
                  placeholder="Scan Saree Barcode (e.g. KS02369) or Batch No..."
                  className={`h-9 text-sm bg-white text-slate-900 font-mono font-bold border-2 border-amber-400 ${focusHighlightClass}`}
                />
                <Button
                  size="sm"
                  className="h-9 bg-slate-900 text-white font-bold px-4 hover:bg-slate-800"
                  onClick={() => handleScanBarcode()}
                >
                  Scan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs font-bold border-amber-400 text-amber-900"
                  onClick={() => setIsStockModalOpen(true)}
                >
                  Stock List [F8]
                </Button>
              </div>
            </div>

            {/* Step 5: Customer Selection (F6) */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-amber-600" />
                Customer Selection [F6]
              </Label>
              <select
                id="pos-customer-select"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-bold mt-1 ${focusHighlightClass}`}
              >
                <option value="">-- Cash Retail Customer --</option>
                {customers.map((c) => (
                  <option key={c.ledg_code} value={c.ledg_code}>
                    {c.ledg_name} {c.ph_no ? `(${c.ph_no})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Bill Type Dropdown */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bill Type
              </Label>
              <select
                value={billType}
                onChange={(e) => setBillType(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-bold mt-1 ${focusHighlightClass}`}
              >
                <option value="CASH">CASH SALE</option>
                <option value="CREDIT">CREDIT SALE (F6 Required)</option>
                <option value="CARD_UPI">CARD / UPI / DIGITAL</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 3 & 4: MAIN POS INVOICE GRID TABLE & SIDE PAYMENTS SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Main Invoice Grid */}
        <div className="lg:col-span-3 space-y-2">
          <Card className="shadow-sm border overflow-hidden">
            <div className="p-2 bg-slate-800 text-white font-bold flex justify-between items-center text-xs">
              <span>POS BILLING ITEMS GRID</span>
              <span>Total Items: {gridRows.length}</span>
            </div>

            <div className="overflow-x-auto min-h-[320px] max-h-[460px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-8 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-10 text-center p-1 font-bold">SNo</TableHead>
                    <TableHead className="w-28 p-1 font-bold">Barcode No</TableHead>
                    <TableHead className="w-28 p-1 font-bold">Batch No</TableHead>
                    <TableHead className="min-w-[160px] p-1 font-bold">Product Name</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-14 text-center p-1 font-bold">Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Sale Rate</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">Dis%</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">DisAmt</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">GST%</TableHead>
                    <TableHead className="w-24 text-right p-1 font-bold">Net Total</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs font-mono">
                  {gridRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center p-12 text-slate-500 font-bold space-y-2">
                        <Barcode className="h-10 w-10 text-amber-500 mx-auto" />
                        <p className="text-sm">Scan barcode above to add items automatically to bill.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    gridRows.map((row, idx) => (
                      <TableRow key={row.id} className="hover:bg-amber-50/50 transition-colors">
                        <TableCell className="text-center p-1">
                          <button
                            onClick={() => handleDeleteRow(idx)}
                            className="text-red-600 hover:text-red-800 font-black p-0.5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center p-1 font-bold text-slate-500">
                          {row.sno}
                        </TableCell>
                        <TableCell className="p-1 font-bold text-amber-700 dark:text-amber-400">
                          {row.barcodeNo}
                        </TableCell>
                        <TableCell className="p-1 font-medium text-slate-700">
                          {row.batchNo}
                        </TableCell>
                        <TableCell className="p-1 font-bold text-slate-800 dark:text-slate-100">
                          {row.prname}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            readOnly={!row.isBatchItem}
                            value={row.qty}
                            onChange={(e) => handleCellChange(idx, "qty", e.target.value)}
                            className={`h-7 text-xs text-right bg-background font-bold ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center font-bold text-slate-700">
                          {row.unit}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.saleRate}
                            onChange={(e) => handleCellChange(idx, "saleRate", e.target.value)}
                            className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold">
                          ₹{row.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.disPerc}
                            onChange={(e) => handleCellChange(idx, "disPerc", e.target.value)}
                            className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.discAmt}
                            onChange={(e) => handleCellChange(idx, "discAmt", e.target.value)}
                            className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold text-slate-600">
                          {row.sgstPerc + row.cgstPerc + row.igstPerc}%
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold text-emerald-700">
                          ₹{row.netAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="bg-slate-200 dark:bg-slate-800 p-2 flex items-center justify-between font-bold text-xs border-t">
              <span className="text-slate-600">Total Scanned Items: {gridRows.length}</span>
              <div className="flex gap-6 font-mono text-xs">
                <span>
                  Total Qty: <span className="bg-white px-2 py-0.5 rounded text-slate-900 font-bold">{totals.totQty}</span>
                </span>
                <span>
                  Sub Total: <span className="bg-white px-2 py-0.5 rounded text-slate-900 font-bold">₹{totals.subTotal.toFixed(2)}</span>
                </span>
                <span>
                  Total Tax: <span className="bg-white px-2 py-0.5 rounded text-amber-700 font-bold">₹{totals.totalTax.toFixed(2)}</span>
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side POS Totals & Big Pay Banner */}
        <div className="lg:col-span-1 space-y-2">
          <Card className="shadow-sm border">
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold flex justify-between items-center text-xs">
              <span>POS Invoice Summary</span>
              <span className="text-[10px] bg-amber-600 px-1.5 py-0.5 rounded">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <CardContent className="p-2 space-y-2 text-xs">
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">SubTotal:</span>
                  <span className="font-bold">₹{totals.subTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Cash Disc.:</span>
                  <Input
                    type="number"
                    value={cashDisc}
                    onChange={(e) => setCashDisc(Number(e.target.value) || 0)}
                    className="h-6 text-xs text-right w-24 font-mono"
                  />
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Total Disc.:</span>
                  <span className="text-red-600">₹{totals.totDisc.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Taxable Amt.:</span>
                  <span>₹{totals.taxableAmt.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center font-bold">
                  <span>Total Tax:</span>
                  <span className="text-amber-700">₹{totals.totalTax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>Round Off:</span>
                  <span>₹{totals.roundOff.toFixed(2)}</span>
                </div>
              </div>

              {/* BIG GOLDEN NET PAYABLE BANNER */}
              <div className="bg-amber-500 text-white rounded p-3 text-center border-2 border-amber-600 shadow space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase block text-amber-100">
                  TOTAL NET PAYABLE
                </span>
                <span className="text-2xl font-black font-mono">
                  ₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <Button
                  size="sm"
                  className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow"
                  onClick={handleOpenPaymentModal}
                >
                  Collect Payment [F10 / Ctrl+P]
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Controls Toolbar */}
      <div className="bg-card border rounded p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold"
            onClick={handleResetForm}
          >
            New [F4]
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold border-amber-400 text-amber-900"
            onClick={() => setIsStockModalOpen(true)}
          >
            Stock List [F8]
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 shadow"
            onClick={handleOpenPaymentModal}
            disabled={loading}
          >
            Save Invoice [F10]
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-red-600 font-bold"
            onClick={handleResetForm}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* STEP 6 & 8: PAYMENT COLLECTION & SPLIT RECEIPT MODAL (F10 / Ctrl+P) */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="bg-amber-600 text-white p-3 rounded-t-lg">
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Collection & Split Receipt Window
              </span>
              <span className="text-xs bg-amber-800 px-2 py-0.5 rounded font-mono">
                Bill Net Total: ₹{totals.grandTotal.toLocaleString("en-IN")}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-3 space-y-3 font-sans text-xs">
            <p className="text-slate-500 font-medium">
              Specify split payment amounts across collection modes. Total split payments MUST equal <strong>₹{totals.grandTotal.toLocaleString("en-IN")}</strong>:
            </p>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-md border font-mono">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cash Received</Label>
                <Input
                  type="number"
                  value={payments.cash}
                  onChange={(e) => setPayments({ ...payments, cash: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">UPI / QR Code</Label>
                <Input
                  type="number"
                  value={payments.upi}
                  onChange={(e) => setPayments({ ...payments, upi: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bank Transfer</Label>
                <Input
                  type="number"
                  value={payments.bankTransfer}
                  onChange={(e) => setPayments({ ...payments, bankTransfer: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">NEFT / RTGS</Label>
                <Input
                  type="number"
                  value={payments.neft}
                  onChange={(e) => setPayments({ ...payments, neft: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Credit Card</Label>
                <Input
                  type="number"
                  value={payments.creditCard}
                  onChange={(e) => setPayments({ ...payments, creditCard: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Debit Card</Label>
                <Input
                  type="number"
                  value={payments.debitCard}
                  onChange={(e) => setPayments({ ...payments, debitCard: Number(e.target.value) || 0 })}
                  className={`h-8 text-xs font-bold ${focusHighlightClass}`}
                />
              </div>
            </div>

            {/* Split Payment Validation Total Bar */}
            <div className={`p-2.5 rounded-md font-mono font-bold flex justify-between items-center text-xs ${
              totalPaymentSplit === totals.grandTotal
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-rose-100 text-rose-900 border border-rose-300"
            }`}>
              <span>Total Split Payment Collected:</span>
              <span className="text-sm">₹{totalPaymentSplit.toLocaleString("en-IN")} / ₹{totals.grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <DialogFooter className="bg-slate-100 p-3 rounded-b-lg flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
              onClick={handleFinalSaveInvoice}
              disabled={loading || totalPaymentSplit !== totals.grandTotal}
            >
              {loading ? "Processing..." : "Confirm & Save POS Invoice [F10]"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STOCK LIST & SELECTION POPUP MODAL (F8) */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="bg-slate-800 text-white p-3 rounded-t-lg">
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Available Stock Selection Window [F8]</span>
              <Input
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                placeholder="Search Stock..."
                className="h-7 text-xs w-48 bg-white text-slate-900"
              />
            </DialogTitle>
          </DialogHeader>

          <div className="p-2 max-h-[400px] overflow-y-auto">
            <Table className="w-full text-xs border">
              <TableHeader className="bg-slate-200 font-bold">
                <TableRow>
                  <TableHead className="font-bold">Barcode</TableHead>
                  <TableHead className="font-bold">Batch No</TableHead>
                  <TableHead className="font-bold">Product Name</TableHead>
                  <TableHead className="text-right font-bold">Pur. Rate</TableHead>
                  <TableHead className="text-right font-bold">Sale Rate</TableHead>
                  <TableHead className="text-center font-bold">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="font-mono text-xs">
                {availableStockItems
                  .filter((b) =>
                    stockSearchQuery
                      ? b.bar_no?.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
                        b.grp_name?.toLowerCase().includes(stockSearchQuery.toLowerCase())
                      : true
                  )
                  .map((b) => (
                    <TableRow key={b.bar_no} className="hover:bg-amber-50">
                      <TableCell className="font-bold text-amber-700">{b.bar_no}</TableCell>
                      <TableCell>{b.bar_no}</TableCell>
                      <TableCell>{b.grp_name || "SILK SAREE"}</TableCell>
                      <TableCell className="text-right">₹{b.pc_pur_rate || 1000}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">₹{b.pc_sale_rate || 1200}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                          onClick={() => {
                            addStockItemToGrid(b);
                            setIsStockModalOpen(false);
                          }}
                        >
                          Select & Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
