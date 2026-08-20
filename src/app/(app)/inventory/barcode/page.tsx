'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

function BarcodePrintingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();

  const paramInvNo = searchParams.get('inv_no') || '';

  const [records, setRecords] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [selectedInvNo, setSelectedInvNo] = useState<string>(paramInvNo);
  const [activeInvoiceInfo, setActiveInvoiceInfo] = useState<any | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filters
  const [barcodeName, setBarcodeName] = useState('2StickerFixedPrice');
  const [printerName, setPrinterName] = useState('Default System Printer (System Dialog)');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Barcodes & Invoice Details
  const fetchBarcodes = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      // 1. Fetch available invoices for dropdown
      const { data: invData } = await supabase
        .from('pur_mast')
        .select('pm_ref_no, pm_bill_ref_no, pm_bill_date, pm_tot_qty')
        .eq('pm_frm_code', company.frm_code)
        .order('pm_ref_no', { ascending: false });

      setInvoicesList(invData || []);

      // Determine target invoice number
      const targetInv = selectedInvNo || (invData && invData.length > 0 ? (invData[0].pm_bill_ref_no || String(invData[0].pm_ref_no)) : '');
      if (!selectedInvNo && targetInv) {
        setSelectedInvNo(targetInv);
      }

      // 2. Fetch bar_temp records filtered by invoice if selected
      let query = supabase
        .from('bar_temp')
        .select('*, product(prd_code, prd_name, sales_price, rate, hsn_code, units, product_group(grp_name))')
        .eq('frm_code', company.frm_code)
        .order('bar_ref_id', { ascending: false });

      if (targetInv && !showAllProducts) {
        query = query.eq('inv_no', targetInv);
      }

      const { data: barData, error } = await query;
      if (error) throw error;

      const barList = barData || [];
      setRecords(barList);
      setSelectedIds(new Set(barList.map(r => r.bar_ref_id)));

      // 3. Find invoice summary info
      const matchingInv = invData?.find(i => String(i.pm_bill_ref_no) === String(targetInv) || String(i.pm_ref_no) === String(targetInv));
      if (matchingInv) {
        setActiveInvoiceInfo({
          invNo: matchingInv.pm_bill_ref_no || matchingInv.pm_ref_no,
          invDate: matchingInv.pm_bill_date ? new Date(matchingInv.pm_bill_date).toISOString().split('T')[0] : '2026-08-20',
          totQty: matchingInv.pm_tot_qty || barList.reduce((sum, r) => sum + (r.qty || 1), 0)
        });
      } else if (barList.length > 0) {
        setActiveInvoiceInfo({
          invNo: targetInv || barList[0].inv_no || '130',
          invDate: barList[0].inv_date ? new Date(barList[0].inv_date).toISOString().split('T')[0] : '2026-08-20',
          totQty: barList.reduce((sum, r) => sum + (r.qty || 1), 0)
        });
      } else {
        setActiveInvoiceInfo(null);
      }

    } catch (e: any) {
      toast({ title: 'Error fetching barcodes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, selectedInvNo, showAllProducts, supabase, toast]);

  useEffect(() => {
    fetchBarcodes();
  }, [fetchBarcodes]);

  const toggleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(new Set(records.map(r => r.bar_ref_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No barcodes selected for printing', variant: 'destructive' });
      return;
    }
    window.print();
  };

  // Close form -> return to Purchase Transaction Screen of respective Invoice No
  const handleCloseForm = () => {
    const returnInvNo = selectedInvNo || activeInvoiceInfo?.invNo || '';
    if (returnInvNo) {
      router.push(`/transaction/purchase?inv_no=${encodeURIComponent(returnInvNo)}`);
    } else {
      router.push('/transaction/purchase');
    }
  };

  const filteredRecords = records.filter(r =>
    r.bar_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.product?.prd_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.product?.prd_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.inv_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSelectedStickers = Array.from(selectedIds).reduce((sum, id) => {
    const rec = records.find(r => r.bar_ref_id === id);
    return sum + (rec ? (rec.print_count || 1) : 0);
  }, 0);

  const totalStickersCount = records.reduce((sum, r) => sum + (r.print_count || 1), 0);
  const totalItemQty = records.reduce((sum, r) => sum + (r.qty || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-3 space-y-3 font-sans text-xs">
      {/* Top Banner Header */}
      <div className="bg-amber-500 text-white font-bold px-4 py-2 flex justify-between items-center rounded shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-white text-amber-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">➜</div>
          <span className="text-xl">Barcode Printing</span>
          {activeInvoiceInfo && (
            <span className="bg-amber-600/80 px-2 py-0.5 rounded font-mono text-xs">
              Invoice #{activeInvoiceInfo.invNo}
            </span>
          )}
        </div>
        <button 
          onClick={handleCloseForm}
          className="text-sm cursor-pointer hover:bg-amber-600 px-2 py-0.5 rounded transition"
          title="Close & Return to Purchase Entry"
        >
          ✕
        </button>
      </div>

      {/* Invoice Summary Header Card matching user request */}
      <div className="bg-amber-500/10 border border-amber-300 dark:border-amber-700/50 rounded p-3 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Select Invoice:</span>
            <select
              className="h-7 rounded border border-input bg-background px-2 text-xs font-bold font-mono"
              value={selectedInvNo}
              onChange={e => setSelectedInvNo(e.target.value)}
            >
              {invoicesList.map(inv => {
                const invNoStr = inv.pm_bill_ref_no || String(inv.pm_ref_no);
                return (
                  <option key={inv.pm_ref_no} value={invNoStr}>
                    Invoice #{invNoStr} ({inv.pm_bill_date ? new Date(inv.pm_bill_date).toISOString().split('T')[0] : ''})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-background border px-3 py-1 rounded shadow-sm">
            <span className="text-muted-foreground">Invoice No:</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-sm">
              {activeInvoiceInfo?.invNo || selectedInvNo || '-'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-background border px-3 py-1 rounded shadow-sm">
            <span className="text-muted-foreground">Invoice Date:</span>
            <span className="font-mono font-semibold">
              {activeInvoiceInfo?.invDate || '2026-08-20'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-background border px-3 py-1 rounded shadow-sm">
            <span className="text-muted-foreground">Tot Qty:</span>
            <span className="font-mono text-emerald-600 font-bold text-sm">
              {(activeInvoiceInfo?.totQty || totalItemQty || 0).toFixed(2)}
            </span>
          </div>
        </div>

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCloseForm}>
          ← Back to Purchase Entry
        </Button>
      </div>

      {/* Top Filter Controls Bar */}
      <div className="bg-card border rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">Barcode Name</Label>
            <select
              className="h-7 rounded border border-input bg-background px-2 text-xs font-bold"
              value={barcodeName}
              onChange={e => setBarcodeName(e.target.value)}
            >
              <option value="2StickerFixedPrice">2StickerFixedPrice</option>
              <option value="[Default]">[Default]</option>
            </select>
          </div>

          {/* Printer Selection Dropdown - Installed System Printers */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">Printer Name</Label>
            <select
              className="h-7 rounded border border-input bg-background px-2 text-xs min-w-[220px] font-medium"
              value={printerName}
              onChange={e => setPrinterName(e.target.value)}
            >
              <option value="Default System Printer (System Dialog)">Default System Printer (System Dialog)</option>
              <option value="TVS LP 46 Neo">TVS LP 46 Neo (Thermal)</option>
              <option value="Zebra ZD220 / ZT230">Zebra ZD220 / ZT230 (Thermal)</option>
              <option value="TSC TE244 / TTP-244 Pro">TSC TE244 / TTP-244 Pro</option>
              <option value="Godex G500">Godex G500 (Thermal)</option>
              <option value="Citizen CL-S621">Citizen CL-S621</option>
              <option value="Generic / Text Only">Generic / Text Only Printer</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={showAllProducts}
              onChange={e => setShowAllProducts(e.target.checked)}
            />
            Show All Invoices Barcodes
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter Batch No / Product..."
            className="h-7 text-xs bg-background w-48"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={fetchBarcodes}>
            Show [F5]
          </Button>
          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handlePrint}>
            Print [F11]
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            Attach Image
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            Barcode Field List
          </Button>
        </div>
      </div>

      {/* Main Barcode Data Grid */}
      <div className="bg-card border rounded overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[400px] max-h-[550px]">
          <Table className="w-full border-collapse text-xs">
            <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0">
              <TableRow>
                <TableHead className="w-10 text-center p-1">Select</TableHead>
                <TableHead className="w-10 text-center p-1">SNo</TableHead>
                <TableHead className="p-1">Product Code</TableHead>
                <TableHead className="p-1 min-w-[110px]">Batch No</TableHead>
                <TableHead className="p-1 min-w-[180px]">Product Name</TableHead>
                <TableHead className="w-16 text-center p-1 bg-lime-500 text-white dark:bg-lime-600">Print Count</TableHead>
                <TableHead className="p-1">Inv Date</TableHead>
                <TableHead className="p-1">Invoice No</TableHead>
                <TableHead className="w-16 text-center p-1">Entry SNo</TableHead>
                <TableHead className="w-16 text-right p-1 bg-lime-500 text-white dark:bg-lime-600">Qty</TableHead>
                <TableHead className="p-1">Group</TableHead>
                <TableHead className="p-1">Category</TableHead>
                <TableHead className="p-1">Brand</TableHead>
                <TableHead className="p-1">Unit Name</TableHead>
                <TableHead className="text-right p-1">Cost Rate</TableHead>
                <TableHead className="text-right p-1">Purchase Rate</TableHead>
                <TableHead className="text-right p-1">Mark Up</TableHead>
                <TableHead className="text-right p-1">Margin</TableHead>
                <TableHead className="text-right p-1">Sales Rate</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={19} className="text-center py-8">Loading generated barcodes...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={19} className="text-center py-8">
                    No generated barcodes found for Invoice #{selectedInvNo || '130'}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((r, idx) => {
                  const isChecked = selectedIds.has(r.bar_ref_id);
                  const prdCode = r.product?.prd_code || `S${r.prcode || idx + 1}`;
                  const prdName = r.product?.prd_name || 'Stock Item';
                  const purchaseRate = r.pc_pur_rate || r.product?.rate || 0;
                  const salesRate = r.pc_sale_rate || r.product?.sales_price || purchaseRate;
                  const costRate = r.cost_rate || purchaseRate;
                  const markup = r.markup || (costRate > 0 && salesRate > costRate ? Number((((salesRate - costRate) / costRate) * 100).toFixed(1)) : 0);
                  const margin = r.margin || (salesRate > 0 ? Number((((salesRate - costRate) / salesRate) * 100).toFixed(2)) : 0);
                  const groupName = r.grp_name || r.product?.product_group?.grp_name || 'PURE SILK';

                  return (
                    <TableRow key={r.bar_ref_id} className={`hover:bg-muted/40 ${isChecked ? 'bg-muted/20' : ''}`}>
                      <TableCell className="text-center p-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(r.bar_ref_id)}
                          className="rounded border-input"
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono p-1">{idx + 1}</TableCell>
                      <TableCell className="font-mono font-medium p-1">{prdCode}</TableCell>
                      <TableCell className="font-mono font-bold text-amber-600 dark:text-amber-400 p-1">{r.bar_no}</TableCell>
                      <TableCell className="font-medium p-1">{prdName}</TableCell>
                      <TableCell className="text-center font-mono font-bold bg-lime-400/30 text-lime-900 dark:text-lime-200 p-1">
                        {r.print_count || 1}
                      </TableCell>
                      <TableCell className="font-mono p-1">
                        {r.inv_date ? new Date(r.inv_date).toISOString().split('T')[0] : '2026-08-20'}
                      </TableCell>
                      <TableCell className="font-mono p-1">{r.inv_no || '-'}</TableCell>
                      <TableCell className="text-center font-mono p-1">{r.entry_sno || 1}</TableCell>
                      <TableCell className="text-right font-mono font-bold bg-lime-400/30 text-lime-900 dark:text-lime-200 p-1">
                        {(r.qty || 1).toFixed(2)}
                      </TableCell>
                      <TableCell className="p-1">{groupName}</TableCell>
                      <TableCell className="p-1">{r.category || 'WOMENS WEAR'}</TableCell>
                      <TableCell className="p-1">{r.brand || '-'}</TableCell>
                      <TableCell className="p-1">{r.unit_name || r.product?.units || 'NOS'}</TableCell>
                      <TableCell className="text-right font-mono p-1">₹{costRate.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono p-1">₹{purchaseRate.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono p-1">{markup}%</TableCell>
                      <TableCell className="text-right font-mono p-1">{margin}%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 p-1">₹{salesRate.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Grid Footer Summary Bar */}
        <div className="bg-slate-200 dark:bg-slate-800 p-2 border-t flex flex-wrap items-center justify-between font-bold text-xs">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-xs bg-background" onClick={() => toggleSelectAll(true)}>
              All
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-xs bg-background" onClick={() => toggleSelectAll(false)}>
              None
            </Button>
            <span className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-3 py-1 rounded border font-mono">
              Total Stickers : {totalSelectedStickers} / {totalStickersCount}
            </span>
          </div>

          <div className="font-mono text-muted-foreground">
            Total Generated Barcodes: {records.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarcodePrintingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs">Loading Barcode Printing Screen...</div>}>
      <BarcodePrintingContent />
    </Suspense>
  );
}
