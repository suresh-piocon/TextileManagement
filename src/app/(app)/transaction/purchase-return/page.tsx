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
  Trash2,
  Plus,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Building2,
  Barcode,
  Boxes,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface SupplierInvoice {
  invoiceNo: string;
  invoiceDate: string;
  purchaseValue: number;
  balanceStockQty: number;
  itemCount: number;
  items: InvoiceItem[];
}

interface InvoiceItem {
  prcode: number;
  prname: string;
  hsnCode: string;
  invoiceNo: string;
  invoiceDate: string;
  barcodeNo: string;
  batchNo: string;
  qty: number;
  balanceQty: number;
  unit: string;
  purRate: number;
  disPerc: number;
  discAmt: number;
  expenses: number;
  gstPerc: number;
  txblRate: number;
  netRate: number;
}

interface ReturnGridRow {
  id: string;
  sno: number;
  prcode: number;
  prname: string;
  hsnCode: string;
  invoiceNo: string;
  invoiceDate: string;
  barcodeNo: string;
  batchNo: string;
  qty: number;
  maxBalanceQty: number;
  unit: string;
  purRate: number;
  amount: number;
  disPerc: number;
  discAmt: number;
  expenses: number;
  sgstPerc: number;
  cgstPerc: number;
  igstPerc: number;
  txblRate: number;
  netRate: number;
}

export default function PurchaseReturnPage() {
  const router = useRouter();
  const { company } = useApp();
  const supabase = createClient();

  // Mode & Loading
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Voucher Details Header
  const [returnNo, setReturnNo] = useState<string>("PR-1001");
  const [returnDate, setReturnDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [taxCode, setTaxCode] = useState<string>("LOCAL"); // LOCAL | INTERSTATE | BILL OF SUPPLY
  const [salesman, setSalesman] = useState<string>("Direct");
  const [taxOnExpenses, setTaxOnExpenses] = useState<boolean>(true);
  const [remarks, setRemarks] = useState<string>("");

  // Supplier / Vendor State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [supplierMobile, setSupplierMobile] = useState<string>("");
  const [supplierBalance, setSupplierBalance] = useState<number>(0);
  const [supplierBday, setSupplierBday] = useState<string>("");

  // Available Supplier Invoices
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<Record<string, boolean>>({});

  // Barcode & Batch Search State
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState<string>("");
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [barcodeSearchResults, setBarcodeSearchResults] = useState<any[]>([]);
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>("");
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchSearchResults, setBatchSearchResults] = useState<any[]>([]);

  // Return Grid Items
  const [gridRows, setGridRows] = useState<ReturnGridRow[]>([
    {
      id: "row-1",
      sno: 1,
      prcode: 0,
      prname: "",
      hsnCode: "",
      invoiceNo: "",
      invoiceDate: "",
      barcodeNo: "",
      batchNo: "",
      qty: 1,
      maxBalanceQty: 999,
      unit: "NOS",
      purRate: 0,
      amount: 0,
      disPerc: 0,
      discAmt: 0,
      expenses: 0,
      sgstPerc: 2.5,
      cgstPerc: 2.5,
      igstPerc: 0,
      txblRate: 0,
      netRate: 0,
    },
  ]);

  // Expenses & Discounts
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [freightCharges, setFreightCharges] = useState<number>(0);

  // Focus style class
  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:ring-2 focus:ring-amber-500 font-medium transition-colors";

  // Input refs for barcode search
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const supplierSelectRef = useRef<HTMLSelectElement>(null);

  // Load Suppliers & Setup Next Auto Voucher No
  useEffect(() => {
    async function loadSuppliers() {
      if (!company?.frm_code) return;
      try {
        const { data: ledgData } = await supabase
          .from("ledger")
          .select("*")
          .eq("frm_code", company.frm_code)
          .order("ledg_name", { ascending: true });

        if (ledgData) setSuppliers(ledgData);

        // Fetch Next Return Voucher Number
        const { data: lastRet } = await supabase
          .from("pur_ret_mast")
          .select("prm_ref_no")
          .order("prm_ref_no", { ascending: false })
          .limit(1);

        const nextNo = lastRet && lastRet.length > 0 ? (lastRet[0].prm_ref_no || 0) + 1 : 1;
        setReturnNo(`PR-${1000 + nextNo}`);
      } catch (e) {
        console.error("Error loading suppliers:", e);
      }
    }
    loadSuppliers();
  }, [company?.frm_code, supabase]);

  // Load Invoices when Supplier changes
  const loadSupplierInvoices = useCallback(
    async (supplierId: number) => {
      if (!company?.frm_code || !supplierId) {
        setSupplierInvoices([]);
        return;
      }

      try {
        // Query bar_temp records for this supplier that are in stock (sold_status = 'A')
        const { data: barRows } = await supabase
          .from("bar_temp")
          .select("*")
          .eq("frm_code", company.frm_code)
          .eq("cr_code", supplierId)
          .eq("sold_status", "A");

        if (!barRows || barRows.length === 0) {
          setSupplierInvoices([]);
          return;
        }

        // Group by Invoice Number
        const invMap = new Map<string, InvoiceItem[]>();

        barRows.forEach((bar: any) => {
          const invNo = bar.inv_no || "INV-GENERIC";
          const invDate = bar.inv_date
            ? new Date(bar.inv_date).toLocaleDateString("en-IN")
            : new Date().toLocaleDateString("en-IN");

          const item: InvoiceItem = {
            prcode: bar.prcode || 0,
            prname: bar.grp_name || "Textile Item",
            hsnCode: "62099090",
            invoiceNo: invNo,
            invoiceDate: invDate,
            barcodeNo: bar.bar_no,
            batchNo: bar.bar_no,
            qty: bar.qty || 1,
            balanceQty: bar.qty || 1,
            unit: bar.unit_name || "NOS",
            purRate: bar.pc_pur_rate || 0,
            disPerc: 0,
            discAmt: 0,
            expenses: 0,
            gstPerc: 5,
            txblRate: bar.pc_pur_rate || 0,
            netRate: bar.pc_pur_rate || 0,
          };

          if (!invMap.has(invNo)) {
            invMap.set(invNo, []);
          }
          invMap.get(invNo)!.push(item);
        });

        const invoiceList: SupplierInvoice[] = Array.from(invMap.entries()).map(
          ([invNo, items]) => {
            const purchaseValue = items.reduce(
              (sum, it) => sum + it.qty * it.purRate,
              0
            );
            const balanceStockQty = items.reduce(
              (sum, it) => sum + it.balanceQty,
              0
            );
            return {
              invoiceNo: invNo,
              invoiceDate: items[0]?.invoiceDate || "",
              purchaseValue,
              balanceStockQty,
              itemCount: items.length,
              items,
            };
          }
        );

        setSupplierInvoices(invoiceList);
      } catch (e) {
        console.error("Error loading supplier invoices:", e);
      }
    },
    [company?.frm_code, supabase]
  );

  // Supplier selection change
  const handleSupplierSelect = (supplierIdStr: string) => {
    const sId = Number(supplierIdStr);
    setSelectedSupplierId(sId);

    const supp = suppliers.find((s) => s.ledg_code === sId);
    if (supp) {
      setSupplierMobile(supp.mobile || supp.phone || "");
      setSupplierBalance(supp.opening_bal || 0);
      loadSupplierInvoices(sId);
    } else {
      setSupplierMobile("");
      setSupplierBalance(0);
      setSupplierInvoices([]);
    }
  };

  // Add items from selected invoices into return grid
  const handleConfirmSelectInvoices = () => {
    const selectedList = supplierInvoices.filter(
      (inv) => selectedInvoiceNos[inv.invoiceNo]
    );

    if (selectedList.length === 0) {
      setIsInvoiceModalOpen(false);
      return;
    }

    const newRows: ReturnGridRow[] = [];
    let sno = 1;

    selectedList.forEach((inv) => {
      inv.items.forEach((it) => {
        const amount = it.qty * it.purRate;
        const sgstPerc = taxCode === "INTERSTATE" ? 0 : (it.gstPerc || 5) / 2;
        const cgstPerc = taxCode === "INTERSTATE" ? 0 : (it.gstPerc || 5) / 2;
        const igstPerc = taxCode === "INTERSTATE" ? it.gstPerc || 5 : 0;

        newRows.push({
          id: `row-${Date.now()}-${sno}`,
          sno: sno++,
          prcode: it.prcode,
          prname: it.prname,
          hsnCode: it.hsnCode,
          invoiceNo: it.invoiceNo,
          invoiceDate: it.invoiceDate,
          barcodeNo: it.barcodeNo,
          batchNo: it.batchNo,
          qty: it.qty,
          maxBalanceQty: it.balanceQty,
          unit: it.unit,
          purRate: it.purRate,
          amount: amount,
          disPerc: it.disPerc,
          discAmt: it.discAmt,
          expenses: it.expenses,
          sgstPerc,
          cgstPerc,
          igstPerc,
          txblRate: it.purRate,
          netRate: it.purRate,
        });
      });
    });

    setGridRows(newRows);
    setIsInvoiceModalOpen(false);
  };

  // Search Barcode (F3 / Top Bar)
  const handleBarcodeSearch = async (term?: string) => {
    const query = (term || barcodeSearchTerm).trim().toUpperCase();
    if (!query || !company?.frm_code) return;

    try {
      // Query bar_temp
      const { data: barRows } = await supabase
        .from("bar_temp")
        .select("*")
        .eq("frm_code", company.frm_code)
        .ilike("bar_no", `%${query}%`);

      if (!barRows || barRows.length === 0) {
        alert(`Barcode "${query}" not found in stock records.`);
        return;
      }

      // Check stock status
      const bar = barRows[0];
      const status = (bar.sold_status || "A").toUpperCase();

      if (status === "S") {
        alert(`Barcode "${bar.bar_no}" is already sold. Cannot process Purchase Return for sold items.`);
        return;
      }
      if (status === "PR") {
        alert(`Barcode "${bar.bar_no}" is already returned to supplier.`);
        return;
      }

      const invNo = bar.inv_no || "INV-GENERIC";
      const invDate = bar.inv_date
        ? new Date(bar.inv_date).toLocaleDateString("en-IN")
        : new Date().toLocaleDateString("en-IN");

      // Add to grid
      const existingIdx = gridRows.findIndex((r) => r.barcodeNo === bar.bar_no);
      if (existingIdx >= 0) {
        alert(`Barcode "${bar.bar_no}" is already added to return list.`);
        return;
      }

      const newRow: ReturnGridRow = {
        id: `row-${Date.now()}`,
        sno: gridRows.length + 1,
        prcode: bar.prcode || 0,
        prname: bar.grp_name || "Silk Saree Item",
        hsnCode: "62099090",
        invoiceNo: invNo,
        invoiceDate: invDate,
        barcodeNo: bar.bar_no,
        batchNo: bar.bar_no,
        qty: 1,
        maxBalanceQty: bar.qty || 1,
        unit: bar.unit_name || "NOS",
        purRate: bar.pc_pur_rate || 0,
        amount: bar.pc_pur_rate || 0,
        disPerc: 0,
        discAmt: 0,
        expenses: 0,
        sgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
        cgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
        igstPerc: taxCode === "INTERSTATE" ? 5 : 0,
        txblRate: bar.pc_pur_rate || 0,
        netRate: bar.pc_pur_rate || 0,
      };

      // Filter out empty rows
      const cleanRows = gridRows.filter((r) => r.prname || r.barcodeNo);
      setGridRows([...cleanRows, newRow]);
      setBarcodeSearchTerm("");
    } catch (e) {
      console.error("Barcode search error:", e);
    }
  };

  // Grid Cell Change Handler
  const handleCellChange = (
    index: number,
    field: keyof ReturnGridRow,
    value: any
  ) => {
    setGridRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === "qty") {
        const parsed = Math.max(1, Number(value) || 1);
        if (parsed > row.maxBalanceQty) {
          alert(
            `Return Qty (${parsed}) cannot exceed available stock balance Qty (${row.maxBalanceQty}).`
          );
          row.qty = row.maxBalanceQty;
        } else {
          row.qty = parsed;
        }
      } else if (field === "purRate") {
        row.purRate = Math.max(0, Number(value) || 0);
      } else if (field === "disPerc") {
        row.disPerc = Math.max(0, Number(value) || 0);
        row.discAmt = (row.qty * row.purRate * row.disPerc) / 100;
      } else if (field === "discAmt") {
        row.discAmt = Math.max(0, Number(value) || 0);
      } else if (field === "expenses") {
        row.expenses = Math.max(0, Number(value) || 0);
      } else {
        (row as any)[field] = value;
      }

      // Calculate row amount
      const baseAmount = row.qty * row.purRate - row.discAmt + row.expenses;
      row.amount = Math.max(0, baseAmount);

      const taxPerc =
        taxCode === "INTERSTATE"
          ? row.igstPerc
          : row.sgstPerc + row.cgstPerc;
      row.txblRate = row.purRate;
      row.netRate = row.purRate + (row.purRate * taxPerc) / 100;

      updated[index] = row;
      return updated;
    });
  };

  // Add Blank Row
  const handleAddRow = () => {
    setGridRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        sno: prev.length + 1,
        prcode: 0,
        prname: "",
        hsnCode: "62099090",
        invoiceNo: "",
        invoiceDate: "",
        barcodeNo: "",
        batchNo: "",
        qty: 1,
        maxBalanceQty: 999,
        unit: "NOS",
        purRate: 0,
        amount: 0,
        disPerc: 0,
        discAmt: 0,
        expenses: 0,
        sgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
        cgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
        igstPerc: taxCode === "INTERSTATE" ? 5 : 0,
        txblRate: 0,
        netRate: 0,
      },
    ]);
  };

  // Delete Row
  const handleDeleteRow = (index: number) => {
    if (gridRows.length === 1) {
      setGridRows([
        {
          id: `row-${Date.now()}`,
          sno: 1,
          prcode: 0,
          prname: "",
          hsnCode: "",
          invoiceNo: "",
          invoiceDate: "",
          barcodeNo: "",
          batchNo: "",
          qty: 1,
          maxBalanceQty: 999,
          unit: "NOS",
          purRate: 0,
          amount: 0,
          disPerc: 0,
          discAmt: 0,
          expenses: 0,
          sgstPerc: 2.5,
          cgstPerc: 2.5,
          igstPerc: 0,
          txblRate: 0,
          netRate: 0,
        },
      ]);
      return;
    }
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
    let totExpenses = 0;
    let totSgst = 0;
    let totCgst = 0;
    let totIgst = 0;

    gridRows.forEach((r) => {
      if (!r.prname && !r.barcodeNo) return;
      totQty += r.qty;
      const lineBase = r.qty * r.purRate;
      subTotal += lineBase;
      totDiscAmt += r.discAmt;
      totExpenses += r.expenses;

      const taxableLine = lineBase - r.discAmt + r.expenses;
      totSgst += (taxableLine * r.sgstPerc) / 100;
      totCgst += (taxableLine * r.cgstPerc) / 100;
      totIgst += (taxableLine * r.igstPerc) / 100;
    });

    const totDisc = totDiscAmt + cashDisc + splDisc;
    const taxableAmt = subTotal - totDisc + (taxOnExpenses ? totExpenses : 0);
    const totalTax = totSgst + totCgst + totIgst;
    const grossVal = taxableAmt + totalTax + otherCharges + freightCharges;
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
  }, [gridRows, cashDisc, splDisc, taxOnExpenses, otherCharges, freightCharges]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === "F5") {
        e.preventDefault();
        if (!selectedSupplierId) {
          alert("Please select a Supplier/Vendor [F6] first.");
        } else {
          setIsInvoiceModalOpen(true);
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        supplierSelectRef.current?.focus();
      } else if (e.key === "F10") {
        e.preventDefault();
        handleSaveReturn();
      } else if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsBatchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSupplierId]);

  // Save Purchase Return
  const handleSaveReturn = async () => {
    if (!company?.frm_code) return;
    if (!selectedSupplierId) {
      alert("Please select a Supplier/Vendor [F6] before saving.");
      return;
    }

    const validRows = gridRows.filter((r) => r.prname || r.barcodeNo);
    if (validRows.length === 0) {
      alert("Please add at least one valid item to return.");
      return;
    }

    setLoading(true);
    setSaveSuccess(null);

    try {
      // 1. Insert into pur_ret_mast
      const { data: mastRes, error: mastErr } = await supabase
        .from("pur_ret_mast")
        .insert([
          {
            prm_bill_ref_no: returnNo,
            prm_entry_date: returnDate,
            prm_bill_date: returnDate,
            prm_cr_code: selectedSupplierId,
            prm_tax_model: taxCode,
            prm_sales_person: salesman,
            prm_sub_total: totals.subTotal,
            prm_tot_disc: totals.totDisc,
            prm_taxable_amt: totals.taxableAmt,
            prm_cgst_amt: totals.totCgst,
            prm_sgst_amt: totals.totSgst,
            prm_igst_amt: totals.totIgst,
            prm_tot_tax: totals.totalTax,
            prm_other_charges: otherCharges + freightCharges,
            prm_tot_qty: totals.totQty,
            prm_grd_tot: totals.grandTotal,
            prm_rnd_off: totals.roundOff,
            prm_net_total: totals.grandTotal,
            prm_remarks: remarks || `Purchase Return Voucher ${returnNo}`,
            prm_frm_code: company.frm_code,
          },
        ])
        .select();

      if (mastErr) throw mastErr;
      const returnRefNo = mastRes?.[0]?.prm_ref_no || 1;

      // 2. Insert into pur_ret_child
      const childRows = validRows.map((r, i) => ({
        prm_ref_no: returnRefNo,
        prc_prcode: r.prcode || 1,
        prc_qty: r.qty,
        prc_pur_rate: r.purRate,
        prc_dis_perc: r.disPerc,
        prc_disc_amt: r.discAmt,
        prc_cgst_amt: (r.amount * r.cgstPerc) / 100,
        prc_sgst_amt: (r.amount * r.sgstPerc) / 100,
        prc_igst_amt: (r.amount * r.igstPerc) / 100,
        prc_total: r.amount,
        prc_net_tot: r.amount,
        frm_code: company.frm_code,
      }));

      const { error: childErr } = await supabase
        .from("pur_ret_child")
        .insert(childRows);

      if (childErr) console.warn("pur_ret_child insert notice:", childErr);

      // 3. Update bar_temp to set sold_status = 'PR' (Purchase Return) so stock reduces!
      const barcodeList = validRows.map((r) => r.barcodeNo).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({ sold_status: "PR" })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      setSaveSuccess(`Purchase Return ${returnNo} saved successfully!`);
      setTimeout(() => {
        setSaveSuccess(null);
        handleResetForm();
      }, 2000);
    } catch (e: any) {
      console.error("Error saving purchase return:", e);
      alert(`Failed to save Purchase Return: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset Form
  const handleResetForm = () => {
    setSelectedSupplierId("");
    setSupplierMobile("");
    setSupplierBalance(0);
    setSupplierInvoices([]);
    setRemarks("");
    setGridRows([
      {
        id: `row-${Date.now()}`,
        sno: 1,
        prcode: 0,
        prname: "",
        hsnCode: "",
        invoiceNo: "",
        invoiceDate: "",
        barcodeNo: "",
        batchNo: "",
        qty: 1,
        maxBalanceQty: 999,
        unit: "NOS",
        purRate: 0,
        amount: 0,
        disPerc: 0,
        discAmt: 0,
        expenses: 0,
        sgstPerc: 2.5,
        cgstPerc: 2.5,
        igstPerc: 0,
        txblRate: 0,
        netRate: 0,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-2 space-y-2 font-sans text-xs">
      {/* Top Banner Title Bar */}
      <div className="bg-amber-600 text-white px-3 py-2 rounded shadow flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          <h1 className="text-base font-bold tracking-tight">Purchase Return</h1>
          <span className="bg-amber-800 text-amber-100 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
            {mode === "add" ? "Add New Mode" : "Edit Mode"}
          </span>
        </div>

        {/* Top Search Barcode Input */}
        <div className="flex items-center gap-2">
          <Input
            ref={barcodeInputRef}
            value={barcodeSearchTerm}
            onChange={(e) => setBarcodeSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBarcodeSearch();
            }}
            placeholder="Product Code / Barcode Search [F3]"
            className={`h-7 text-xs bg-white text-slate-900 w-72 font-mono ${focusHighlightClass}`}
          />
          <Button
            size="sm"
            className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800 font-bold"
            onClick={() => handleBarcodeSearch()}
          >
            Search [F3]
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-700 text-white hover:bg-emerald-800 font-bold"
            onClick={() => {
              if (!selectedSupplierId) {
                alert("Please select a Supplier/Vendor [F6] first.");
              } else {
                setIsInvoiceModalOpen(true);
              }
            }}
          >
            Select Invoice [F5]
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow">
          <CheckCircle2 className="h-4 w-4" />
          {saveSuccess}
        </div>
      )}

      {/* Main Form Layout: Left Table Grid + Right Voucher Details Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Left Side: Return Product Grid Table */}
        <div className="lg:col-span-3 space-y-2">
          <Card className="shadow-sm border overflow-hidden">
            <div className="overflow-x-auto min-h-[420px] max-h-[550px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-8 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-10 text-center p-1 font-bold">SNo</TableHead>
                    <TableHead className="min-w-[180px] p-1 font-bold">
                      Product Name [Shift+F7]
                    </TableHead>
                    <TableHead className="min-w-[140px] p-1 font-bold">Invoice Details</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-14 text-center p-1 font-bold">Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Rate/Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">Dis %</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Dis-2%</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Expenses</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">SGST%</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">CGST%</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Txbl.Rate</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Net Rate</TableHead>
                    <TableHead className="w-20 p-1 font-bold">HSN Code</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs font-mono">
                  {gridRows.map((row, idx) => (
                    <TableRow key={row.id} className="hover:bg-amber-50/50 transition-colors">
                      {/* Delete Button */}
                      <TableCell className="text-center p-1">
                        <button
                          onClick={() => handleDeleteRow(idx)}
                          className="text-red-600 hover:text-red-800 font-black p-0.5"
                          title="Delete Row"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </TableCell>

                      {/* SNo */}
                      <TableCell className="text-center p-1 font-bold text-slate-500">
                        {row.sno}
                      </TableCell>

                      {/* Product Name */}
                      <TableCell className="p-1">
                        <Input
                          value={row.prname}
                          onChange={(e) => handleCellChange(idx, "prname", e.target.value)}
                          placeholder="Select or enter product..."
                          className={`h-7 text-xs bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* Invoice Details */}
                      <TableCell className="p-1">
                        <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          {row.invoiceNo ? (
                            <span>
                              {row.invoiceNo} | {row.invoiceDate}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Select Invoice [F5]</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Qty */}
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={row.qty}
                          onChange={(e) => handleCellChange(idx, "qty", e.target.value)}
                          className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* Unit */}
                      <TableCell className="p-1 text-center font-bold text-slate-700">
                        {row.unit}
                      </TableCell>

                      {/* Rate/Unit */}
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={row.purRate}
                          onChange={(e) => handleCellChange(idx, "purRate", e.target.value)}
                          className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="p-1 text-right font-bold">
                        ₹{row.amount.toFixed(2)}
                      </TableCell>

                      {/* Dis % */}
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={row.disPerc}
                          onChange={(e) => handleCellChange(idx, "disPerc", e.target.value)}
                          className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* Dis-2% / DiscAmt */}
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={row.discAmt}
                          onChange={(e) => handleCellChange(idx, "discAmt", e.target.value)}
                          className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* Expenses */}
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={row.expenses}
                          onChange={(e) => handleCellChange(idx, "expenses", e.target.value)}
                          className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                        />
                      </TableCell>

                      {/* SGST % */}
                      <TableCell className="p-1 text-right font-bold text-slate-600">
                        {row.sgstPerc}%
                      </TableCell>

                      {/* CGST % */}
                      <TableCell className="p-1 text-right font-bold text-slate-600">
                        {row.cgstPerc}%
                      </TableCell>

                      {/* Txbl Rate */}
                      <TableCell className="p-1 text-right font-bold">
                        ₹{row.txblRate.toFixed(2)}
                      </TableCell>

                      {/* Net Rate */}
                      <TableCell className="p-1 text-right font-bold text-emerald-700">
                        ₹{row.netRate.toFixed(2)}
                      </TableCell>

                      {/* HSN Code */}
                      <TableCell className="p-1 font-bold text-slate-600">
                        {row.hsnCode || "62099090"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Grid Bottom Subtotal Summary Bar */}
            <div className="bg-slate-200 dark:bg-slate-800 p-2 flex items-center justify-between font-bold text-xs border-t">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white text-slate-900 font-bold"
                  onClick={handleAddRow}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                </Button>
                <span className="text-slate-600">
                  Total Items: {gridRows.filter((r) => r.prname || r.barcodeNo).length}
                </span>
              </div>

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

          {/* Supplier Bar matching Screenshot Footer */}
          <Card className="shadow-sm border">
            <CardContent className="p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                <div>
                  <Label className="text-xs font-bold">Mob. [F6]</Label>
                  <Input
                    value={supplierMobile}
                    onChange={(e) => setSupplierMobile(e.target.value)}
                    placeholder="Supplier Mobile"
                    className="h-7 text-xs bg-background mt-0.5 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Supplier / Vendor Ledger [F6] *
                  </Label>
                  <select
                    ref={supplierSelectRef}
                    value={selectedSupplierId}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    className={`flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs font-bold mt-0.5 ${focusHighlightClass}`}
                  >
                    <option value="">-- Select Supplier / Vendor Ledger --</option>
                    {suppliers.map((s) => (
                      <option key={s.ledg_code} value={s.ledg_code}>
                        {s.ledg_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold">A/c Balance</Label>
                  <Input
                    readOnly
                    value={`₹${supplierBalance.toFixed(2)}`}
                    className="h-7 text-xs bg-slate-100 font-mono font-bold text-amber-700 mt-0.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Voucher Details Panel matching Screenshot Side Panel */}
        <div className="lg:col-span-1 space-y-2">
          <Card className="shadow-sm border">
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold flex justify-between items-center text-xs">
              <span>Voucher Details [F7]</span>
              <span className="text-[10px] bg-amber-600 px-1.5 py-0.5 rounded">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <CardContent className="p-2 space-y-2 text-xs">
              {/* Return Invoice No & Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold">Invoice No</Label>
                  <Input
                    value={returnNo}
                    onChange={(e) => setReturnNo(e.target.value)}
                    className="h-7 text-xs font-mono font-bold bg-slate-100"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold">Date</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Tax Code Dropdown */}
              <div>
                <Label className="text-[11px] font-bold">Tax Code</Label>
                <select
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs font-bold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="LOCAL">LOCAL (Intra-State GST)</option>
                  <option value="INTERSTATE">INTERSTATE (IGST)</option>
                  <option value="BILL_OF_SUPPLY">BILL OF SUPPLY (Tax Free)</option>
                </select>
              </div>

              {/* Salesman */}
              <div>
                <Label className="text-[11px] font-bold">Salesman [F7]</Label>
                <Input
                  value={salesman}
                  onChange={(e) => setSalesman(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              {/* Checkbox: Tax On Expenses */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taxOnExpenses"
                  checked={taxOnExpenses}
                  onChange={(e) => setTaxOnExpenses(e.target.checked)}
                  className="h-3.5 w-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <label htmlFor="taxOnExpenses" className="text-xs font-bold cursor-pointer">
                  Tax On Expenses
                </label>
              </div>

              <hr className="my-1 border-slate-200" />

              {/* Financial Calculation Summary Table */}
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

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Spl. Disc.:</span>
                  <Input
                    type="number"
                    value={splDisc}
                    onChange={(e) => setSplDisc(Number(e.target.value) || 0)}
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

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Freight Charges:</span>
                  <Input
                    type="number"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(Number(e.target.value) || 0)}
                    className="h-6 text-xs text-right w-24 font-mono"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Other Charges:</span>
                  <Input
                    type="number"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(Number(e.target.value) || 0)}
                    className="h-6 text-xs text-right w-24 font-mono"
                  />
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>Round Off:</span>
                  <span>₹{totals.roundOff.toFixed(2)}</span>
                </div>
              </div>

              {/* Remarks Textarea */}
              <div className="pt-1">
                <Label className="text-[11px] font-bold">Remarks</Label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter purchase return remarks..."
                  rows={2}
                  className={`w-full rounded-md border border-input bg-background p-1 text-xs ${focusHighlightClass}`}
                />
              </div>

              {/* Big Golden Grand Total Banner matching Screenshot */}
              <div className="bg-amber-500 text-white rounded p-3 text-center border-2 border-amber-600 shadow">
                <span className="text-[10px] font-bold tracking-widest uppercase block text-amber-100">
                  NET RETURN GRAND TOTAL
                </span>
                <span className="text-2xl font-black font-mono">
                  ₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Controls Toolbar matching Screenshot */}
      <div className="bg-card border rounded p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 shadow"
            onClick={handleSaveReturn}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save [F10]"}
          </Button>

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
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            onClick={() => {
              if (!selectedSupplierId) {
                alert("Please select a Supplier/Vendor [F6] first.");
              } else {
                setIsInvoiceModalOpen(true);
              }
            }}
          >
            Select Invoice [F5]
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold"
            onClick={() => handleBarcodeSearch()}
          >
            Search Barcode [F3]
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

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.back()}>
            Previous [Pg Up]
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.forward()}>
            Next [Pg Dn]
          </Button>
        </div>
      </div>

      {/* Select Invoice Modal [F5] */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-700">
              <FileSpreadsheet className="h-5 w-5" />
              Select Purchase Invoices for Return [F5]
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Select one or multiple purchase invoices available for supplier to load all items into Purchase Return:
            </p>

            {supplierInvoices.length === 0 ? (
              <div className="p-8 text-center border rounded bg-slate-50 text-slate-500 font-bold text-xs">
                No active purchase invoices found in stock for this supplier.
              </div>
            ) : (
              <Table className="w-full border text-xs">
                <TableHeader className="bg-slate-100 font-bold">
                  <TableRow>
                    <TableHead className="w-12 text-center">Select</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead className="text-center">Item Count</TableHead>
                    <TableHead className="text-right">Purchase Value</TableHead>
                    <TableHead className="text-right">Balance Stock Qty</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {supplierInvoices.map((inv) => {
                    const isChecked = !!selectedInvoiceNos[inv.invoiceNo];
                    return (
                      <TableRow key={inv.invoiceNo} className="hover:bg-amber-50">
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              setSelectedInvoiceNos((prev) => ({
                                ...prev,
                                [inv.invoiceNo]: !prev[inv.invoiceNo],
                              }))
                            }
                            className="h-4 w-4 text-amber-600 rounded border-slate-300"
                          />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-amber-700">
                          {inv.invoiceNo}
                        </TableCell>
                        <TableCell>{inv.invoiceDate}</TableCell>
                        <TableCell className="text-center font-bold">
                          {inv.itemCount}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          ₹{inv.purchaseValue.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">
                          {inv.balanceStockQty}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={handleConfirmSelectInvoices}
              disabled={supplierInvoices.length === 0}
            >
              Confirm Load Invoices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
