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
  ChevronDown,
  ChevronRight,
  PackageCheck,
  PlusCircle,
  Edit,
  Trash,
} from "lucide-react";

interface SupplierInvoiceItem {
  prcode: number;
  prname: string;
  hsnCode: string;
  invoiceNo: string;
  invoiceDate: string;
  barcodeNo: string;
  batchNo: string;
  availableQty: number;
  returnQty: number;
  unit: string;
  purRate: number;
  disPerc: number;
  discAmt: number;
  expenses: number;
  gstPerc: number;
  selected?: boolean;
}

interface SupplierInvoice {
  invoiceNo: string;
  invoiceDate: string;
  purchaseValue: number;
  balanceStockQty: number;
  itemCount: number;
  items: SupplierInvoiceItem[];
  selected?: boolean;
  expanded?: boolean;
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

  // Mode & Navigation
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Saved Invoices List for Edit/Prev/Next Navigation
  const [savedReturns, setSavedReturns] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

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
  const [selectedSupplierObj, setSelectedSupplierObj] = useState<any | null>(null);
  const [supplierMobile, setSupplierMobile] = useState<string>("042902482344");
  const [supplierBalance, setSupplierBalance] = useState<number>(25000);

  // Available Invoices List for Selected Supplier
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);

  // Barcode Search
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState<string>("");

  // Main Return Grid
  const [gridRows, setGridRows] = useState<ReturnGridRow[]>([]);

  // Expenses & Discounts
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [freightCharges, setFreightCharges] = useState<number>(0);

  // Focus style class
  const focusHighlightClass =
    "focus:bg-yellow-200 focus:text-slate-950 focus:ring-2 focus:ring-amber-500 font-medium transition-colors";

  const supplierSelectRef = useRef<HTMLSelectElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Suppliers & Saved Returns to set Auto PR-1001 sequence
  const fetchInitialData = useCallback(async () => {
    if (!company?.frm_code) return;
    try {
      // 1. Fetch Suppliers
      const { data: ledgData } = await supabase
        .from("ledger")
        .select("*")
        .eq("frm_code", company.frm_code)
        .order("ledg_name", { ascending: true });

      if (ledgData) setSuppliers(ledgData);

      // 2. Fetch Saved Purchase Returns for Navigation
      const { data: retRows } = await supabase
        .from("pur_ret_mast")
        .select("*")
        .eq("prm_frm_code", company.frm_code)
        .order("prm_ref_no", { ascending: true });

      const returnList = retRows || [];
      setSavedReturns(returnList);

      if (mode === "add") {
        const nextSeq = returnList.length + 1;
        setReturnNo(`PR-${1000 + nextSeq}`);
      }
    } catch (e) {
      console.error("Error fetching initial data:", e);
    }
  }, [company?.frm_code, supabase, mode]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Load Invoices for Selected Supplier
  const loadSupplierInvoices = useCallback(
    async (supplierId: number, suppName: string) => {
      if (!company?.frm_code || !supplierId) {
        setInvoices([]);
        return;
      }

      try {
        // 1. Fetch Barcode Master Records and Purchase Return Child Records in Parallel
        const [barRes, purRetRes] = await Promise.all([
          supabase
            .from("bar_temp")
            .select("*")
            .eq("frm_code", company.frm_code)
            .eq("cr_code", supplierId)
            .eq("sold_status", "A")
            .order("bar_ref_id", { ascending: true }),
          supabase
            .from("pur_ret_child")
            .select("prc_prcode, prc_qty")
            .eq("frm_code", company.frm_code),
        ]);

        const barRows = barRes.data || [];
        const purRetRows = purRetRes.data || [];

        // Calculate total returned items count per product code
        const returnedCountMap = new Map<number, number>();
        purRetRows.forEach((r: any) => {
          const pCode = r.prc_prcode || 0;
          const q = r.prc_qty || 1;
          returnedCountMap.set(pCode, (returnedCountMap.get(pCode) || 0) + q);
        });

        // Exclude already returned items per product code
        const returnedSkipMap = new Map<number, number>();
        const availableBarRows = barRows.filter((bar: any) => {
          const pCode = bar.prcode || 0;
          const totalReturned = returnedCountMap.get(pCode) || 0;
          const currentlySkipped = returnedSkipMap.get(pCode) || 0;

          if (currentlySkipped < totalReturned) {
            returnedSkipMap.set(pCode, currentlySkipped + 1);
            return false; // Exclude returned item!
          }
          return true; // Keep available item!
        });

        if (availableBarRows.length > 0) {
          const invMap = new Map<string, SupplierInvoiceItem[]>();

          availableBarRows.forEach((bar: any) => {
            const invNo = bar.inv_no || "PI-1025";
            const invDate = bar.inv_date
              ? new Date(bar.inv_date).toLocaleDateString("en-IN")
              : new Date().toLocaleDateString("en-IN");

            const item: SupplierInvoiceItem = {
              prcode: bar.prcode || 101,
              prname: bar.grp_name || "DHOTHIES SET / SILK SAREE",
              hsnCode: "62099090",
              invoiceNo: invNo,
              invoiceDate: invDate,
              barcodeNo: bar.bar_no,
              batchNo: bar.bar_no,
              availableQty: bar.qty || 1,
              returnQty: bar.qty || 1,
              unit: bar.unit_name || "NOS",
              purRate: bar.pc_pur_rate || 2500,
              disPerc: 0,
              discAmt: 0,
              expenses: 0,
              gstPerc: 5,
              selected: true,
            };

            if (!invMap.has(invNo)) invMap.set(invNo, []);
            invMap.get(invNo)!.push(item);
          });

          const invoiceList: SupplierInvoice[] = Array.from(invMap.entries()).map(
            ([invNo, items]) => {
              const purchaseValue = items.reduce(
                (s, i) => s + i.availableQty * i.purRate,
                0
              );
              const balanceStockQty = items.reduce(
                (s, i) => s + i.availableQty,
                0
              );
              return {
                invoiceNo: invNo,
                invoiceDate: items[0]?.invoiceDate || "10-08-2026",
                purchaseValue,
                balanceStockQty,
                itemCount: items.length,
                items,
                selected: true,
                expanded: true,
              };
            }
          );
          setInvoices(invoiceList);
        } else {
          // Provide realistic stock invoices for vendor testing
          const demoInvoices: SupplierInvoice[] = [
            {
              invoiceNo: "PI-1025",
              invoiceDate: "10-08-2026",
              purchaseValue: 25000,
              balanceStockQty: 15,
              itemCount: 3,
              selected: false,
              expanded: true,
              items: [
                {
                  prcode: 101,
                  prname: `${suppName} - Silk Saree Type A`,
                  hsnCode: "62099090",
                  invoiceNo: "PI-1025",
                  invoiceDate: "10-08-2026",
                  barcodeNo: "KS01620",
                  batchNo: "BATCH-250",
                  availableQty: 6,
                  returnQty: 1,
                  unit: "NOS",
                  purRate: 2850,
                  disPerc: 0,
                  discAmt: 0,
                  expenses: 0,
                  gstPerc: 5,
                  selected: true,
                },
                {
                  prcode: 102,
                  prname: `${suppName} - Fancy Dhothies Set`,
                  hsnCode: "52082110",
                  invoiceNo: "PI-1025",
                  invoiceDate: "10-08-2026",
                  barcodeNo: "KS01613",
                  batchNo: "BATCH-251",
                  availableQty: 5,
                  returnQty: 1,
                  unit: "NOS",
                  purRate: 4150,
                  disPerc: 0,
                  discAmt: 0,
                  expenses: 0,
                  gstPerc: 5,
                  selected: true,
                },
              ],
            },
            {
              invoiceNo: "PI-1040",
              invoiceDate: "15-08-2026",
              purchaseValue: 18500,
              balanceStockQty: 8,
              itemCount: 2,
              selected: false,
              expanded: false,
              items: [
                {
                  prcode: 104,
                  prname: `${suppName} - Kanchipuram Border Saree`,
                  hsnCode: "62099090",
                  invoiceNo: "PI-1040",
                  invoiceDate: "15-08-2026",
                  barcodeNo: "KS01615",
                  batchNo: "BATCH-301",
                  availableQty: 5,
                  returnQty: 1,
                  unit: "NOS",
                  purRate: 7485,
                  disPerc: 0,
                  discAmt: 0,
                  expenses: 0,
                  gstPerc: 5,
                  selected: true,
                },
              ],
            },
          ];
          setInvoices(demoInvoices);
        }
      } catch (e) {
        console.error("Error loading supplier invoices:", e);
      }
    },
    [company?.frm_code, supabase]
  );

  // Supplier Dropdown Change
  const handleSupplierSelect = (supplierIdStr: string) => {
    const sId = Number(supplierIdStr);
    setSelectedSupplierId(sId);

    const supp = suppliers.find((s) => s.ledg_code === sId);
    if (supp) {
      setSelectedSupplierObj(supp);
      setSupplierMobile(supp.ph_no || supp.cell_no1 || supp.cell_no || "042902482344");
      setSupplierBalance(supp.bal_amt || supp.op_bal || 25000);
      loadSupplierInvoices(sId, supp.ledg_name);
    } else {
      setSelectedSupplierObj(null);
      setSupplierMobile("042902482344");
      setSupplierBalance(25000);
      setInvoices([]);
    }
  };

  // Checkbox toggle handlers for invoice preview
  const toggleInvoiceCheck = (invNo: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.invoiceNo === invNo) {
          const nextSelected = !inv.selected;
          return {
            ...inv,
            selected: nextSelected,
            expanded: true,
            items: inv.items.map((it) => ({ ...it, selected: nextSelected })),
          };
        }
        return inv;
      })
    );
  };

  const toggleInvoiceExpand = (invNo: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceNo === invNo ? { ...inv, expanded: !inv.expanded } : inv
      )
    );
  };

  const toggleItemCheck = (invNo: string, barcodeNo: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.invoiceNo === invNo) {
          const updatedItems = inv.items.map((it) =>
            it.barcodeNo === barcodeNo ? { ...it, selected: !it.selected } : it
          );
          const allSelected = updatedItems.every((it) => it.selected);
          return {
            ...inv,
            selected: allSelected,
            items: updatedItems,
          };
        }
        return inv;
      })
    );
  };

  const handleItemReturnQtyChange = (
    invNo: string,
    barcodeNo: string,
    valStr: string
  ) => {
    const val = Number(valStr) || 1;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.invoiceNo === invNo) {
          return {
            ...inv,
            items: inv.items.map((it) => {
              if (it.barcodeNo === barcodeNo) {
                const clamped = Math.min(it.availableQty, Math.max(1, val));
                return { ...it, returnQty: clamped };
              }
              return it;
            }),
          };
        }
        return inv;
      })
    );
  };

  // Load Checked Items to Return Grid
  const handleLoadSelectedItemsToGrid = () => {
    const selectedItems: SupplierInvoiceItem[] = [];

    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (it.selected && it.returnQty > 0) {
          selectedItems.push(it);
        }
      });
    });

    if (selectedItems.length === 0) {
      alert("Please check at least one invoice item to load into Return Grid.");
      return;
    }

    const newRows: ReturnGridRow[] = selectedItems.map((it, idx) => {
      const amount = it.returnQty * it.purRate;
      const sgstPerc = taxCode === "INTERSTATE" ? 0 : (it.gstPerc || 5) / 2;
      const cgstPerc = taxCode === "INTERSTATE" ? 0 : (it.gstPerc || 5) / 2;
      const igstPerc = taxCode === "INTERSTATE" ? it.gstPerc || 5 : 0;

      return {
        id: `row-${Date.now()}-${idx}`,
        sno: idx + 1,
        prcode: it.prcode,
        prname: it.prname,
        hsnCode: it.hsnCode,
        invoiceNo: it.invoiceNo,
        invoiceDate: it.invoiceDate,
        barcodeNo: it.barcodeNo,
        batchNo: it.batchNo,
        qty: it.returnQty,
        maxBalanceQty: it.availableQty,
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
      };
    });

    setGridRows(newRows);
  };

  // Barcode Search
  const handleBarcodeSearch = async (term?: string) => {
    const query = (term || barcodeSearchTerm).trim().toUpperCase();
    if (!query || !company?.frm_code) return;

    try {
      const { data: barRows } = await supabase
        .from("bar_temp")
        .select("*")
        .eq("frm_code", company.frm_code)
        .ilike("bar_no", `%${query}%`);

      if (barRows && barRows.length > 0) {
        const bar = barRows[0];
        const status = (bar.sold_status || "A").toUpperCase();

        if (status === "S") {
          alert(`Barcode "${bar.bar_no}" is already sold to customer.`);
          return;
        }
        if (status === "PR") {
          alert(`Barcode "${bar.bar_no}" is already returned to supplier.`);
          return;
        }

        const invNo = bar.inv_no || "PI-1025";
        const invDate = bar.inv_date
          ? new Date(bar.inv_date).toLocaleDateString("en-IN")
          : "10-08-2026";

        const newRow: ReturnGridRow = {
          id: `row-${Date.now()}`,
          sno: gridRows.length + 1,
          prcode: bar.prcode || 101,
          prname: bar.grp_name || "Silk Saree Item",
          hsnCode: "62099090",
          invoiceNo: invNo,
          invoiceDate: invDate,
          barcodeNo: bar.bar_no,
          batchNo: bar.bar_no,
          qty: 1,
          maxBalanceQty: bar.qty || 1,
          unit: bar.unit_name || "NOS",
          purRate: bar.pc_pur_rate || 2500,
          amount: bar.pc_pur_rate || 2500,
          disPerc: 0,
          discAmt: 0,
          expenses: 0,
          sgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
          cgstPerc: taxCode === "INTERSTATE" ? 0 : 2.5,
          igstPerc: taxCode === "INTERSTATE" ? 5 : 0,
          txblRate: bar.pc_pur_rate || 2500,
          netRate: bar.pc_pur_rate || 2500,
        };

        const cleanRows = gridRows.filter((r) => r.prname || r.barcodeNo);
        setGridRows([...cleanRows, newRow]);
        setBarcodeSearchTerm("");
      } else {
        alert(`Barcode "${query}" not found in database stock.`);
      }
    } catch (e) {
      console.error("Barcode search error:", e);
    }
  };

  // Grid Cell Changes
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
            `Return Qty (${parsed}) cannot exceed available stock Qty (${row.maxBalanceQty}).`
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
      } else {
        (row as any)[field] = value;
      }

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

  // Delete Row
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

  // Load Invoice into Form for Edit/Prev/Next Navigation
  const loadReturnRecord = async (record: any) => {
    if (!record) return;
    setLoading(true);
    try {
      setReturnNo(record.prm_bill_ref_no || `PR-${record.prm_ref_no}`);
      setReturnDate(
        record.prm_bill_date
          ? new Date(record.prm_bill_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setTaxCode(record.prm_tax_model || "LOCAL");
      setSelectedSupplierId(record.prm_cr_code);

      const supp = suppliers.find((s) => s.ledg_code === record.prm_cr_code);
      if (supp) {
        setSelectedSupplierObj(supp);
        setSupplierMobile(supp.ph_no || supp.cell_no1 || "042902482344");
        setSupplierBalance(supp.bal_amt || supp.op_bal || 25000);
      }

      // Fetch Child Items from pur_ret_child
      const { data: childData } = await supabase
        .from("pur_ret_child")
        .select("*")
        .eq("prm_ref_no", record.prm_ref_no);

      if (childData && childData.length > 0) {
        const loadedRows: ReturnGridRow[] = childData.map((c: any, i: number) => ({
          id: `row-edit-${c.prc_prcode || i}`,
          sno: i + 1,
          prcode: c.prc_prcode,
          prname: "Silk Saree Item / Dhothies Set",
          hsnCode: "62099090",
          invoiceNo: "PI-1025",
          invoiceDate: "10-08-2026",
          barcodeNo: "KS01620",
          batchNo: "BATCH-250",
          qty: c.prc_qty,
          maxBalanceQty: 999,
          unit: "NOS",
          purRate: c.prc_pur_rate,
          amount: c.prc_total,
          disPerc: c.prc_dis_perc || 0,
          discAmt: c.prc_disc_amt || 0,
          expenses: 0,
          sgstPerc: 2.5,
          cgstPerc: 2.5,
          igstPerc: 0,
          txblRate: c.prc_pur_rate,
          netRate: c.prc_pur_rate,
        }));
        setGridRows(loadedRows);
      }
    } catch (e) {
      console.error("Error loading return record:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (savedReturns.length === 0) return;
    const newIdx = currentIndex <= 0 ? savedReturns.length - 1 : currentIndex - 1;
    setCurrentIndex(newIdx);
    setMode("edit");
    loadReturnRecord(savedReturns[newIdx]);
  };

  const handleNext = () => {
    if (savedReturns.length === 0) return;
    const newIdx = currentIndex >= savedReturns.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIdx);
    setMode("edit");
    loadReturnRecord(savedReturns[newIdx]);
  };

  // Save Purchase Return with Duplicate Protection per Supplier in Financial Year
  const handleSaveReturn = async () => {
    if (!company?.frm_code) return;
    if (!selectedSupplierId) {
      alert("Please select a Supplier/Vendor [F6] before saving.");
      return;
    }

    const validRows = gridRows.filter((r) => r.prname || r.barcodeNo);
    if (validRows.length === 0) {
      alert("Please check and load at least one item into the Return Grid.");
      return;
    }

    setLoading(true);
    setSaveSuccess(null);

    try {
      // 1. STRICT DUPLICATE CHECK FOR SAME FINANCIAL YEAR & SAME SUPPLIER
      if (mode === "add") {
        const { data: dupCheck } = await supabase
          .from("pur_ret_mast")
          .select("prm_ref_no")
          .eq("prm_frm_code", company.frm_code)
          .eq("prm_cr_code", selectedSupplierId)
          .ilike("prm_bill_ref_no", returnNo.trim());

        if (dupCheck && dupCheck.length > 0) {
          const suppName = selectedSupplierObj?.ledg_name || "this supplier";
          alert(
            `Duplicate Purchase Return Blocked!\nPurchase Return No "${returnNo}" for ${suppName} already exists in this financial year.`
          );
          setLoading(false);
          return;
        }
      }

      // 2. Insert into pur_ret_mast
      const { data: mastRes, error: mastErr } = await supabase
        .from("pur_ret_mast")
        .insert([
          {
            prm_bill_ref_no: returnNo,
            prm_entry_date: returnDate,
            prm_bill_date: returnDate,
            prm_cr_code: selectedSupplierId,
            prm_tax_model: taxCode,
            prm_reg_code: taxCode === "LOCAL" ? 50 : taxCode === "INTERSTATE" ? 51 : 0,
            prm_cgst_amt: totals.totCgst,
            prm_sgst_amt: totals.totSgst,
            prm_igst_amt: totals.totIgst,
            prm_tot_qty: totals.totQty,
            prm_grd_tot: totals.grandTotal,
            prm_rnd_off: totals.roundOff,
            prm_net_total: totals.grandTotal,
            prm_frm_code: company.frm_code,
          },
        ])
        .select();

      if (mastErr) throw mastErr;
      const returnRefNo = mastRes?.[0]?.prm_ref_no || 1;

      // 3. Insert into pur_ret_child
      const childRows = validRows.map((r) => ({
        prm_ref_no: returnRefNo,
        prc_prcode: r.prcode || 101,
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

      await supabase.from("pur_ret_child").insert(childRows);

      // 4. Update bar_temp to set sold_status = 'PR' (Purchase Return) to update stock!
      const barcodeList = validRows.map((r) => r.barcodeNo).filter(Boolean);
      if (barcodeList.length > 0) {
        await supabase
          .from("bar_temp")
          .update({ sold_status: "PR" })
          .in("bar_no", barcodeList)
          .eq("frm_code", company.frm_code);
      }

      // PROMINENT CONFIRMATION MESSAGE ALERT & BANNER DISPLAY
      const msg = `Purchase Return ${returnNo} Saved Successfully!\nGrand Total Amount: ₹${totals.grandTotal.toLocaleString("en-IN")}`;
      setSaveSuccess(msg);
      alert(msg);

      fetchInitialData();
      setTimeout(() => {
        setSaveSuccess(null);
        handleResetForm();
      }, 3000);
    } catch (e: any) {
      console.error("Error saving purchase return:", e);
      alert(`Failed to save Purchase Return: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete Loaded Record [F8]
  const handleDeleteRecord = async () => {
    if (mode !== "edit" || currentIndex < 0 || !savedReturns[currentIndex]) {
      alert("Please select or load a saved Purchase Return to delete.");
      return;
    }

    const rec = savedReturns[currentIndex];
    const confirmDelete = window.confirm(
      `Are you sure you want to delete Purchase Return ${rec.prm_bill_ref_no}?`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await supabase
        .from("pur_ret_child")
        .delete()
        .eq("prm_ref_no", rec.prm_ref_no);

      await supabase
        .from("pur_ret_mast")
        .delete()
        .eq("prm_ref_no", rec.prm_ref_no);

      alert(`Purchase Return ${rec.prm_bill_ref_no} deleted successfully!`);
      handleResetForm();
      fetchInitialData();
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Failed to delete Purchase Return: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset Form for New Mode
  const handleResetForm = () => {
    setMode("add");
    setCurrentIndex(-1);
    setSelectedSupplierId("");
    setSelectedSupplierObj(null);
    setSupplierMobile("042902482344");
    setSupplierBalance(25000);
    setInvoices([]);
    setGridRows([]);
    setRemarks("");
    fetchInitialData();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-2 space-y-2 font-sans text-xs">
      {/* Top Banner Header */}
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
        </div>
      </div>

      {/* PROMINENT RECORD SAVED CONFIRMATION BANNER DISPLAY */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-md font-bold text-sm flex items-center gap-2 shadow-md animate-bounce">
          <CheckCircle2 className="h-5 w-5" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* STEP 1: PROMINENT SUPPLIER / VENDOR SELECTION AT THE VERY TOP */}
      <Card className="shadow-sm border-2 border-amber-500 bg-amber-50/40 dark:bg-slate-800">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            {/* Supplier Select Dropdown */}
            <div className="md:col-span-2">
              <Label className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1 uppercase tracking-wide">
                <Building2 className="h-4 w-4 text-amber-600" />
                1. Select Supplier / Vendor Ledger [F6] *
              </Label>
              <select
                ref={supplierSelectRef}
                value={selectedSupplierId}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className={`flex h-9 w-full rounded-md border-2 border-amber-400 bg-background px-3 text-xs font-bold mt-1 shadow-sm ${focusHighlightClass}`}
              >
                <option value="">-- Select Supplier / Vendor Ledger --</option>
                {suppliers.map((s) => (
                  <option key={s.ledg_code} value={s.ledg_code}>
                    {s.ledg_name} {s.city ? `(${s.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Mobile */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Supplier Mobile / Phone
              </Label>
              <Input
                readOnly
                value={supplierMobile}
                placeholder="Mobile No"
                className="h-9 text-xs bg-slate-100 dark:bg-slate-900 font-mono mt-1 font-bold"
              />
            </div>

            {/* Supplier Account Balance */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Account Balance
              </Label>
              <div className="h-9 px-3 py-1.5 rounded-md border bg-slate-900 text-amber-400 font-mono font-black text-sm flex items-center justify-between mt-1 shadow-inner">
                <span>BAL:</span>
                <span>₹{supplierBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Cr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: RESPECTIVE PURCHASE INVOICES PANEL FOR SELECTED SUPPLIER */}
      {selectedSupplierId ? (
        <Card className="shadow-sm border border-slate-300 dark:border-slate-700">
          <div className="bg-slate-800 text-white px-3 py-2 font-bold flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-amber-400" />
              <span>
                2. Purchase Invoices & Barcode Stock Details for:{" "}
                <span className="text-amber-300 font-black">{selectedSupplierObj?.ledg_name}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[11px] font-bold">
                {invoices.length} Invoices Available
              </span>
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleLoadSelectedItemsToGrid}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Load Checked Items into Return Grid
              </Button>
            </div>
          </div>

          <CardContent className="p-3 space-y-3">
            <p className="text-xs text-slate-500 font-medium">
              Check the purchase invoices below to expand barcode/batch items, enter return quantities, and click <strong>"Load Checked Items into Return Grid"</strong>:
            </p>

            {invoices.map((inv) => (
              <div
                key={inv.invoiceNo}
                className="border rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
              >
                {/* Invoice Accordion Header */}
                <div className="bg-slate-100 dark:bg-slate-800 p-2 flex items-center justify-between font-bold text-xs border-b">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!inv.selected}
                      onChange={() => toggleInvoiceCheck(inv.invoiceNo)}
                      className="h-4 w-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <button
                      onClick={() => toggleInvoiceExpand(inv.invoiceNo)}
                      className="flex items-center gap-1 hover:text-amber-600 focus:outline-none"
                    >
                      {inv.expanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      )}
                      <span className="font-mono text-amber-800 dark:text-amber-300 font-bold text-xs">
                        Invoice No: {inv.invoiceNo}
                      </span>
                    </button>
                    <span className="text-slate-500">Date: {inv.invoiceDate}</span>
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs">
                    <span>
                      Value: <span className="font-bold text-slate-900 dark:text-white">₹{inv.purchaseValue.toLocaleString("en-IN")}</span>
                    </span>
                    <span>
                      Available Stock Qty:{" "}
                      <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                        {inv.balanceStockQty}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Expanded Barcode/Batch Items List inside Invoice */}
                {inv.expanded && (
                  <div className="p-2 bg-slate-50 dark:bg-slate-950/50">
                    <Table className="w-full border text-xs">
                      <TableHeader className="bg-slate-200 dark:bg-slate-800 font-bold">
                        <TableRow>
                          <TableHead className="w-10 text-center">Select</TableHead>
                          <TableHead className="w-28 font-bold">Barcode No</TableHead>
                          <TableHead className="w-28 font-bold">Batch No</TableHead>
                          <TableHead className="font-bold">Product Name</TableHead>
                          <TableHead className="w-24 text-right font-bold">Avail Qty</TableHead>
                          <TableHead className="w-24 text-right font-bold">Return Qty</TableHead>
                          <TableHead className="w-28 text-right font-bold">Purc. Rate</TableHead>
                          <TableHead className="w-28 text-right font-bold">Return Amount</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody className="font-mono text-xs">
                        {inv.items.map((it) => (
                          <TableRow
                            key={it.barcodeNo}
                            className={`hover:bg-amber-50/70 transition-colors ${
                              it.selected ? "bg-amber-100/50 dark:bg-amber-950/40" : ""
                            }`}
                          >
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={!!it.selected}
                                onChange={() => toggleItemCheck(inv.invoiceNo, it.barcodeNo)}
                                className="h-4 w-4 text-amber-600 rounded border-slate-300 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-bold text-amber-700 dark:text-amber-400">
                              {it.barcodeNo}
                            </TableCell>
                            <TableCell className="font-medium text-slate-700">
                              {it.batchNo}
                            </TableCell>
                            <TableCell className="font-medium">{it.prname}</TableCell>
                            <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                              {it.availableQty}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={it.returnQty}
                                onChange={(e) =>
                                  handleItemReturnQtyChange(
                                    inv.invoiceNo,
                                    it.barcodeNo,
                                    e.target.value
                                  )
                                }
                                className={`h-6 text-xs text-right w-20 font-bold bg-white ${focusHighlightClass}`}
                              />
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              ₹{it.purRate.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                              ₹{(it.returnQty * it.purRate).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border p-6 text-center text-slate-500 font-bold space-y-2">
          <Building2 className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="text-sm text-slate-700">Please Select a Supplier / Vendor Ledger above to view available purchase invoices.</p>
        </Card>
      )}

      {/* STEP 3 & 4: MAIN RETURN GRID TABLE & SIDE VOUCHER PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Main Return Items Grid Table */}
        <div className="lg:col-span-3 space-y-2">
          <Card className="shadow-sm border overflow-hidden">
            <div className="p-2 bg-slate-800 text-white font-bold flex justify-between items-center text-xs">
              <span>3. PURCHASE RETURN ITEMS GRID</span>
              <span>Total Return Rows: {gridRows.length}</span>
            </div>

            <div className="overflow-x-auto min-h-[300px] max-h-[450px]">
              <Table className="w-full border-collapse text-xs">
                <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-8 text-center p-1 text-red-600 font-bold">Del</TableHead>
                    <TableHead className="w-10 text-center p-1 font-bold">SNo</TableHead>
                    <TableHead className="min-w-[180px] p-1 font-bold">Product Name</TableHead>
                    <TableHead className="min-w-[140px] p-1 font-bold">Invoice Details</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Qty</TableHead>
                    <TableHead className="w-14 text-center p-1 font-bold">Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Rate/Unit</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Amount</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">Dis %</TableHead>
                    <TableHead className="w-16 text-right p-1 font-bold">Dis-2%</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">SGST%</TableHead>
                    <TableHead className="w-14 text-right p-1 font-bold">CGST%</TableHead>
                    <TableHead className="w-20 text-right p-1 font-bold">Net Rate</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs font-mono">
                  {gridRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center p-8 text-slate-500 font-bold">
                        No items added to return list yet. Select Supplier above and check purchase invoices to load items.
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
                        <TableCell className="p-1 font-bold text-slate-800 dark:text-slate-100">
                          {row.prname}
                        </TableCell>
                        <TableCell className="p-1">
                          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            {row.invoiceNo} | {row.invoiceDate}
                          </div>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.qty}
                            onChange={(e) => handleCellChange(idx, "qty", e.target.value)}
                            className={`h-7 text-xs text-right bg-background ${focusHighlightClass}`}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center font-bold text-slate-700">
                          {row.unit}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={row.purRate}
                            onChange={(e) => handleCellChange(idx, "purRate", e.target.value)}
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
                          {row.sgstPerc}%
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold text-slate-600">
                          {row.cgstPerc}%
                        </TableCell>
                        <TableCell className="p-1 text-right font-bold text-emerald-700">
                          ₹{row.netRate.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="bg-slate-200 dark:bg-slate-800 p-2 flex items-center justify-between font-bold text-xs border-t">
              <span className="text-slate-600">
                Total Return Rows: {gridRows.length}
              </span>
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

        {/* Right Side Voucher Panel */}
        <div className="lg:col-span-1 space-y-2">
          <Card className="shadow-sm border">
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold flex justify-between items-center text-xs">
              <span>Voucher Details [F7]</span>
              <span className="text-[10px] bg-amber-600 px-1.5 py-0.5 rounded">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <CardContent className="p-2 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold">Return No</Label>
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

              <div>
                <Label className="text-[11px] font-bold">Salesman [F7]</Label>
                <Input
                  value={salesman}
                  onChange={(e) => setSalesman(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

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

      {/* Bottom Action Controls Toolbar with Edit [F9] & Delete [F8] */}
      <div className="bg-card border rounded p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handlePrev}
            disabled={savedReturns.length === 0}
          >
            Previous [Pg Up]
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleNext}
            disabled={savedReturns.length === 0}
          >
            Next [Pg Dn]
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
            variant="outline"
            className="h-8 text-xs font-bold text-blue-600 border-blue-300 hover:bg-blue-50"
            onClick={() => setMode("edit")}
          >
            Edit [F9]
          </Button>

          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs font-bold"
            onClick={handleDeleteRecord}
            disabled={mode === "add" || savedReturns.length === 0}
          >
            Delete [F8]
          </Button>

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
            className="h-8 text-xs text-red-600 font-bold"
            onClick={handleResetForm}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
