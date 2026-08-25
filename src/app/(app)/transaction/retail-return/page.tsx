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
  Search,
  CheckCircle2,
  Printer,
  RotateCcw,
  PackageX,
} from "lucide-react";

interface POSReturnGridRow {
  id: string;
  sno: number;
  productCode: string;
  batchNo: string;
  prcode: number;
  productName: string;
  hsnCode: string;
  invoiceDetails: string;
  qty: number;
  unitName: string;
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

// Convert numbers to words for thermal return invoice print
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

export default function RetailPOSSalesReturnPage() {
  const router = useRouter();
  const { company } = useApp();
  const supabase = createClient();

  // Mode & Loading
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Top Bar Info
  const [scanInput, setScanInput] = useState<string>("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Voucher Details Panel - POS-SR-000001 6-digit zero padded
  const [returnInvoiceNo, setReturnInvoiceNo] = useState<string>("POS-SR-000001");
  const [returnInvoiceTime, setReturnInvoiceTime] = useState<string>("10:59:28");
  const [returnInvoiceDate, setReturnInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [salesman, setSalesman] = useState<string>("Direct");
  const [cashDiscPerc, setCashDiscPerc] = useState<number>(0);
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [expensesAmt, setExpensesAmt] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Customer Details & Modal [F6]
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Cash Customer");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerGstNo, setCustomerGstNo] = useState<string>("");
  const [customerState, setCustomerState] = useState<string>("Tamil Nadu");
  const [customerStateCode, setCustomerStateCode] = useState<string>("33");
  const [customerEmail, setCustomerEmail] = useState<string>("");

  // DB Maps & Lists
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [savedReturnInvoices, setSavedReturnInvoices] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [productTaxMap, setProductTaxMap] = useState<Map<string, { gstPerc: number; hsnCode: string }>>(new Map());

  // Main POS Return Grid Rows
  const [gridRows, setGridRows] = useState<POSReturnGridRow[]>([]);

  // Modals
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const [selectedStockRowIndex, setSelectedStockRowIndex] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { type: "CASH", amount: 0, remarks: "" },
    { type: "CN/ADVANCE", amount: 0, remarks: "" },
    { type: "CARD", amount: 0, remarks: "" },
    { type: "UPI / QR CODE", amount: 0, remarks: "" },
  ]);

  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold transition-colors";

  // Fetch initial data: Products tax map & Next POS Return Sequence
  const fetchInitialData = useCallback(async () => {
    if (!company?.frm_code) return;
    try {
      // 1. Fetch Product Tax Map
      const { data: prdData } = await supabase
        .from("product")
        .select("prd_code, gst_perc, hsn_code")
        .eq("frm_code", company.frm_code);

      const map = new Map<string, { gstPerc: number; hsnCode: string }>();
      if (prdData) {
        prdData.forEach((p) => {
          map.set(String(p.prd_code), {
            gstPerc: Number(p.gst_perc) || 5,
            hsnCode: p.hsn_code || "50079010",
          });
        });
      }
      setProductTaxMap(map);

      // 2. Fetch distinct saved return invoice numbers (POS-SR-%) from category
      const { data: retRows } = await supabase
        .from("bar_temp")
        .select("category")
        .eq("frm_code", company.frm_code)
        .ilike("category", "POS-SR-%");

      const distinctInvoices = Array.from(
        new Set(retRows?.map((r) => r.category).filter(Boolean) || [])
      ).sort();

      setSavedReturnInvoices(distinctInvoices);

      if (mode === "add") {
        const nextSeqNo = distinctInvoices.length + 1;
        const formattedNo = `POS-SR-${String(nextSeqNo).padStart(6, "0")}`;
        setReturnInvoiceNo(formattedNo);

        const now = new Date();
        setReturnInvoiceTime(now.toTimeString().split(" ")[0]);
      }
    } catch (e) {
      console.error("Error fetching initial POS return data:", e);
    }
  }, [company?.frm_code, supabase, mode]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Focus Scan Box on Load
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Stock Selection Modal Keyboard Arrow Navigation
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

  // Barcode / Product Code Scan Handler for Return
  const handleScanProductCode = async (inputVal?: string) => {
    const query = (inputVal || scanInput).trim().toUpperCase();
    if (!query || !company?.frm_code) return;

    // Duplicate Check: Check if barcode is already added in grid
    const alreadyAdded = gridRows.find(
      (r) => r.productCode.toUpperCase() === query
    );
    if (alreadyAdded) {
      alert(`Duplicate Stock Item Error!\nBarcode item "${query}" is already entered in this Sales Return invoice.`);
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
        const soldRows = barRows.filter((b) => b.inv_no && String(b.inv_no).trim() !== "");
        if (soldRows.length === 0) {
          alert(`Invalid Return Error!\nBarcode item "${query}" has NOT been sold in Retail POS Sale. Unsold stock items cannot be returned.`);
          setScanInput("");
          return;
        }

        if (soldRows.length === 1) {
          addStockItemToGrid(soldRows[0]);
          setScanInput("");
        } else {
          setStockItems(soldRows);
          setSelectedStockRowIndex(0);
          setIsStockModalOpen(true);
        }
      } else {
        alert(`Barcode / Product Code "${query}" not found.`);
        setScanInput("");
      }
    } catch (e) {
      console.error("Return scan error:", e);
    }
  };

function formatShortRefNarration(invNo?: string, dateStr?: string): string {
  const refNo = invNo || "POS-000001";
  let formattedDt = "25-08-26";
  if (dateStr) {
    const raw = dateStr.split("T")[0];
    const parts = raw.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        formattedDt = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
      } else {
        formattedDt = raw;
      }
    }
  }
  return `SaleRefNo.${refNo},Dt${formattedDt}`;
}

  // Add Item to Return Grid with Unsold Item Restriction, Duplicate Check & Short Narration
  const addStockItemToGrid = (bar: any) => {
    // Unsold Item Restriction: Item MUST have been sold in Retail POS Sale (inv_no must exist)
    if (!bar.inv_no || String(bar.inv_no).trim() === "") {
      alert(`Invalid Return Error!\nBarcode item "${bar.bar_no}" has NOT been sold in Retail POS Sale. Unsold stock items cannot be returned.`);
      return;
    }

    // Duplicate Check
    const alreadyAdded = gridRows.find(
      (r) => r.productCode.toUpperCase() === String(bar.bar_no).toUpperCase()
    );
    if (alreadyAdded) {
      alert(`Duplicate Stock Item Error!\nBarcode item "${bar.bar_no}" is already entered in this Sales Return invoice.`);
      return;
    }

    const saleRateMrp = Number(bar.pc_sale_rate || bar.tag_rate || 2000);
    const prcodeStr = String(bar.prcode || 101);
    const taxInfo = productTaxMap.get(prcodeStr) || { gstPerc: 5, hsnCode: "50079010" };
    const gstPerc = taxInfo.gstPerc || 5;
    const halfTax = gstPerc / 2;

    // Short Narration format: SaleRefNo.POS-000001,Dt25-08-26
    const invRefStr = formatShortRefNarration(bar.inv_no, bar.inv_date || returnInvoiceDate);

    const newRow: POSReturnGridRow = {
      id: `pos-ret-${bar.bar_no}-${Date.now()}`,
      sno: gridRows.length + 1,
      productCode: bar.bar_no,
      batchNo: bar.bar_no,
      prcode: bar.prcode || 101,
      productName: `${bar.grp_name || "Sarees"}-${taxInfo.hsnCode}`,
      hsnCode: taxInfo.hsnCode,
      invoiceDetails: invRefStr,
      qty: 1,
      unitName: bar.unit_name || "PCS",
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
    field: keyof POSReturnGridRow,
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

  // Delete Row from Return Grid
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

  // Final Received Amount Handler
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

  // Calculations Summary - Reverse Tax Calculation from Final Return Amount
  const totals = useMemo(() => {
    let totalQty = 0;
    let subTotal = 0;
    let totDiscAmt = 0;

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

    const factor = originalBillAmt > 0 ? targetReceivedAmt / originalBillAmt : 1;

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

  // Open Payment / Return Details Modal
  const handleOpenPaymentModal = () => {
    if (gridRows.length === 0) {
      alert("Please scan at least one barcode item to create POS Sales Return.");
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

  // Confirm & Save POS Sales Return (Stock Inwarding & Record Persistence)
  const handleFinalSaveInvoice = async () => {
    if (!company?.frm_code) return;

    if (totalPaidAmount !== totals.grandTotal) {
      alert(
        `Payment Validation Failed!\nTotal Return Split (₹${totalPaidAmount.toLocaleString()}) MUST equal Return Total (₹${totals.grandTotal.toLocaleString()}).`
      );
      return;
    }

    setLoading(true);
    setSaveSuccess(null);

    try {
      if (mode === "add") {
        const { data: existing } = await supabase
          .from("bar_temp")
          .select("bar_no")
          .eq("frm_code", company.frm_code)
          .eq("category", returnInvoiceNo);

        if (existing && existing.length > 0) {
          alert(
            `Duplicate Return Invoice Error!\nPOS Sales Return No "${returnInvoiceNo}" already exists for this financial year. Duplicate entries are strictly prohibited.`
          );
          setLoading(false);
          return;
        }
      }

      // Stock Inwarding & Saved Return Record Persistence (original inv_no remains untouched!)
      const barcodeList = gridRows.map((r) => r.productCode).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({
            sold_status: "A", // Inward stock back to Available stock list!
            category: returnInvoiceNo, // Stores return sequence 'POS-SR-000001' while leaving original inv_no untouched!
            margin: Number(cashDisc.toFixed(2)),
          })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      const msg = `POS Sales Return Saved Successfully!\nReturned Stock Inwarded to Stock List. Return Bill #${returnInvoiceNo} for ₹${totals.grandTotal.toLocaleString("en-IN")}`;
      setSaveSuccess(msg);
      alert(msg);

      setIsPaymentModalOpen(false);
      fetchInitialData();

      // Reset form to Add New Mode
      handleResetForm();
    } catch (e: any) {
      console.error("Sales Return Save Error:", e);
      alert(`Failed to save POS Sales Return: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete POS Sales Return Record (Delete [F9])
  const handleDeleteInvoice = async () => {
    if (!company?.frm_code) return;

    if (mode !== "edit" || gridRows.length === 0) {
      alert("Delete is only available when viewing an existing saved POS return invoice record.");
      return;
    }

    if (!confirm(`Are you sure you want to delete POS Sales Return ${returnInvoiceNo}?`)) {
      return;
    }

    setLoading(true);
    try {
      const barcodeList = gridRows.map((r) => r.productCode).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({
            sold_status: "A", // Ensure stock item is added to Batch Stock list to sell again!
            category: null,
          })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      alert(`POS Sales Return ${returnInvoiceNo} deleted successfully!`);
      handleResetForm();
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Failed to delete POS Sales Return: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Thermal Receipt Printing (TVS RP 4200)
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
          <title>POS Sales Return - ${returnInvoiceNo}</title>
          <style>
            @page { size: 80mm auto; margin: 0mm; }
            @media print { html, body { width: 80mm; margin: 0; padding: 0; } .no-print { display: none; } }
            body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.3; width: 76mm; margin: 0 auto; padding: 4mm 2mm; color: #000; background: #fff; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; }
            .border-top { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
            th { border-bottom: 1px dashed #000; text-align: left; padding: 2px 0; font-weight: bold; }
            td { padding: 2px 0; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${company?.frm_name || "KANNAN SILKS"}</div>
            <div>No 2/40, Raja Veethi Road</div>
            <div>Chinthamaniur, Omalur Via</div>
            <div>Salem (Dt)-636455</div>
            <div>Ph: 9787738094</div>
            <div class="bold" style="margin-top: 6px; font-size: 13px; text-decoration: underline;">POS Sales Return Voucher</div>
          </div>

          <div class="border-top border-bottom" style="font-size: 10px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span>No: <b>${returnInvoiceNo}</b></span>
              <span>Counter: 1</span>
              <span>Branch: Main</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Date: ${returnInvoiceDate}</span>
              <span>Time: ${returnInvoiceTime}</span>
              <span>User: admin</span>
            </div>
            <div style="margin-top: 2px;">
              <span>Customer: <b>${customerName}</b> (${customerMobile || "N/A"})</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 42%;">PARTICULARS/HSN</th>
                <th style="text-align: right; width: 12%;">QTY</th>
                <th style="text-align: center; width: 12%;">UNIT</th>
                <th style="text-align: right; width: 17%;">SALE RATE</th>
                <th style="text-align: right; width: 17%;">NET RATE</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="border-top" style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Total Discount: ${totals.totDisc.toFixed(2)}</span>
            <span>Total Return: ${totals.subTotal.toFixed(2)}</span>
          </div>

          <div style="margin-top: 6px; font-size: 15px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 4px;">
            Total Refund Amount : ₹ ${totals.grandTotal.toFixed(2)}
          </div>

          <div style="margin-top: 4px; font-size: 9px; font-style: italic;">
            Amount in Words: INR ${amountInWords}
          </div>

          <div class="border-top text-center bold" style="margin-top: 6px; font-size: 11px;">
            --- PAYOUT SUMMARY ---
          </div>
          ${paymentRowsHtml}

          <div class="text-center" style="margin-top: 10px; font-size: 10px; font-weight: bold;">
            *** STOCK INWARDED TO INVENTORY ***<br/>
            Thank You!
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Load Saved Sales Return Record by invNo (Previous / Next)
  const loadSavedInvoiceRecord = async (invNo: string) => {
    if (!invNo || !company?.frm_code) return;
    setLoading(true);
    try {
      setCashDisc(0);
      setCashDiscPerc(0);
      setSplDisc(0);
      setExpensesAmt(0);

      const { data: items, error } = await supabase
        .from("bar_temp")
        .select("*")
        .eq("frm_code", company.frm_code)
        .eq("category", invNo)
        .order("bar_ref_id", { ascending: true });

      if (error || !items || items.length === 0) {
        alert(`No saved return records found for return invoice ${invNo}`);
        return;
      }

      let savedCashDisc = 0;

      const loadedRows: POSReturnGridRow[] = items.map((bar, idx) => {
        const saleRateMrp = Number(bar.pc_sale_rate || 2000);
        const prcodeStr = String(bar.prcode || 101);
        const taxInfo = productTaxMap.get(prcodeStr) || { gstPerc: 5, hsnCode: "50079010" };
        const halfTax = (taxInfo.gstPerc || 5) / 2;
        if (bar.margin) {
          savedCashDisc = Number(bar.margin);
        }

        return {
          id: `pos-ret-saved-${bar.bar_no}-${idx}`,
          sno: idx + 1,
          productCode: bar.bar_no,
          batchNo: bar.bar_no,
          prcode: bar.prcode || 101,
          productName: `${bar.grp_name || "Sarees"}-${taxInfo.hsnCode}`,
          hsnCode: taxInfo.hsnCode,
          invoiceDetails: formatShortRefNarration(bar.inv_no || invNo, bar.inv_date || returnInvoiceDate),
          qty: bar.qty || 1,
          unitName: bar.unit_name || "PCS",
          mrp: saleRateMrp,
          rateUnit: saleRateMrp,
          amount: (bar.qty || 1) * saleRateMrp,
          disPerc: 0,
          sgstPerc: halfTax,
          cgstPerc: halfTax,
          igstPerc: 0,
          isBatchItem: false,
          maxStockQty: bar.qty || 1,
        };
      });

      if (savedCashDisc > 0) {
        setCashDisc(savedCashDisc);
      }

      setReturnInvoiceNo(invNo);
      setGridRows(loadedRows);
      setMode("edit");
    } catch (e: any) {
      console.error("Error loading saved POS return invoice:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevInvoice = () => {
    if (savedReturnInvoices.length === 0) {
      alert("No previous saved POS return invoices found.");
      return;
    }
    const newIdx = currentIndex <= 0 ? savedReturnInvoices.length - 1 : currentIndex - 1;
    setCurrentIndex(newIdx);
    loadSavedInvoiceRecord(savedReturnInvoices[newIdx]);
  };

  const handleNextInvoice = () => {
    if (savedReturnInvoices.length === 0) {
      alert("No next saved POS return invoices found.");
      return;
    }
    const newIdx = currentIndex >= savedReturnInvoices.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIdx);
    loadSavedInvoiceRecord(savedReturnInvoices[newIdx]);
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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStockModalOpen(false);
        setIsPaymentModalOpen(false);
        setIsCustomerModalOpen(false);
      } else if (e.key === "Insert") {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (mode === "edit") {
          handleOpenPaymentModal();
        } else {
          alert("Edit mode is active when viewing a saved return record (via Prev/Next).");
        }
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
  }, [gridRows, totals.grandTotal, isPaymentModalOpen, isStockModalOpen, stockItems, selectedStockRowIndex, savedReturnInvoices, currentIndex, mode]);

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-900 p-1.5 space-y-1.5 font-sans text-xs">
      {/* Top POS Sales Return Red Banner (Matching Reference Image) */}
      <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white px-3 py-1.5 rounded flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-black text-sm">
            ➔
          </div>
          <h1 className="text-base font-black tracking-tight">Sale Return</h1>
          <span className="text-xs font-bold text-amber-100 pl-2">
            {mode === "add" ? "Add New Mode" : "Edit Mode"}
          </span>
        </div>

        <div className="text-xs font-mono font-bold text-amber-100 flex items-center gap-4">
          <span>Counter: Counter 1</span>
          <span>Shift: General Shift</span>
        </div>
      </div>

      {/* CONFIRMATION BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Top Bar: Barcode Scan Input Bar */}
      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
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
                placeholder="Scan Saree Barcode (e.g. ma00002 or RS00002) or Product Code..."
                className={`h-7 text-xs bg-white text-slate-900 font-mono font-bold border border-slate-400 ${focusHighlightClass}`}
              />
            </div>
          </div>

          <div className="flex items-end gap-1.5 pt-4">
            <Button
              size="sm"
              className="h-7 text-xs bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold border"
              onClick={async () => {
                if (!company?.frm_code) return;
                const { data } = await supabase
                  .from("bar_temp")
                  .select("*")
                  .eq("frm_code", company.frm_code)
                  .not("inv_no", "is", null)
                  .neq("inv_no", "")
                  .limit(40);
                if (data) {
                  setStockItems(data);
                  setSelectedStockRowIndex(0);
                  setIsStockModalOpen(true);
                }
              }}
            >
              Select [F5]
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold border"
              onClick={() => handleScanProductCode()}
            >
              Search [F3]
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: RETURN GRID TABLE & VOUCHER DETAILS PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
        {/* Main Return Grid Table */}
        <div className="lg:col-span-3 space-y-1.5">
          <Card className="shadow-sm border overflow-hidden">
            <div className="overflow-x-auto min-h-[340px] max-h-[480px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border-b border-slate-300">
                  <TableRow>
                    <TableHead className="w-6 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-8 text-center p-1 font-bold">S...</TableHead>
                    <TableHead className="w-20 p-1 font-bold">Product Code</TableHead>
                    <TableHead className="min-w-[150px] p-1 font-bold">Product Name [Shift + F7]</TableHead>
                    <TableHead className="min-w-[160px] p-1 font-bold">Invoice Details</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-16 text-center p-1 font-bold">Unit Name</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Rate/Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">Dis %</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">SGST</TableHead>
                    <TableHead className="w-12 text-right p-1 font-bold">CGST</TableHead>
                    <TableHead className="w-28 text-right p-1 font-bold text-red-700 dark:text-red-400">Net Amount</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs font-mono">
                  {gridRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center p-12 text-slate-400 font-bold">
                        Scan Customer Returned Saree Barcode or Product Code above to add to Sales Return invoice.
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
                          <TableCell className="p-1 font-bold bg-amber-500 text-slate-950 px-2 rounded">
                            {row.productName}
                          </TableCell>
                          <TableCell className="p-1 text-slate-700 dark:text-slate-200 text-[11px] font-semibold truncate">
                            {row.invoiceDetails}
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
                          <TableCell className="p-1 text-right font-black text-red-700 dark:text-red-400 w-28">
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
                <span className="w-20 text-slate-900 dark:text-white">
                  {totals.subTotal.toFixed(2)}
                </span>
                <span className="w-28 text-red-700 dark:text-red-400 font-black">
                  {totals.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side Voucher Details Panel [F7] */}
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
                    value={returnInvoiceNo}
                    className="h-6 text-xs text-right w-28 bg-white font-bold"
                  />
                  <span className="text-[10px] text-slate-500">{returnInvoiceTime}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Date (Fri)</span>
                <Input
                  type="date"
                  value={returnInvoiceDate}
                  onChange={(e) => setReturnInvoiceDate(e.target.value)}
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

                <div className="flex justify-between items-center gap-1">
                  <span className="text-slate-600 font-bold text-[11px]">Cash Disc.</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={cashDiscPerc !== 0 ? cashDiscPerc : ""}
                      onChange={(e) => handleCashDiscPercChange(e.target.value)}
                      placeholder="0.00"
                      className="h-5 text-xs text-right w-14 bg-white px-1 font-bold"
                    />
                    <span className="text-[10px] font-bold text-slate-500">%</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={cashDisc !== 0 ? cashDisc : ""}
                      onChange={(e) => handleCashDiscAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="h-5 text-xs text-right w-20 bg-white px-1 font-bold text-red-600"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Special Disc.</span>
                  <Input
                    type="number"
                    value={splDisc !== 0 ? splDisc : ""}
                    onChange={(e) => setSplDisc(Number(e.target.value) || 0)}
                    placeholder="0.00"
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

              {/* EDITABLE BIG BRIGHT NET RETURN DISPLAY BOX */}
              <div className="bg-red-600 text-white p-2 rounded border-2 border-red-700 shadow-inner mt-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                  <span>Net Return Total</span>
                  <span>₹</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={totals.grandTotal !== 0 ? totals.grandTotal : ""}
                  onChange={(e) => handleFinalReceivedAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-2xl font-black font-mono text-right bg-white text-slate-950 border-2 border-red-800 shadow focus:ring-2 focus:ring-amber-500"
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
            <span className="font-bold text-slate-600">Customer [F6]</span>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-xs w-36 bg-white font-bold cursor-pointer"
            />
          </div>

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
        </div>
      </div>

      {/* BOTTOM ACTION BUTTONS TOOLBAR (Save button removed; record saved inside Payment Details [F8]) */}
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
                alert("Edit mode is active when viewing a saved return record (via Prev/Next).");
              }
            }}
          >
            Edit [F2]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-amber-600 text-white hover:bg-amber-700 font-bold border shadow px-4"
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

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs font-bold border"
            onClick={handlePrevInvoice}
          >
            Previous [Pg Up]
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs font-bold border"
            onClick={handleNextInvoice}
          >
            Next [Pg Down]
          </Button>
        </div>
      </div>

      {/* STOCK SELECTION MODAL [F5] */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-4xl p-0 border">
          <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Stock : Sarees / Return Items</span>
          </div>

          <div className="p-2 max-h-[420px] overflow-y-auto">
            <Table className="w-full text-xs font-mono border-collapse">
              <TableHeader className="bg-slate-100 dark:bg-slate-800 font-bold border-b">
                <TableRow>
                  <TableHead className="w-10 text-center p-1 font-bold">SNo</TableHead>
                  <TableHead className="w-24 p-1 font-bold">Batch Name</TableHead>
                  <TableHead className="w-16 text-center p-1 font-bold">Stock</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold">P.Rate</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold">Cost Rate</TableHead>
                  <TableHead className="w-16 text-right p-1 font-bold">MarkUp</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold text-amber-800 dark:text-amber-400">Sale Rate</TableHead>
                  <TableHead className="w-20 text-right p-1 font-bold">Purchase Qty</TableHead>
                  <TableHead className="w-24 p-1 font-bold">Date</TableHead>
                  <TableHead className="w-20 p-1 font-bold">Doc No</TableHead>
                  <TableHead className="p-1 font-bold">Account Name / Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center p-6 text-slate-400">
                      No stock items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  stockItems.map((item, idx) => {
                    const isSelected = idx === selectedStockRowIndex;
                    return (
                      <TableRow
                        key={item.bar_ref_id || idx}
                        onClick={() => {
                          setSelectedStockRowIndex(idx);
                          addStockItemToGrid(item);
                          setIsStockModalOpen(false);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-200 dark:bg-amber-900/60 font-bold border-2 border-amber-500" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <TableCell className="text-center p-1">{idx + 1}</TableCell>
                        <TableCell className="p-1 font-bold text-amber-800 dark:text-amber-300">{item.bar_no}</TableCell>
                        <TableCell className="text-center p-1 font-black">{item.qty || 1}</TableCell>
                        <TableCell className="text-right p-1">{(item.pc_pur_rate || 1200).toFixed(2)}</TableCell>
                        <TableCell className="text-right p-1">{(item.cost_rate || 1200).toFixed(2)}</TableCell>
                        <TableCell className="text-right p-1">{(item.markup || 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right p-1 font-black text-amber-800 dark:text-amber-300">{(item.pc_sale_rate || 2000).toFixed(2)}</TableCell>
                        <TableCell className="text-right p-1">{(item.qty || 1).toFixed(2)}</TableCell>
                        <TableCell className="p-1">{item.bar_date || returnInvoiceDate}</TableCell>
                        <TableCell className="p-1">123</TableCell>
                        <TableCell className="p-1 font-bold text-slate-800 dark:text-slate-100">{item.cr_code || "SRI KRISHNA SILKS"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-100 p-2 border-t flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">
              Total Items: {stockItems.length} (Use Up/Down Arrow keys, Enter or Proceed [F5])
            </span>
            <div className="flex gap-2 font-bold">
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white px-4"
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
                className="h-7 text-xs text-red-600"
                onClick={() => setIsStockModalOpen(false)}
              >
                Cancel [Esc]
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RETURN PAYOUT / PAYMENT DETAILS MODAL [F8] */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-xl p-0 border">
          <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1.5 font-bold text-xs border-b text-slate-900 dark:text-slate-100 flex justify-between items-center">
            <span>Return Payout Details [F8]</span>
          </div>

          <div className="p-3 space-y-3 font-sans text-xs">
            <div className="bg-red-100 dark:bg-red-950/40 p-2.5 rounded border border-red-300 flex items-center justify-between font-mono font-bold">
              <span className="text-red-900 dark:text-red-200 text-sm">Return Amount</span>
              <span className="text-2xl font-black text-red-700 dark:text-red-400">
                ₹{totals.grandTotal.toFixed(2)}
              </span>
            </div>

            <Table className="w-full text-xs font-mono border">
              <TableHeader className="bg-slate-100 dark:bg-slate-800 font-bold border-b">
                <TableRow>
                  <TableHead className="p-1 font-bold">Payout Type</TableHead>
                  <TableHead className="w-32 text-right p-1 font-bold">Amount</TableHead>
                  <TableHead className="p-1 font-bold">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.map((p, idx) => (
                  <TableRow key={p.type}>
                    <TableCell className="p-1 font-bold">{p.type}</TableCell>
                    <TableCell className="p-1 text-right">
                      <Input
                        type="number"
                        value={p.amount !== 0 ? p.amount : ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPaymentRows((prev) => {
                            const updated = [...prev];
                            updated[idx].amount = Math.max(0, val);
                            return updated;
                          });
                        }}
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
