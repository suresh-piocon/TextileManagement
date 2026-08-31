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
  hsnCode: string;
  qty: number;
  unitName: string;
  gross: number;
  mrp: number;
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

// Convert numbers to words for thermal tax invoice print
function numberToWords(num: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    if ((n = n.toString() as any).length > 9) return "overflow";
    let nArr = ("000000000" + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return "";
    let str = "";
    str += nArr[1] !== "00" ? (a[Number(nArr[1])] || b[Number(nArr[1][0])] + " " + a[Number(nArr[1][1])]) + "Crore " : "";
    str += nArr[2] !== "00" ? (a[Number(nArr[2])] || b[Number(nArr[2][0])] + " " + a[Number(nArr[2][1])]) + "Lakh " : "";
    str += nArr[3] !== "00" ? (a[Number(nArr[3])] || b[Number(nArr[3][0])] + " " + a[Number(nArr[3][1])]) + "Thousand " : "";
    str += nArr[4] !== "0" ? (a[Number(nArr[4])] || b[Number(nArr[4][0])] + " " + a[Number(nArr[4][1])]) + "Hundred " : "";
    str += nArr[5] !== "00" ? ((str !== "") ? "and " : "") + (a[Number(nArr[5])] || b[Number(nArr[5][0])] + " " + a[Number(nArr[5][1])]) : "";
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const words = inWords(integerPart);
  return words ? `${words} Rupees Only` : "Zero Rupees Only";
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

  // Stock Summary Banner line
  const [stockBannerText, setStockBannerText] = useState<string>(
    "C-Rate: T.TT, S-Rate: T.TT : Stock : 23 PCS"
  );

  // Voucher Details Panel - POS-000001 6-digit zero padded
  const [invoiceNo, setInvoiceNo] = useState<string>("POS-000001");
  const [invoiceTime, setInvoiceTime] = useState<string>("17:48:48");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [salesman, setSalesman] = useState<string>("Direct");
  const [cashDiscPerc, setCashDiscPerc] = useState<number>(0);
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [expensesAmt, setExpensesAmt] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Customer Details & Cash Sale Customer Modal [F6]
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Cash Customer");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerGstNo, setCustomerGstNo] = useState<string>("");
  const [customerState, setCustomerState] = useState<string>("Tamil Nadu");
  const [customerStateCode, setCustomerStateCode] = useState<string>("33");
  const [customerEmail, setCustomerEmail] = useState<string>("");

  // DB Maps & Lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [productTaxMap, setProductTaxMap] = useState<
    Map<string, { refNo?: number; prdCode?: string; prdName?: string; gstPerc: number; hsnCode: string; units?: string; grpCode?: number }>
  >(new Map());

  // Main POS Grid Rows
  const [gridRows, setGridRows] = useState<POSGridRow[]>([]);

  // Modals state: Stock Modal, Payment Modal, and Invoice Search Modal [F3]
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isInvoiceSearchModalOpen, setIsInvoiceSearchModalOpen] = useState<boolean>(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState<string>("");
  const [selectedInvoiceRowIndex, setSelectedInvoiceRowIndex] = useState<number>(0);
  const invoiceRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Stock Modal Highlighted Row Index & Row Refs for Auto-Scroll Navigation
  const [selectedStockRowIndex, setSelectedStockRowIndex] = useState<number>(0);
  const stockRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Auto-scroll highlighted row into view when navigating with Up/Down Arrow keys in Stock Modal
  useEffect(() => {
    if (isStockModalOpen && stockRowRefs.current[selectedStockRowIndex]) {
      stockRowRefs.current[selectedStockRowIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedStockRowIndex, isStockModalOpen]);

  // Auto-scroll highlighted row into view when navigating with Up/Down Arrow keys in Invoice Search Modal
  useEffect(() => {
    if (isInvoiceSearchModalOpen && invoiceRowRefs.current[selectedInvoiceRowIndex]) {
      invoiceRowRefs.current[selectedInvoiceRowIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedInvoiceRowIndex, isInvoiceSearchModalOpen]);

  // Payment Breakdown Table
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { type: "CASH", amount: 0, remarks: "" },
    { type: "CN/ADVANCE", amount: 0, remarks: "" },
    { type: "CARD", amount: 0, remarks: "" },
    { type: "UPI / QR CODE", amount: 0, remarks: "" },
  ]);

  // Filtered saved Retail POS Sales Invoices for F3 Lookup Search
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearchTerm.trim().toLowerCase();
    if (!q) return savedInvoices;
    return savedInvoices.filter((inv) => {
      const invNoStr = String(inv.rm_bill_ref_no || `POS-${inv.rm_ref_no}`).toLowerCase();
      const custStr = String(inv.cust_name || "").toLowerCase();
      const phoneStr = String(inv.rm_ph_no || "").toLowerCase();
      const dateStr = inv.rm_bill_date ? String(inv.rm_bill_date).toLowerCase() : "";
      return (
        invNoStr.includes(q) ||
        custStr.includes(q) ||
        phoneStr.includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [savedInvoices, invoiceSearchTerm]);

  // Focus Highlight Class
  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:ring-2 focus:ring-amber-500 font-medium transition-colors";

  // Initial Fetch: Load Ledgers, Product GST Tax & HSN rates from DB, Available Barcodes, & Saved POS Invoices
  const fetchInitialData = useCallback(async () => {
    if (!company?.frm_code) return;
    try {
      setInvoiceTime(new Date().toLocaleTimeString());

      // 1. Fetch Customers & Suppliers (Ledgers) and Products (GST Tax Rates & HSN)
      const [cRes, prodRes] = await Promise.all([
        supabase
          .from("ledger")
          .select("ledg_code, ledg_name, ph_no, cell_no1, bal_amt, op_bal")
          .eq("frm_code", company.frm_code)
          .order("ledg_name", { ascending: true }),
        supabase
          .from("product")
          .select("ref_no, prd_code, prd_name, gst_perc, hsn_code, units, grp_code")
          .eq("frm_code", company.frm_code)
      ]);

      const ledgMap = new Map<number, string>();
      if (cRes.data) {
        setCustomers(cRes.data);
        cRes.data.forEach((l) => ledgMap.set(l.ledg_code, l.ledg_name));
      }

      const prodMap = new Map<string, any>();
      if (prodRes.data) {
        prodRes.data.forEach((p) => {
          const val = {
            refNo: p.ref_no,
            prdCode: String(p.prd_code),
            prdName: p.prd_name || `SAREES-${p.hsn_code || "50079010"}`,
            gstPerc: p.gst_perc || 5,
            hsnCode: p.hsn_code || "50079010",
            units: p.units || "NOS",
            grpCode: p.grp_code || 1,
          };
          prodMap.set(String(p.ref_no), val);
          prodMap.set(String(p.prd_code), val);
        });
      }
      setProductTaxMap(prodMap);

      // 2. Fetch Available Barcodes from bar_temp and attach exact Supplier / Vendor Name
      const { data: barData } = await supabase
        .from("bar_temp")
        .select("*, product(ref_no, prd_code, prd_name, hsn_code, units, gst_perc, grp_code)")
        .eq("frm_code", company.frm_code)
        .eq("sold_status", "A")
        .order("bar_ref_id", { ascending: true });

      if (barData) {
        const enrichedBarData = barData.map((b) => ({
          ...b,
          vendorName: b.cr_code ? ledgMap.get(b.cr_code) || "SRI KRISHNA SILKS" : "SRI KRISHNA SILKS",
        }));
        setStockItems(enrichedBarData);
        setStockBannerText(
          `C-Rate: T.TT, S-Rate: T.TT : Stock : ${barData.length} PCS`
        );
      }

      // 3. Fetch Saved Retail POS Sales Invoices for Previous / Next Navigation & F3 Search
      const { data: saleMastList } = await supabase
        .from("retail_sale_mast")
        .select("*, retail_sale_child(*, product(ref_no, prd_code, prd_name, hsn_code, units, gst_perc, grp_code))")
        .eq("rm_frm_code", company.frm_code)
        .order("rm_ref_no", { ascending: true });

      const invoices = saleMastList || [];
      setSavedInvoices(invoices);

      // Auto Invoice Number beginning at POS-000001 (based on saved POS sales count)
      if (mode === "add") {
        const nextSeq = invoices.length + 1;
        setInvoiceNo(`POS-${String(nextSeq).padStart(6, "0")}`);
      }
    } catch (e) {
      console.error("Error fetching initial POS data:", e);
    }
  }, [company?.frm_code, supabase, mode]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Focus Scan Box on Load
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Stock Selection Modal Keyboard Up/Down Arrow Navigation
  useEffect(() => {
    if (!isStockModalOpen) return;
    const handleStockModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedStockRowIndex((prev) =>
          Math.min(prev + 1, stockItems.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedStockRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (stockItems[selectedStockRowIndex]) {
          addStockItemToGrid(stockItems[selectedStockRowIndex]);
          setIsStockModalOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleStockModalKeyDown);
    return () => window.removeEventListener("keydown", handleStockModalKeyDown);
  }, [isStockModalOpen, stockItems, selectedStockRowIndex]);

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
          // Multiple matches found -> Open Stock Selection Window
          setStockItems(barRows);
          setSelectedStockRowIndex(0);
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

  // Add Item to POS Grid - Fetches Product GST tax rates & HSN code dynamically
  const addStockItemToGrid = (bar: any) => {
    const saleRateMrp = Number(bar.pc_sale_rate || bar.tag_rate || bar.product?.sales_price || 2000);
    const prcodeStr = String(bar.prcode || bar.product?.ref_no || 1);
    const taxInfo = productTaxMap.get(prcodeStr) || {
      refNo: bar.prcode || 1,
      prdCode: "101",
      prdName: bar.grp_name || "SAREES",
      gstPerc: 5,
      hsnCode: "50079010",
      units: bar.unit_name || "NOS",
      grpCode: 1,
    };
    const gstPerc = taxInfo.gstPerc || 5;
    const halfTax = gstPerc / 2;

    const newRow: POSGridRow = {
      id: `pos-item-${bar.bar_no}-${Date.now()}`,
      sno: gridRows.length + 1,
      productCode: bar.bar_no,
      batchNo: bar.bar_no,
      prcode: taxInfo.refNo || bar.prcode || 1,
      productName: taxInfo.prdName || `${bar.grp_name || "Sarees"}-${taxInfo.hsnCode}`,
      hsnCode: taxInfo.hsnCode,
      qty: 1,
      unitName: bar.unit_name || taxInfo.units || "NOS",
      gross: 1,
      mrp: saleRateMrp,
      rateUnit: saleRateMrp,
      amount: saleRateMrp,
      disPerc: 0,
      sgstPerc: halfTax,
      cgstPerc: halfTax,
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

  // Cash Discount Handlers
  const handleCashDiscPercChange = (valStr: string) => {
    const perc = Math.max(0, Number(valStr) || 0);
    setCashDiscPerc(perc);

    let rawSubTotal = 0;
    gridRows.forEach((r) => {
      const baseLine = r.qty * r.rateUnit;
      const dAmt = (baseLine * r.disPerc) / 100;
      rawSubTotal += baseLine - dAmt;
    });

    const amt = (rawSubTotal * perc) / 100;
    setCashDisc(amt);
  };

  const handleCashDiscAmountChange = (valStr: string) => {
    const amt = Math.max(0, Number(valStr) || 0);
    setCashDisc(amt);

    let rawSubTotal = 0;
    gridRows.forEach((r) => {
      const baseLine = r.qty * r.rateUnit;
      const dAmt = (baseLine * r.disPerc) / 100;
      rawSubTotal += baseLine - dAmt;
    });

    const perc = rawSubTotal > 0 ? (amt * 100) / rawSubTotal : 0;
    setCashDiscPerc(Number(perc.toFixed(2)));
  };

  // Final Received Amount Handler (Directly Editable Bill Amount to Trigger Reverse Tax Calculation)
  const handleFinalReceivedAmountChange = (valStr: string) => {
    const targetAmt = Math.max(0, Number(valStr) || 0);

    let rawSubTotal = 0;
    let originalBillAmt = 0;

    gridRows.forEach((r) => {
      const baseLine = r.qty * r.rateUnit;
      const dAmt = (baseLine * r.disPerc) / 100;
      const lineTaxableOriginal = Math.max(0, baseLine - dAmt);
      rawSubTotal += lineTaxableOriginal;

      const gstRateDecimal = (r.sgstPerc + r.cgstPerc) / 100;
      const lineTotalOriginal = lineTaxableOriginal * (1 + gstRateDecimal);
      originalBillAmt += lineTotalOriginal;
    });

    const neededDisc = Math.max(0, originalBillAmt - targetAmt);
    setCashDisc(Number(neededDisc.toFixed(2)));

    const perc = rawSubTotal > 0 ? (neededDisc * 100) / rawSubTotal : 0;
    setCashDiscPerc(Number(perc.toFixed(2)));
  };

  // Calculations Summary - Reverse Tax Calculation from Final Received / Adjusted Amount
  const totals = useMemo(() => {
    let totalQty = 0;
    let subTotal = 0;
    let totDiscAmt = 0;

    // 1. Calculate Original Taxable and Original Bill Amount before adjustment
    let originalBillAmt = 0;

    gridRows.forEach((r) => {
      totalQty += r.qty;
      const baseLine = r.qty * r.rateUnit;
      subTotal += baseLine;

      const dAmt = (baseLine * r.disPerc) / 100;
      totDiscAmt += dAmt;

      const lineTaxableOriginal = Math.max(0, baseLine - dAmt);
      const gstRateDecimal = (r.sgstPerc + r.cgstPerc) / 100;
      const lineTotalOriginal = lineTaxableOriginal * (1 + gstRateDecimal);
      originalBillAmt += lineTotalOriginal;
    });

    const totDisc = totDiscAmt + cashDisc + splDisc;
    const targetReceivedAmt = Math.max(0, originalBillAmt - totDisc);

    // Step 1: Reduction Factor = Received Amount / Original Bill Amount
    const factor = originalBillAmt > 0 ? targetReceivedAmt / originalBillAmt : 1;

    // Step 2: Apply Factor to Every Line for Reverse Tax Calculation
    let taxableAmt = 0;
    let totSgst = 0;
    let totCgst = 0;

    gridRows.forEach((r) => {
      const baseLine = r.qty * r.rateUnit;
      const dAmt = (baseLine * r.disPerc) / 100;
      const lineTaxableOriginal = Math.max(0, baseLine - dAmt);

      const revisedTaxable = lineTaxableOriginal * factor;
      taxableAmt += revisedTaxable;

      const revisedSgst = (revisedTaxable * r.sgstPerc) / 100;
      const revisedCgst = (revisedTaxable * r.cgstPerc) / 100;

      totSgst += revisedSgst;
      totCgst += revisedCgst;
    });

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
      factor,
    };
  }, [gridRows, cashDisc, splDisc, expensesAmt]);

  // Open Payment Details Modal
  const handleOpenPaymentModal = () => {
    if (gridRows.length === 0) {
      alert("Please scan at least one barcode item to create POS invoice.");
      return;
    }

    setPaymentRows([
      { type: "CASH", amount: totals.grandTotal, remarks: "" },
      { type: "CN/ADVANCE", amount: 0, remarks: "" },
      { type: "CARD", amount: 0, remarks: "" },
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

  // Confirm & Save POS Invoice with Financial Year Duplicate Check and retail_sale_mast insertion
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
      if (mode === "add") {
        const { data: existing } = await supabase
          .from("retail_sale_mast")
          .select("rm_ref_no")
          .eq("rm_frm_code", company.frm_code)
          .eq("rm_bill_ref_no", invoiceNo);

        if (existing && existing.length > 0) {
          alert(
            `Duplicate Invoice Error!\nPOS Invoice No "${invoiceNo}" already exists for this financial year. Duplicate entries are strictly prohibited.`
          );
          setLoading(false);
          return;
        }
      }

      // 1. Save or Update retail_sale_mast
      const mastPayload: any = {
        rm_frm_code: company.frm_code,
        rm_rec_no: mode === "edit" && currentIndex >= 0 && savedInvoices[currentIndex] ? (savedInvoices[currentIndex].rm_rec_no || currentIndex + 1) : (savedInvoices.length + 1),
        rm_bill_ref_no: invoiceNo,
        rm_bill_date: invoiceDate,
        cust_name: customerName || "Cash Customer",
        rm_ph_no: customerMobile || "",
        state: customerState || "Tamil Nadu",
        state_code: customerStateCode || "33",
        gstin: customerGstNo || "",
        city: customerAddress || "",
        rm_tot_qty: totals.totalQty,
        rm_bf_gst_amt: totals.taxableAmt,
        rm_cgst_amt: totals.totCgst,
        rm_sgst_amt: totals.totSgst,
        rm_igst_amt: 0,
        rm_grd_tot: totals.grandTotal,
        rm_rnd_off: totals.roundOff,
        rm_net_total: totals.grandTotal,
        reg_code: 50,
        rm_cr_code: 1,
        rm_mode_one: paymentRows[0]?.type || "CASH",
        rm_dr_code_one: 1,
        rm_recd_one_amt: paymentRows[0]?.amount || totals.grandTotal,
        rm_mode_two: paymentRows[1]?.type || "",
        rm_dr_code_two: 0,
        rm_recd_two_amt: paymentRows[1]?.amount || 0,
      };

      let rmRefNo: number;

      if (mode === "edit" && currentIndex >= 0 && savedInvoices[currentIndex]?.rm_ref_no) {
        rmRefNo = savedInvoices[currentIndex].rm_ref_no;
        await supabase.from("retail_sale_mast").update(mastPayload).eq("rm_ref_no", rmRefNo);
        await supabase.from("retail_sale_child").delete().eq("rm_ref_no", rmRefNo);
      } else {
        const { data: newMast, error: mErr } = await supabase
          .from("retail_sale_mast")
          .insert([mastPayload])
          .select("rm_ref_no")
          .single();
        if (mErr) throw mErr;
        rmRefNo = newMast.rm_ref_no;
      }

      // 2. Insert into retail_sale_child (strictly matching database schema)
      const childPayload = gridRows.map((r) => {
        const prdInfo = productTaxMap.get(String(r.prcode));
        return {
          rm_ref_no: rmRefNo,
          dc_bar_no: r.productCode || r.batchNo,
          dc_prcode: prdInfo?.refNo || (typeof r.prcode === "number" ? r.prcode : 1),
          dc_pgrcode: prdInfo?.grpCode || 1,
          dc_qty: r.qty,
          dc_rate: r.rateUnit,
          dc_net_tot: r.amount,
          dc_cgst_perc: r.cgstPerc,
          dc_cgst_amnt: Number(((r.amount * r.cgstPerc) / 100).toFixed(2)),
          dc_sgst_perc: r.sgstPerc,
          dc_sgst_amnt: Number(((r.amount * r.sgstPerc) / 100).toFixed(2)),
          dc_igst_perc: r.igstPerc || 0,
          dc_igst_amnt: 0,
          frm_code: company.frm_code,
        };
      });

      if (childPayload.length > 0) {
        const { error: cErr } = await supabase.from("retail_sale_child").insert(childPayload);
        if (cErr) throw cErr;
      }

      // 3. Mark barcode records sold ('S') in bar_temp
      const barcodeList = gridRows.map((r) => r.productCode).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({
            sold_status: "S",
            inv_date: invoiceDate,
            margin: Number(cashDisc.toFixed(2)),
          })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      const msg = `Invoice Saved Successfully!\nPOS Bill No #${invoiceNo} for ₹${totals.grandTotal.toLocaleString("en-IN")}`;
      setSaveSuccess(msg);
      alert(msg);

      setIsPaymentModalOpen(false);
      fetchInitialData();

      // Trigger Thermal Receipt Printing
      handlePrintReceipt();

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

  // Delete POS Invoice Record (Delete [F9])
  const handleDeleteInvoice = async () => {
    if (!company?.frm_code) return;

    if (mode !== "edit" || currentIndex < 0 || !savedInvoices[currentIndex]) {
      alert("Delete is only available when viewing an existing saved POS invoice record.");
      return;
    }

    const currentInv = savedInvoices[currentIndex];
    const delInvNo = currentInv.rm_bill_ref_no || invoiceNo;

    if (!confirm(`Are you sure you want to delete POS Invoice ${delInvNo}?`)) {
      return;
    }

    setLoading(true);
    try {
      const barcodeList = gridRows.map((r) => r.productCode).filter(Boolean);
      if (barcodeList.length > 0) {
        // Return sold items back to Available stock ('A')
        await supabase
          .from("bar_temp")
          .update({
            sold_status: "A",
          })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      if (currentInv.rm_ref_no) {
        await supabase.from("retail_sale_child").delete().eq("rm_ref_no", currentInv.rm_ref_no);
        await supabase.from("retail_sale_mast").delete().eq("rm_ref_no", currentInv.rm_ref_no);
      }

      alert(`POS Invoice ${delInvNo} deleted successfully and items returned to stock!`);
      handleResetForm();
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Failed to delete POS Invoice: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Thermal Receipt Printing for TVS RP 4200 (5-inch / 80mm printer) with Auto Cutter
  const handlePrintReceipt = () => {
    if (gridRows.length === 0) {
      alert("Please add at least one item to print thermal receipt.");
      return;
    }

    const printWin = window.open("", "_blank", "width=480,height=700");
    if (!printWin) return;

    const amountInWords = numberToWords(totals.grandTotal);

    const itemsHtml = gridRows
      .map((r) => {
        const baseLine = r.qty * r.rateUnit;
        const dAmt = (baseLine * r.disPerc) / 100;
        const lineTaxableOriginal = Math.max(0, baseLine - dAmt);
        const revisedTaxable = lineTaxableOriginal * totals.factor;
        const netRate = r.qty > 0 ? revisedTaxable / r.qty : r.rateUnit;
        const saleRateMrp = r.mrp || r.rateUnit;
        return `
          <tr>
            <td style="padding: 2px 0; font-weight: bold; width: 42%; text-align: left;">${r.productName}</td>
            <td style="text-align: right; padding: 2px 0; width: 12%;">${r.qty.toFixed(2)}</td>
            <td style="text-align: center; padding: 2px 0; width: 12%;">${r.unitName}</td>
            <td style="text-align: right; padding: 2px 0; width: 17%;">${saleRateMrp.toFixed(2)}</td>
            <td style="text-align: right; padding: 2px 0; font-weight: bold; width: 17%;">${netRate.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    const paymentRowsHtml = paymentRows
      .filter((p) => p.amount > 0)
      .map(
        (p) => `
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px;">
          <span>${p.type}</span>
          <span>${p.amount.toFixed(2)}</span>
        </div>
      `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>POS Tax Invoice - ${invoiceNo}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            @media print {
              html, body {
                width: 80mm;
                margin: 0;
                padding: 0;
              }
              .no-print { display: none; }
              page-break-after: always;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.3;
              width: 76mm;
              margin: 0 auto;
              padding: 4mm 2mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #000; }
            .border-bottom { border-bottom: 1px dashed #000; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${company?.frm_name || "KANNAN SILKS"}</div>
            <div>No 2/40, Raja Veethi Road</div>
            <div>Chinthamaniur, Omalur Via</div>
            <div>Salem (Dt)-636455</div>
            <div>Ph: 9787738094</div>
            <div>Email: kannnanhandloom@gmail.com</div>
            <div class="bold" style="margin-top: 6px; font-size: 13px; text-decoration: underline;">Tax Invoice</div>
          </div>

          <div class="border-top border-bottom" style="font-size: 10px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span>No: <b>${invoiceNo}</b></span>
              <span>Counter No: 0</span>
              <span>Branch: Main</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Date: ${invoiceDate}</span>
              <span>Time: ${invoiceTime}</span>
              <span>User: admin</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 44%;">PARTICULARS/HSN</th>
                <th style="text-align: right; width: 14%;">QTY</th>
                <th style="text-align: center; width: 12%;">UNIT</th>
                <th style="text-align: right; width: 15%;">SALE RATE</th>
                <th style="text-align: right; width: 15%;">NET RATE</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="border-top" style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Total Discount: ${totals.totDisc.toFixed(2)}</span>
            <span>Total Amount: ${totals.subTotal.toFixed(2)}</span>
          </div>

          <div style="margin-top: 6px; font-size: 15px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 4px;">
            Total Bill Amount : ₹ ${totals.grandTotal.toFixed(2)}
          </div>

          <div style="margin-top: 4px; font-size: 9px; font-style: italic;">
            Amount in Words: INR ${amountInWords}
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 4px; font-weight: bold; font-size: 10px;">
            <span>Total Items: ${gridRows.length}</span>
            <span>Total Qty: ${totals.totalQty.toFixed(2)} Nos</span>
          </div>

          <div class="border-top text-center bold" style="margin-top: 6px; font-size: 11px;">
            --- PAYMENT SUMMARY ---
          </div>
          ${paymentRowsHtml}
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; border-top: 1px dashed #000; padding-top: 2px;">
            <span>Tendered</span>
            <span>${totals.grandTotal.toFixed(2)}</span>
          </div>

          <div class="border-top text-center bold" style="margin-top: 6px; font-size: 11px;">
            --- Details of Gst Tax ---
          </div>
          <table>
            <thead>
              <tr>
                <th>Taxable</th>
                <th style="text-align: right;">CGST%</th>
                <th style="text-align: right;">Amt</th>
                <th style="text-align: right;">SGST%</th>
                <th style="text-align: right;">Amt</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${totals.taxableAmt.toFixed(2)}</td>
                <td style="text-align: right;">2.50%</td>
                <td style="text-align: right;">${totals.totSgst.toFixed(2)}</td>
                <td style="text-align: right;">2.50%</td>
                <td style="text-align: right;">${totals.totCgst.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px;">
            <span>Total Tax</span>
            <span>${totals.totalTax.toFixed(2)}</span>
          </div>

          <div class="border-top text-center bold" style="margin-top: 10px; font-size: 10px;">
            <div>FIXED RATE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; NO RETURN</div>
            <div style="margin-top: 4px;">Thank You! Visit Again</div>
          </div>

          <!-- ESC/POS TVS RP 4200 Auto-Cutter Trigger -->
          <div style="visibility: hidden; page-break-after: always;">\x1D\x56\x00</div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Load Saved Invoice for Prev / Next Navigation and F3 Search
  const loadSavedInvoiceRecord = async (invRecord: any) => {
    if (!invRecord || !company?.frm_code) return;
    setLoading(true);
    try {
      let invMast = invRecord;
      let childItems = invMast.retail_sale_child;

      if (!childItems || childItems.length === 0) {
        const { data: childData } = await supabase
          .from("retail_sale_child")
          .select("*, product(ref_no, prd_code, prd_name, hsn_code, units, gst_perc, grp_code)")
          .eq("rm_ref_no", invMast.rm_ref_no)
          .order("dc_ref_no", { ascending: true });
        childItems = childData || [];
      }

      // If child items still empty, check bar_temp for items matching this invoice
      if (childItems.length === 0) {
        const { data: barFallback } = await supabase
          .from("bar_temp")
          .select("*, product(ref_no, prd_code, prd_name, hsn_code, units, gst_perc, grp_code)")
          .eq("frm_code", company.frm_code)
          .eq("sold_status", "S")
          .order("bar_ref_id", { ascending: true });

        if (barFallback && barFallback.length > 0) {
          childItems = barFallback.slice(0, Math.max(1, Math.floor(invMast.rm_tot_qty || 1))).map((b) => ({
            dc_bar_no: b.bar_no,
            dc_prcode: b.prcode || b.product?.ref_no || 1,
            dc_pgrcode: b.product?.grp_code || 1,
            dc_qty: b.qty || 1,
            dc_rate: b.pc_sale_rate || b.product?.sales_price || 2000,
            dc_net_tot: (b.qty || 1) * (b.pc_sale_rate || 2000),
            dc_cgst_perc: 2.5,
            dc_sgst_perc: 2.5,
            product: b.product
          }));
        }
      }

      const loadedRows: POSGridRow[] = (childItems || []).map((c: any, idx: number) => {
        const prd = c.product;
        const prcodeStr = String(c.dc_prcode || prd?.ref_no || 1);
        const taxInfo = productTaxMap.get(prcodeStr) || {
          refNo: c.dc_prcode || 1,
          prdCode: prd?.prd_code || "101",
          prdName: prd?.prd_name || "SAREES-50079010",
          gstPerc: 5,
          hsnCode: prd?.hsn_code || "50079010",
          units: prd?.units || "NOS",
          grpCode: prd?.grp_code || 1,
        };

        const halfTax = Number(c.dc_cgst_perc || taxInfo.gstPerc / 2 || 2.5);
        const qty = Number(c.dc_qty || 1);
        const rate = Number(c.dc_rate || 0);
        const amt = Number(c.dc_net_tot || (qty * rate));
        const prdName = prd?.prd_name || taxInfo.prdName || `SAREES-${taxInfo.hsnCode}`;

        return {
          id: `pos-saved-${c.dc_bar_no || idx}-${idx}`,
          sno: idx + 1,
          productCode: c.dc_bar_no || "",
          batchNo: c.dc_bar_no || "",
          prcode: taxInfo.refNo || c.dc_prcode || 1,
          productName: prdName,
          hsnCode: taxInfo.hsnCode,
          qty: qty,
          unitName: prd?.units || taxInfo.units || "NOS",
          gross: 1,
          mrp: rate,
          rateUnit: rate,
          amount: amt,
          disPerc: 0,
          sgstPerc: c.dc_sgst_perc || halfTax,
          cgstPerc: c.dc_cgst_perc || halfTax,
          igstPerc: c.dc_igst_perc || 0,
          isBatchItem: false,
          maxStockQty: qty,
        };
      });

      setInvoiceNo(invMast.rm_bill_ref_no || `POS-${String(invMast.rm_ref_no).padStart(6, "0")}`);
      setInvoiceDate(
        invMast.rm_bill_date
          ? new Date(invMast.rm_bill_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setCustomerName(invMast.cust_name || "Cash Customer");
      setCustomerMobile(invMast.rm_ph_no || "");
      setCustomerAddress(invMast.city || "");
      setCustomerGstNo(invMast.gstin || "");
      setCustomerState(invMast.state || "Tamil Nadu");
      setCustomerStateCode(invMast.state_code || "33");
      setGridRows(loadedRows);
      setMode("edit");
    } catch (e: any) {
      console.error("Error loading saved POS invoice:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevInvoice = () => {
    if (savedInvoices.length === 0) {
      alert("No saved Retail POS Sales invoices found.");
      return;
    }
    const newIdx = currentIndex <= 0 ? savedInvoices.length - 1 : currentIndex - 1;
    setCurrentIndex(newIdx);
    loadSavedInvoiceRecord(savedInvoices[newIdx]);
  };

  const handleNextInvoice = () => {
    if (savedInvoices.length === 0) {
      alert("No saved Retail POS Sales invoices found.");
      return;
    }
    const newIdx = currentIndex >= savedInvoices.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIdx);
    loadSavedInvoiceRecord(savedInvoices[newIdx]);
  };

  // Reset Form
  const handleResetForm = () => {
    setMode("add");
    setCurrentIndex(-1);
    setGridRows([]);
    setCashDiscPerc(0);
    setCashDisc(0);
    setSplDisc(0);
    setExpensesAmt(0);
    setRemarks("");
    setScanInput("");
    setCustomerName("Cash Customer");
    setCustomerMobile("");
    setCustomerAddress("");
    setCustomerGstNo("");
    setCustomerState("Tamil Nadu");
    setCustomerStateCode("33");
    setCustomerEmail("");
    fetchInitialData();
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // Keyboard Shortcuts Listener (F12 Print, F3 Invoice Search, F5 Stock Select)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStockModalOpen(false);
        setIsPaymentModalOpen(false);
        setIsCustomerModalOpen(false);
        setIsInvoiceSearchModalOpen(false);
      } else if (e.key === "Insert") {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (mode === "edit") {
          handleOpenPaymentModal();
        } else {
          alert("Edit mode is active when viewing a saved invoice record (via Prev/Next/Search).");
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        setSelectedInvoiceRowIndex(0);
        setIsInvoiceSearchModalOpen(true);
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
        setIsCustomerModalOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (!isPaymentModalOpen) handleOpenPaymentModal();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (mode === "edit") handleDeleteInvoice();
      } else if (e.key === "F10") {
        e.preventDefault();
        if (isPaymentModalOpen) {
          handleFinalSaveInvoice();
        } else {
          handleOpenPaymentModal();
        }
      } else if (e.key === "F12") {
        e.preventDefault();
        handlePrintReceipt();
      } else if (e.key === "PageUp") {
        e.preventDefault();
        handlePrevInvoice();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        handleNextInvoice();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridRows, totals.grandTotal, isPaymentModalOpen, isStockModalOpen, isInvoiceSearchModalOpen, stockItems, selectedStockRowIndex, savedInvoices, currentIndex, mode]);

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-900 p-1.5 space-y-1.5 font-sans text-xs">
      {/* Top POS Header Bar */}
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

      {/* Step 1 & 2: Top Scan Input Bar & Stock Indicator */}
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
                onClick={() => {
                  setSelectedStockRowIndex(0);
                  setIsStockModalOpen(true);
                }}
              >
                Select [F5]
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-slate-200 text-slate-800 border hover:bg-slate-300 font-bold px-3"
                onClick={() => {
                  setSelectedInvoiceRowIndex(0);
                  setIsInvoiceSearchModalOpen(true);
                }}
              >
                Search [F3]
              </Button>
            </div>
          </div>
        </div>

        {/* Stock Banner Summary Line */}
        <div className="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-200 px-3 py-1 rounded text-[11px] font-mono font-bold flex justify-between">
          <span>{stockBannerText}</span>
          <span>Shift+F7: Change Product Name</span>
        </div>
      </div>

      {/* STEP 3 & MAIN LAYOUT: GRID TABLE & VOUCHER DETAILS PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
        {/* Main Grid Table */}
        <div className="lg:col-span-3 space-y-1.5">
          <Card className="shadow-sm border overflow-hidden">
            <div className="overflow-x-auto min-h-[340px] max-h-[480px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border-b border-slate-300">
                  <TableRow>
                    <TableHead className="w-6 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-8 text-center p-1 font-bold">S...</TableHead>
                    <TableHead className="w-20 p-1 font-bold">Product Code</TableHead>
                    <TableHead className="min-w-[150px] p-1 font-bold">Product Name [Shift+F7]</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-16 text-center p-1 font-bold">Unit Name</TableHead>
                    <TableHead className="w-28 text-right p-1 font-bold text-amber-800 dark:text-amber-300">Sale Rate (MRP)</TableHead>
                    <TableHead className="w-24 text-right p-1 font-bold">Rate/Unit</TableHead>
                    <TableHead className="w-24 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Dis %</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">SGST</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">CGST</TableHead>
                    <TableHead className="w-28 text-right p-1 font-bold text-lime-700 dark:text-lime-400">Net Amount</TableHead>
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
                    gridRows.map((row, idx) => {
                      const baseLine = row.qty * row.rateUnit;
                      const dAmt = (baseLine * row.disPerc) / 100;
                      const lineTaxableOriginal = Math.max(0, baseLine - dAmt);
                      const lineTaxableRevised = lineTaxableOriginal * totals.factor;
                      const lineGst = (lineTaxableRevised * (row.sgstPerc + row.cgstPerc)) / 100;
                      const lineNetAmt = lineTaxableRevised + lineGst;

                      return (
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
                          <TableCell className="p-1 text-right">
                            <Input
                              type="number"
                              value={row.qty}
                              onChange={(e) => handleCellChange(idx, "qty", e.target.value)}
                              className={`h-7 w-12 text-xs text-right bg-white font-bold px-1 inline-block border border-slate-300 ${focusHighlightClass}`}
                            />
                          </TableCell>
                          <TableCell className="p-1 text-center font-bold text-slate-700">
                            {row.unitName}
                          </TableCell>
                          <TableCell className="p-1 text-right font-black text-amber-800 dark:text-amber-300 w-28">
                            {row.mrp.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-1 text-right font-bold">
                            <Input
                              type="number"
                              value={row.rateUnit}
                              onChange={(e) => handleCellChange(idx, "rateUnit", e.target.value)}
                              className={`h-7 w-20 text-xs text-right bg-white font-bold px-2 inline-block border border-slate-300 ${focusHighlightClass}`}
                            />
                          </TableCell>
                          <TableCell className="p-1 text-right font-bold text-slate-900 dark:text-white">
                            {row.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-1 text-right">{row.disPerc}</TableCell>
                          <TableCell className="p-1 text-right font-bold text-slate-600">
                            {row.sgstPerc.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-1 text-right font-bold text-slate-600">
                            {row.cgstPerc.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-1 text-right font-black text-lime-700 dark:text-lime-300 w-28">
                            {lineNetAmt.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Grid Summary Footer Line */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 flex items-center justify-between font-mono font-bold text-xs border-t">
              <span className="w-8 text-center">{gridRows.length}</span>
              <div className="flex gap-6 text-right">
                <span className="w-12">{totals.totalQty.toFixed(2)}</span>
                <span className="w-24 text-slate-900 dark:text-white">
                  {totals.subTotal.toFixed(2)}
                </span>
                <span className="w-28 text-lime-700 dark:text-lime-400 font-black">
                  {totals.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side Voucher Details Panel */}
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
                    className="h-6 text-xs text-right w-24 bg-white font-bold"
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

                {/* CASH DISCOUNT TWO TEXTBOXES */}
                <div className="flex justify-between items-center gap-1">
                  <span className="text-slate-600 font-bold text-[11px]">Cash Disc.</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={cashDiscPerc !== 0 ? cashDiscPerc : ""}
                      onChange={(e) => handleCashDiscPercChange(e.target.value)}
                      onBlur={() => {
                        if (cashDiscPerc) setCashDiscPerc(Number(cashDiscPerc.toFixed(2)));
                      }}
                      placeholder="0.00"
                      className="h-5 text-xs text-right w-14 bg-white px-1 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Discount Percentage (%)"
                    />
                    <span className="text-[10px] font-bold text-slate-500">%</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={cashDisc !== 0 ? cashDisc : ""}
                      onChange={(e) => handleCashDiscAmountChange(e.target.value)}
                      onBlur={() => {
                        if (cashDisc) setCashDisc(Number(cashDisc.toFixed(2)));
                      }}
                      placeholder="0.00"
                      className="h-5 text-xs text-right w-20 bg-white px-1 font-bold text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Discount Amount (₹)"
                    />
                  </div>
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

              {/* EDITABLE BIG BRIGHT GREEN FINAL RECEIVED AMOUNT BOX */}
              <div className="bg-lime-500 text-slate-950 p-2 rounded border-2 border-lime-600 shadow-inner mt-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-950">
                  <span>Net Received</span>
                  <span>₹</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={totals.grandTotal !== 0 ? totals.grandTotal : ""}
                  onChange={(e) => handleFinalReceivedAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-2xl font-black font-mono text-right bg-white text-slate-950 border-2 border-lime-700 shadow focus:ring-2 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  title="Edit Final Received Amount to trigger Reverse Tax Calculation"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BOTTOM CUSTOMER DETAILS BAR */}
      <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded border flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">Mobile [F6]</span>
            <Input
              id="pos-cust-mobile"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-xs w-28 bg-white cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">Customer [F6]</span>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-xs w-32 bg-white font-bold cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">GSTIN</span>
            <Input
              value={customerGstNo}
              onChange={(e) => setCustomerGstNo(e.target.value)}
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-xs w-32 bg-white font-mono uppercase cursor-pointer"
              placeholder="GST No"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600">State</span>
            <Input
              value={customerState}
              onChange={(e) => setCustomerState(e.target.value)}
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-xs w-24 bg-white cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BUTTONS TOOLBAR (Added Print F12 Button for TVS RP 4200 Thermal Receipt Printer) */}
      <div className="bg-white dark:bg-slate-800 p-1.5 rounded border flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 font-bold border"
            onClick={handleResetForm}
          >
            New [F4]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold border shadow px-3"
            onClick={() => {
              if (mode === "edit") {
                handleOpenPaymentModal();
              } else {
                alert("Edit mode is active when viewing a saved invoice record (via Prev/Next).");
              }
            }}
          >
            Edit [F2]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-amber-600 text-white hover:bg-amber-700 font-bold border shadow"
            onClick={handleOpenPaymentModal}
          >
            Payment Details [F8]
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs font-bold border px-3"
            onClick={handleDeleteInvoice}
            disabled={mode !== "edit"}
          >
            Delete [F9]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold border shadow"
            onClick={handlePrintReceipt}
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print [F12]
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-red-600 font-bold border px-3"
            onClick={handleResetForm}
          >
            Cancel [Esc]
          </Button>
        </div>

        <div className="flex items-center gap-1.5 font-bold">
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 border"
            onClick={handlePrevInvoice}
          >
            Previous [Pg Up]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 border"
            onClick={handleNextInvoice}
          >
            Next [Pg Down]
          </Button>
        </div>
      </div>

      {/* RETAIL POS SALES INVOICE LOOKUP MODAL [F3] */}
      <Dialog open={isInvoiceSearchModalOpen} onOpenChange={setIsInvoiceSearchModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] p-0 border">
          <div className="bg-lime-600 text-white px-3 py-2 font-bold text-xs flex justify-between items-center shadow-sm">
            <span className="text-sm font-bold flex items-center gap-2">
              <span>🔍</span> Search Retail POS Sales Invoices [F3]
            </span>
            <span className="text-xs bg-lime-700/80 px-2 py-0.5 rounded font-mono">
              {filteredInvoices.length} Invoices Found
            </span>
          </div>

          <div className="p-3 space-y-2">
            <Input
              value={invoiceSearchTerm}
              onChange={(e) => {
                setInvoiceSearchTerm(e.target.value);
                setSelectedInvoiceRowIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredInvoices[selectedInvoiceRowIndex]) {
                    const selected = filteredInvoices[selectedInvoiceRowIndex];
                    const originalIdx = savedInvoices.findIndex(
                      (s) => s.rm_ref_no === selected.rm_ref_no
                    );
                    setCurrentIndex(originalIdx >= 0 ? originalIdx : 0);
                    loadSavedInvoiceRecord(selected);
                    setIsInvoiceSearchModalOpen(false);
                  }
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedInvoiceRowIndex((prev) =>
                    Math.min(prev + 1, filteredInvoices.length - 1)
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedInvoiceRowIndex((prev) => Math.max(prev - 1, 0));
                }
              }}
              placeholder="Search by Invoice No (e.g. POS-000001), Customer Name, Phone, Date..."
              className="h-8 text-xs bg-background font-medium"
              autoFocus
            />

            <div className="overflow-y-auto max-h-[380px] border rounded">
              <Table className="w-full text-xs border-collapse font-mono">
                <TableHeader className="bg-slate-100 dark:bg-slate-800 font-bold sticky top-0 border-b">
                  <TableRow>
                    <TableHead className="w-10 text-center p-1 font-bold">SNo</TableHead>
                    <TableHead className="w-28 p-1 font-bold">Invoice No</TableHead>
                    <TableHead className="w-24 text-center p-1 font-bold">Date</TableHead>
                    <TableHead className="p-1 font-bold min-w-[160px]">Customer Name</TableHead>
                    <TableHead className="w-28 p-1 font-bold">Phone</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-24 text-right p-1 font-bold">Taxable Amt</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Tax</TableHead>
                    <TableHead className="w-24 text-right p-1 font-bold text-emerald-700 dark:text-emerald-400">Net Amount</TableHead>
                    <TableHead className="w-20 text-center p-1 font-bold">Pay Mode</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs">
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No Retail POS Sales invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv, idx) => {
                      const isSelected = selectedInvoiceRowIndex === idx;
                      const invDateFormatted = inv.rm_bill_date
                        ? new Date(inv.rm_bill_date).toISOString().split("T")[0]
                        : "-";
                      const totTax = (inv.rm_cgst_amt || 0) + (inv.rm_sgst_amt || 0) + (inv.rm_igst_amt || 0);

                      return (
                        <TableRow
                          key={inv.rm_ref_no || idx}
                          ref={(el) => {
                            invoiceRowRefs.current[idx] = el;
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-lime-100 dark:bg-lime-950/60 text-slate-950 dark:text-lime-100 font-bold border-2 border-lime-500"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedInvoiceRowIndex(idx)}
                          onDoubleClick={() => {
                            const originalIdx = savedInvoices.findIndex(
                              (s) => s.rm_ref_no === inv.rm_ref_no
                            );
                            setCurrentIndex(originalIdx >= 0 ? originalIdx : 0);
                            loadSavedInvoiceRecord(inv);
                            setIsInvoiceSearchModalOpen(false);
                          }}
                        >
                          <TableCell className="text-center p-1">{idx + 1}</TableCell>
                          <TableCell className="p-1 font-bold text-lime-700 dark:text-lime-400">
                            {inv.rm_bill_ref_no || `POS-${inv.rm_ref_no}`}
                          </TableCell>
                          <TableCell className="text-center p-1">{invDateFormatted}</TableCell>
                          <TableCell className="p-1 font-semibold">{inv.cust_name || "Cash Customer"}</TableCell>
                          <TableCell className="p-1">{inv.rm_ph_no || "-"}</TableCell>
                          <TableCell className="text-right p-1 font-bold">{(inv.rm_tot_qty || 1).toFixed(2)}</TableCell>
                          <TableCell className="text-right p-1">₹{(inv.rm_bf_gst_amt || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right p-1">₹{totTax.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400 p-1">
                            ₹{(inv.rm_net_total || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center p-1 font-bold">{inv.rm_mode_one || "CASH"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-2 border-t flex justify-between items-center text-xs font-mono font-bold">
            <span className="text-[11px] text-muted-foreground">
              (Use Up/Down Arrow keys to navigate, Double-click or Press Enter to load invoice)
            </span>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-lime-600 hover:bg-lime-700 text-white font-bold px-4 shadow"
                onClick={() => {
                  if (filteredInvoices[selectedInvoiceRowIndex]) {
                    const selected = filteredInvoices[selectedInvoiceRowIndex];
                    const originalIdx = savedInvoices.findIndex(
                      (s) => s.rm_ref_no === selected.rm_ref_no
                    );
                    setCurrentIndex(originalIdx >= 0 ? originalIdx : 0);
                    loadSavedInvoiceRecord(selected);
                    setIsInvoiceSearchModalOpen(false);
                  }
                }}
              >
                Load Invoice [Enter]
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-red-600 font-bold px-4"
                onClick={() => setIsInvoiceSearchModalOpen(false)}
              >
                Cancel [Esc]
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOCK SELECTION POPUP MODAL */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] p-0 border">
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
                  <TableHead className="w-14 text-right p-1 font-bold">MarkUp</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold">Sale Rate</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold">Purchase Qty</TableHead>
                  <TableHead className="w-24 text-center p-1 font-bold">Date</TableHead>
                  <TableHead className="w-16 text-center p-1 font-bold">Doc No</TableHead>
                  <TableHead className="p-1 font-bold min-w-[200px]">Account Name / Supplier</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {stockItems.map((b, idx) => {
                  const isSelected = selectedStockRowIndex === idx;
                  return (
                    <TableRow
                      key={b.bar_no}
                      ref={(el) => {
                        stockRowRefs.current[idx] = el;
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-yellow-200 text-slate-950 font-bold border-2 border-amber-500 shadow-inner"
                          : "hover:bg-amber-50"
                      }`}
                      onClick={() => setSelectedStockRowIndex(idx)}
                      onDoubleClick={() => {
                        addStockItemToGrid(b);
                        setIsStockModalOpen(false);
                      }}
                    >
                      <TableCell className="text-center p-1">{idx + 1}</TableCell>
                      <TableCell className="p-1 font-bold text-amber-900">{b.bar_no}</TableCell>
                      <TableCell className="text-right p-1 font-bold">{b.qty || 1}</TableCell>
                      <TableCell className="text-right p-1">{(b.pc_pur_rate || 1200).toFixed(2)}</TableCell>
                      <TableCell className="text-right p-1">{(b.cost_rate || 1200).toFixed(2)}</TableCell>
                      <TableCell className="text-right p-1">100.00</TableCell>
                      <TableCell className="text-right p-1 font-bold text-emerald-700">
                        {(b.pc_sale_rate || 1500).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right p-1">1.00</TableCell>
                      <TableCell className="text-center p-1">24-01-2019</TableCell>
                      <TableCell className="text-center p-1">123</TableCell>
                      <TableCell className="p-1 font-bold text-slate-800 dark:text-slate-100 min-w-[200px]">
                        {b.vendorName || "SRI KRISHNA SILKS"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-100 p-2 border-t flex justify-between items-center text-xs font-mono font-bold">
            <div className="flex gap-2 items-center">
              <span className="bg-white border px-3 py-1 rounded text-slate-900 font-bold">
                {stockItems.length}
              </span>
              <span className="text-[11px] text-slate-500">
                (Use Up/Down Arrow keys to highlight row, Enter or Proceed [F5] to add)
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 shadow"
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

      {/* PAYMENT DETAILS MODAL */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-2xl p-0 border">
          <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Payment Details [F8]</span>
          </div>

          <div className="p-3 space-y-2">
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
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 shadow"
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

      {/* CASH SALE CUSTOMER DETAILS MODAL [F6] */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-md p-0 border">
          <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Cash Sale Customer Details [F6]</span>
          </div>

          <div className="p-3 space-y-2 text-xs font-sans">
            <div>
              <Label className="text-[11px] font-bold text-slate-700">Customer Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cash Customer / Sumit"
                className="h-7 text-xs bg-white font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-bold text-slate-700">Mobile No</Label>
                <Input
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="9876543210"
                  className="h-7 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-700">E-Mail ID</Label>
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="h-7 text-xs bg-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-bold text-slate-700">Address</Label>
              <Input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Door No, Street Name, City"
                className="h-7 text-xs bg-white"
              />
            </div>

            <div>
              <Label className="text-[11px] font-bold text-slate-700">GSTIN No</Label>
              <Input
                value={customerGstNo}
                onChange={(e) => setCustomerGstNo(e.target.value.toUpperCase())}
                placeholder="33AAAAA0000A1Z5"
                className="h-7 text-xs bg-white uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-bold text-slate-700">State</Label>
                <Input
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  placeholder="Tamil Nadu"
                  className="h-7 text-xs bg-white font-bold"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-700">State Code</Label>
                <Input
                  value={customerStateCode}
                  onChange={(e) => setCustomerStateCode(e.target.value)}
                  placeholder="33"
                  className="h-7 text-xs bg-white font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-100 p-2 border-t flex justify-end gap-2 text-xs font-bold">
            <Button
              size="sm"
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 shadow"
              onClick={() => setIsCustomerModalOpen(false)}
            >
              Save Customer Details [Enter]
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 font-bold px-4"
              onClick={() => setIsCustomerModalOpen(false)}
            >
              Cancel [Esc]
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
