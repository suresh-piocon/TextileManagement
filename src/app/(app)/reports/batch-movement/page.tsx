"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Boxes,
  PackageCheck,
  PackageX,
  Building2,
  CheckSquare,
  Square,
} from "lucide-react";
import seedProductsData from "@/lib/data/batch-movement-seed.json";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BatchItem {
  sno: number;
  batchNo: string;
  inward: number;
  outward: number;
  closing: number;
  purcRate: number;
  costRate: number;
  salesRate: number;
  vendorName: string;
  checked?: boolean;
}

interface ProductGroup {
  productName: string;
  batches: BatchItem[];
  totals: {
    count: number;
    inward: number;
    outward: number;
    closing: number;
  };
}

export default function BatchMovementReportPage() {
  const { company } = useApp();
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ProductGroup[]>(seedProductsData as ProductGroup[]);

  // Filters State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [stockStatus, setStockStatus] = useState<string>("all"); // all | in_stock | sold
  const [selectedBatches, setSelectedBatches] = useState<Record<string, boolean>>({});

  // Fetch Live Database Data with Seed Fallback
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!company?.frm_code) {
        setData(seedProductsData as ProductGroup[]);
        setLoading(false);
        return;
      }

      // Query bar_temp table
      const { data: barRows, error } = await supabase
        .from("bar_temp")
        .select("*, product:prcode(prd_name, hsn_code), ledger:cr_code(ledg_name)")
        .eq("frm_code", company.frm_code)
        .order("bar_ref_id", { ascending: true });

      if (error || !barRows || barRows.length === 0) {
        // Fallback to imported Excel seed data
        setData(seedProductsData as ProductGroup[]);
      } else {
        // Group database rows by product name
        const groupMap = new Map<string, BatchItem[]>();

        barRows.forEach((row: any, idx: number) => {
          const prdName =
            row.product?.prd_name ||
            row.grp_name ||
            "DHOTHIES SET-50072090";
          const hsn = row.product?.hsn_code ? `-${row.product.hsn_code}` : "";
          const fullPrdName = `DHOTHIES ${prdName}${hsn}`;

          const isSold = row.sold_status === "S";
          const qty = row.qty || 1;
          const inward = qty;
          const outward = isSold ? qty : 0;
          const closing = inward - outward;

          const batchItem: BatchItem = {
            sno: idx + 1,
            batchNo: row.bar_no,
            inward: inward,
            outward: outward,
            closing: closing,
            purcRate: row.pc_pur_rate || 0,
            costRate: row.cost_rate || row.pc_pur_rate || 0,
            salesRate: row.pc_sale_rate || 0,
            vendorName: row.ledger?.ledg_name || "SUPPLIER VENDOR",
          };

          if (!groupMap.has(fullPrdName)) {
            groupMap.set(fullPrdName, []);
          }
          groupMap.get(fullPrdName)!.push(batchItem);
        });

        const liveGroups: ProductGroup[] = Array.from(groupMap.entries()).map(
          ([productName, batches]) => {
            const inward = batches.reduce((sum, b) => sum + b.inward, 0);
            const outward = batches.reduce((sum, b) => sum + b.outward, 0);
            const closing = batches.reduce((sum, b) => sum + b.closing, 0);
            return {
              productName,
              batches,
              totals: {
                count: batches.length,
                inward,
                outward,
                closing,
              },
            };
          }
        );

        if (liveGroups.length > 0) {
          setData(liveGroups);
        } else {
          setData(seedProductsData as ProductGroup[]);
        }
      }
    } catch (e) {
      console.error("Error loading barcode movement report:", e);
      setData(seedProductsData as ProductGroup[]);
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract distinct products list for filter dropdown
  const productOptions = useMemo(() => {
    return Array.from(new Set(data.map((p) => p.productName))).sort();
  }, [data]);

  // Extract distinct vendors list for filter dropdown
  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((p) => {
      p.batches.forEach((b) => {
        if (b.vendorName) set.add(b.vendorName.trim());
      });
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtered dataset calculation
  const filteredData = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return data
      .map((group) => {
        // Filter product name dropdown
        if (selectedProduct && group.productName !== selectedProduct) {
          return null;
        }

        const matchingBatches = group.batches.filter((batch) => {
          // Vendor filter
          if (
            selectedVendor &&
            batch.vendorName.trim().toLowerCase() !==
              selectedVendor.trim().toLowerCase()
          ) {
            return false;
          }

          // Stock status filter
          if (stockStatus === "in_stock" && batch.closing <= 0) return false;
          if (stockStatus === "sold" && batch.outward <= 0) return false;

          // Search term filter
          if (search) {
            const inBatchNo = batch.batchNo.toLowerCase().includes(search);
            const inVendor = batch.vendorName.toLowerCase().includes(search);
            const inPrd = group.productName.toLowerCase().includes(search);
            if (!inBatchNo && !inVendor && !inPrd) return false;
          }

          return true;
        });

        if (matchingBatches.length === 0) return null;

        const inward = matchingBatches.reduce((s, b) => s + b.inward, 0);
        const outward = matchingBatches.reduce((s, b) => s + b.outward, 0);
        const closing = matchingBatches.reduce((s, b) => s + b.closing, 0);

        return {
          productName: group.productName,
          batches: matchingBatches,
          totals: {
            count: matchingBatches.length,
            inward,
            outward,
            closing,
          },
        };
      })
      .filter(Boolean) as ProductGroup[];
  }, [data, searchTerm, selectedProduct, selectedVendor, stockStatus]);

  // KPI Summaries
  const kpis = useMemo(() => {
    let totalBatches = 0;
    let totalInward = 0;
    let totalOutward = 0;
    let totalClosing = 0;
    let totalPurcValue = 0;
    let totalSalesValue = 0;

    filteredData.forEach((g) => {
      totalBatches += g.batches.length;
      g.batches.forEach((b) => {
        totalInward += b.inward;
        totalOutward += b.outward;
        totalClosing += b.closing;
        totalPurcValue += b.closing * b.purcRate;
        totalSalesValue += b.closing * b.salesRate;
      });
    });

    return {
      productCount: filteredData.length,
      totalBatches,
      totalInward,
      totalOutward,
      totalClosing,
      totalPurcValue,
      totalSalesValue,
    };
  }, [filteredData]);

  // Checkbox toggle handler
  const toggleSelectBatch = (batchNo: string) => {
    setSelectedBatches((prev) => ({
      ...prev,
      [batchNo]: !prev[batchNo],
    }));
  };

  const toggleSelectAll = () => {
    const allSelected = filteredData.every((g) =>
      g.batches.every((b) => selectedBatches[b.batchNo])
    );
    const updated: Record<string, boolean> = {};
    filteredData.forEach((g) => {
      g.batches.forEach((b) => {
        updated[b.batchNo] = !allSelected;
      });
    });
    setSelectedBatches(updated);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedProduct("");
    setSelectedVendor("");
    setStockStatus("all");
  };

  // Export to Excel (.xlsx / .xls) matching original Batch Movement format
  const exportToExcel = () => {
    const rows: any[][] = [];

    // Title Row
    rows.push(["Batch Movement"]);
    // Headers Row
    rows.push([
      "Print",
      "SNo",
      "Batch No",
      "Inward",
      "Outward",
      "Closing",
      "Purc.Rate",
      "Cost Rate",
      "",
      "Sales Rate",
      "Vendor Name",
    ]);

    let runningSno = 1;

    filteredData.forEach((group) => {
      // Product Name Header
      rows.push([`Product Name: ${group.productName}`]);

      group.batches.forEach((batch) => {
        rows.push([
          "",
          runningSno++,
          batch.batchNo,
          batch.inward,
          batch.outward,
          batch.closing,
          batch.purcRate,
          batch.costRate,
          "",
          batch.salesRate,
          batch.vendorName,
        ]);
      });

      // Product Subtotal Row
      rows.push([
        "",
        "",
        group.totals.count,
        group.totals.inward,
        group.totals.outward,
        group.totals.closing,
      ]);
    });

    // Grand Total Row
    rows.push([
      "",
      "",
      kpis.totalBatches,
      kpis.totalInward,
      kpis.totalOutward,
      kpis.totalClosing,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 4 },
      { wch: 12 },
      { wch: 32 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Movement");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Batch_Movement_Report_${dateStr}.xlsx`);
  };

  // Export to PDF (.pdf) matching original Batch Movement format
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const companyTitle = company?.frm_name || "RetailTex - Textile Management";
    const dateStr = new Date().toLocaleDateString("en-IN");

    // PDF Header Title Bar
    doc.setFillColor(245, 158, 11); // Amber 500
    doc.rect(0, 0, 297, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BATCH MOVEMENT REPORT", 14, 12);

    doc.setFontSize(9);
    doc.text(`Company: ${companyTitle}  |  Date: ${dateStr}`, 180, 12);

    // Summary KPIs Box
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 22, 269, 12, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Products: ${kpis.productCount}   |   Total Batches: ${kpis.totalBatches}   |   Inward: ${kpis.totalInward}   |   Outward: ${kpis.totalOutward}   |   Closing Stock: ${kpis.totalClosing}   |   Valuation: Rs.${kpis.totalPurcValue.toLocaleString('en-IN')}`,
      18,
      30
    );

    let startY = 38;
    let runningSno = 1;

    filteredData.forEach((group) => {
      // Product Name Sub-header
      doc.setFillColor(226, 232, 240);
      doc.rect(14, startY, 269, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`Product Name: ${group.productName}`, 18, startY + 4.5);

      startY += 7;

      const bodyData = group.batches.map((b) => [
        runningSno++,
        b.batchNo,
        b.inward,
        b.outward,
        b.closing,
        `Rs.${b.purcRate.toFixed(2)}`,
        `Rs.${b.costRate.toFixed(2)}`,
        `Rs.${b.salesRate.toFixed(2)}`,
        b.vendorName,
      ]);

      // Add Subtotal row for product
      bodyData.push([
        "",
        "SUBTOTAL",
        group.totals.inward,
        group.totals.outward,
        group.totals.closing,
        "",
        "",
        "",
        `Total Batches: ${group.totals.count}`,
      ]);

      autoTable(doc, {
        startY: startY,
        head: [
          [
            "SNo",
            "Batch No",
            "Inward",
            "Outward",
            "Closing",
            "Purc.Rate",
            "Cost Rate",
            "Sales Rate",
            "Vendor Name",
          ],
        ],
        body: bodyData,
        theme: "grid",
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 25, fontStyle: "bold" },
          2: { cellWidth: 18, halign: "right" },
          3: { cellWidth: 18, halign: "right" },
          4: { cellWidth: 18, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 25, halign: "right" },
          6: { cellWidth: 25, halign: "right" },
          7: { cellWidth: 25, halign: "right", fontStyle: "bold" },
          8: { cellWidth: "auto" },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 4;
    });

    // Grand Total Row Box at end
    if (startY > 180) {
      doc.addPage();
      startY = 20;
    }

    doc.setFillColor(245, 158, 11);
    doc.rect(14, startY, 269, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `GRAND TOTAL -> Batches: ${kpis.totalBatches}   Inward: ${kpis.totalInward}   Outward: ${kpis.totalOutward}   Closing Stock: ${kpis.totalClosing}`,
      18,
      startY + 5.5
    );

    const pdfDate = new Date().toISOString().split("T")[0];
    doc.save(`Batch_Movement_Report_${pdfDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 space-y-4 font-sans text-xs">
      {/* Top Banner Title Header */}
      <div className="bg-amber-500 text-white px-4 py-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white text-amber-600 rounded-full w-8 h-8 flex items-center justify-center shadow">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Batch Movement Report</h1>
            <p className="text-xs text-amber-100">
              Track inward, outward, closing stock, rates, and suppliers per barcode batch
            </p>
          </div>
        </div>

        {/* Action Download Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white text-slate-800 hover:bg-slate-100 font-bold border-slate-300"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow"
            onClick={exportToExcel}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            Download Excel (.xls)
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold shadow"
            onClick={exportToPDF}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Download PDF (.pdf)
          </Button>
        </div>
      </div>

      {/* KPI Cards Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Products</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{kpis.productCount}</p>
            </div>
            <Boxes className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total Batches</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {kpis.totalBatches.toLocaleString()}
              </p>
            </div>
            <PackageCheck className="h-5 w-5 text-indigo-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Inward Qty</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {kpis.totalInward.toLocaleString()}
              </p>
            </div>
            <PackageCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Outward Qty</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {kpis.totalOutward.toLocaleString()}
              </p>
            </div>
            <PackageX className="h-5 w-5 text-rose-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Closing Stock</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {kpis.totalClosing.toLocaleString()}
              </p>
            </div>
            <Boxes className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Stock Valuation</p>
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300 font-mono">
                ₹{kpis.totalPurcValue.toLocaleString("en-IN")}
              </p>
            </div>
            <Building2 className="h-5 w-5 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Control Section */}
      <Card className="shadow-sm">
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Search Input */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1">
                <Search className="h-3.5 w-3.5 text-amber-600" />
                Search Batch / Vendor / Product
              </Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search KS01620 or Vendor..."
                className="h-8 text-xs bg-background mt-1 font-mono"
              />
            </div>

            {/* Product Filter Dropdown */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-amber-600" />
                Filter by Product Name
              </Label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Products ({productOptions.length})</option>
                {productOptions.map((prd) => (
                  <option key={prd} value={prd}>
                    {prd}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor Filter Dropdown */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                Filter by Vendor Name
              </Label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Vendors ({vendorOptions.length})</option>
                {vendorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <Label className="text-xs font-bold flex items-center gap-1">
                <Boxes className="h-3.5 w-3.5 text-amber-600" />
                Stock Status
              </Label>
              <div className="flex gap-2 mt-1">
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value)}
                  className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">All Batches</option>
                  <option value="in_stock">Closing Stock &gt; 0 (In Stock)</option>
                  <option value="sold">Outward &gt; 0 (Sold)</option>
                </select>
                {(searchTerm || selectedProduct || selectedVendor || stockStatus !== "all") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-red-600 font-bold"
                    onClick={handleResetFilters}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Batch Movement Report Table */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="p-3 bg-slate-800 text-white font-bold flex justify-between items-center text-xs">
          <span>BATCH MOVEMENT REPORT DETAILS</span>
          <span>
            Showing {filteredData.length} Products ({kpis.totalBatches} Batches)
          </span>
        </div>

        <div className="overflow-x-auto min-h-[400px] max-h-[650px]">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-bold">
              Loading Batch Movement Data...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold">
              No batch movement records found matching selected filters.
            </div>
          ) : (
            <Table className="w-full border-collapse text-xs">
              <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-10 text-center p-1">
                    <button
                      onClick={toggleSelectAll}
                      className="hover:opacity-75 focus:outline-none"
                      title="Select / Deselect All"
                    >
                      {filteredData.every((g) =>
                        g.batches.every((b) => selectedBatches[b.batchNo])
                      ) ? (
                        <CheckSquare className="h-4 w-4 text-amber-600 mx-auto" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 mx-auto" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-12 text-center p-1 font-bold">SNo</TableHead>
                  <TableHead className="w-32 p-1 font-bold">Batch No</TableHead>
                  <TableHead className="w-24 text-right p-1 font-bold">Inward</TableHead>
                  <TableHead className="w-24 text-right p-1 font-bold">Outward</TableHead>
                  <TableHead className="w-24 text-right p-1 font-bold">Closing</TableHead>
                  <TableHead className="w-28 text-right p-1 font-bold">Purc.Rate</TableHead>
                  <TableHead className="w-28 text-right p-1 font-bold">Cost Rate</TableHead>
                  <TableHead className="w-28 text-right p-1 font-bold">Sales Rate</TableHead>
                  <TableHead className="p-1 font-bold">Vendor Name</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {filteredData.map((group, gIdx) => (
                  <div key={gIdx} className="contents">
                    {/* Product Name Section Header Row */}
                    <TableRow className="bg-slate-100 dark:bg-slate-800/80 font-bold border-t-2 border-b border-slate-300 dark:border-slate-700">
                      <TableCell colSpan={10} className="py-2 px-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
                            Product Name: {group.productName}
                          </span>
                          <div className="flex gap-4 items-center text-[11px] font-mono">
                            <span>
                              Batches:{" "}
                              <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white font-bold">
                                {group.totals.count}
                              </span>
                            </span>
                            <span>
                              Inward:{" "}
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                {group.totals.inward}
                              </span>
                            </span>
                            <span>
                              Outward:{" "}
                              <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
                                {group.totals.outward}
                              </span>
                            </span>
                            <span>
                              Closing:{" "}
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                {group.totals.closing}
                              </span>
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Batch Rows for this product */}
                    {group.batches.map((batch) => {
                      const isChecked = !!selectedBatches[batch.batchNo];
                      return (
                        <TableRow
                          key={batch.batchNo}
                          className={`hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors ${
                            isChecked ? "bg-amber-100/60 dark:bg-amber-950/50" : ""
                          }`}
                        >
                          <TableCell className="text-center p-1">
                            <button
                              onClick={() => toggleSelectBatch(batch.batchNo)}
                              className="hover:opacity-75 focus:outline-none"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-amber-600 mx-auto" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300 mx-auto" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center font-mono p-1 text-slate-500">
                            {batch.sno}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-amber-700 dark:text-amber-400 p-1">
                            {batch.batchNo}
                          </TableCell>
                          <TableCell className="text-right font-mono p-1">
                            {batch.inward}
                          </TableCell>
                          <TableCell className="text-right font-mono p-1">
                            {batch.outward}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white p-1">
                            {batch.closing}
                          </TableCell>
                          <TableCell className="text-right font-mono p-1">
                            ₹{batch.purcRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono p-1">
                            ₹{batch.costRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 p-1">
                            ₹{batch.salesRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="p-1 font-medium text-slate-700 dark:text-slate-300">
                            {batch.vendorName}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Product Subtotal Summary Row */}
                    <TableRow className="bg-slate-200/60 dark:bg-slate-800/60 font-bold border-b-2 border-slate-300 dark:border-slate-700 text-xs">
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="font-bold text-slate-700 dark:text-slate-300 p-1.5">
                        Subtotal ({group.totals.count} Batches)
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold p-1.5 text-emerald-700 dark:text-emerald-400">
                        {group.totals.inward}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold p-1.5 text-rose-700 dark:text-rose-400">
                        {group.totals.outward}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold p-1.5 text-amber-700 dark:text-amber-400">
                        {group.totals.closing}
                      </TableCell>
                      <TableCell colSpan={4}></TableCell>
                    </TableRow>
                  </div>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Grand Total Sticky Summary Footer Bar */}
        <div className="bg-amber-500 text-white p-3 border-t flex flex-wrap items-center justify-between font-bold text-xs shadow-inner">
          <div className="flex items-center gap-3">
            <Boxes className="h-5 w-5" />
            <span className="text-sm tracking-wide uppercase">GRAND TOTAL REPORT SUMMARY</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-sm">
            <span>
              Batches: <span className="bg-amber-600 px-2 py-0.5 rounded">{kpis.totalBatches}</span>
            </span>
            <span>
              Inward: <span className="bg-amber-600 px-2 py-0.5 rounded">{kpis.totalInward}</span>
            </span>
            <span>
              Outward: <span className="bg-amber-600 px-2 py-0.5 rounded">{kpis.totalOutward}</span>
            </span>
            <span>
              Closing Stock:{" "}
              <span className="bg-white text-amber-900 px-2 py-0.5 rounded font-black">
                {kpis.totalClosing}
              </span>
            </span>
            <span>
              Purc Valuation:{" "}
              <span className="bg-amber-600 px-2 py-0.5 rounded">
                ₹{kpis.totalPurcValue.toLocaleString("en-IN")}
              </span>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
