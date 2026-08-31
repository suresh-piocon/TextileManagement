'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// ==========================================
// Vector QR Code SVG Component for Thermal Clarity
// ==========================================
function QRCodeDisplay({ text, size = 62 }: { text: string; size?: number }) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    if (!text) return;
    QRCode.toString(text, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((svg) => {
        setSvgContent(svg);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });
  }, [text]);

  if (!svgContent) {
    return <div style={{ width: `${size}px`, height: `${size}px` }} className="bg-slate-200 animate-pulse rounded" />;
  }

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className="flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

// ==========================================
// 50mm x 25mm Individual Sticker Label Card (Design matching Reference Image 2)
// ==========================================
function BarcodeStickerCard({ sticker }: { sticker: any }) {
  if (!sticker) {
    return (
      <div 
        style={{ width: '50mm', height: '25mm' }} 
        className="opacity-0 pointer-events-none" 
      />
    );
  }

  return (
    <div
      style={{
        width: '50mm',
        height: '25mm',
        boxSizing: 'border-box',
        padding: '1.2mm 2mm 1.2mm 1.5mm',
      }}
      className="bg-white text-black font-sans border border-slate-300 rounded flex flex-col justify-between overflow-hidden select-none print:border-0 print:rounded-none"
    >
      {/* Top Section: QR Code on Left + Price & Composite Tracking Code on Right */}
      <div className="flex items-center justify-between gap-1 flex-1 min-h-0">
        {/* Crisp Vector QR Code */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <QRCodeDisplay text={sticker.trackingCode || sticker.batchNo} size={54} />
        </div>

        {/* Price & Composite Tracking Code */}
        <div className="flex-1 flex flex-col justify-center items-end text-right pl-1 min-w-0">
          <div className="font-black text-[13px] leading-tight tracking-tight text-black whitespace-nowrap">
            RS.{Number(sticker.salesRate || 0).toFixed(2)}
          </div>
          <div className="font-bold font-mono text-[11px] leading-tight tracking-wide text-black mt-0.5 whitespace-nowrap">
            {sticker.trackingCode}
          </div>
        </div>
      </div>

      {/* Bottom Row: Batch No (Left) + Fixed Rate (Right) */}
      <div className="flex items-center justify-between pt-0.5 text-black font-bold border-t border-dotted border-slate-300 print:border-none">
        <span className="font-mono text-[10px] leading-none tracking-tight">
          {sticker.batchNo}
        </span>
        <span className="text-[10px] leading-none tracking-tight font-semibold">
          {sticker.rateType || 'Fixed Rate'}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// Helper function to build composite tracking code
// Pattern: [Productcode][Year(2-digit)][Month(2-digit)][EntrySno][Sno] -> Ex: 103260821
// ==========================================
function buildTrackingCode(r: any, idx: number, fallbackInvDate?: string): string {
  // 1. Product code (e.g. 103)
  const rawPrd = String(r.product?.prd_code || r.prcode || '103').replace(/^[^\d]+/, '') || '103';

  // 2. Date YY and MM
  const invDateStr = r.inv_date || fallbackInvDate || '2026-08-31';
  let yy = '26';
  let mm = '08';
  try {
    const d = new Date(invDateStr);
    if (!isNaN(d.getTime())) {
      yy = String(d.getFullYear()).slice(-2);
      mm = String(d.getMonth() + 1).padStart(2, '0');
    }
  } catch (e) {
    // fallback
  }

  // 3. Entry SNo (e.g. 2)
  const entrySno = String(r.entry_sno || 2);

  // 4. SNo (e.g. 1)
  const sno = String(r.sno || (idx + 1));

  // Ex: 103 + 26 + 08 + 2 + 1 = 103260821
  return `${rawPrd}${yy}${mm}${entrySno}${sno}`;
}

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
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Filters
  const [barcodeName, setBarcodeName] = useState('2StickerFixedPrice');
  const [printerName, setPrinterName] = useState('Default System Printer (System Dialog)');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Barcodes & Invoice Details with Deduplicated Selector & Qty Alignment
  const fetchBarcodes = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      // 1. Fetch available purchase invoices for selector
      const { data: invData } = await supabase
        .from('pur_mast')
        .select('pm_ref_no, pm_rec_no, pm_bill_ref_no, pm_bill_date, pm_tot_qty, pm_cr_code')
        .eq('pm_frm_code', company.frm_code)
        .order('pm_ref_no', { ascending: false });

      // Deduplicate invoices list by invoice reference number to prevent duplicate dropdown options
      const uniqueInvoices = Array.from(
        new Map((invData || []).map(inv => [inv.pm_bill_ref_no || String(inv.pm_ref_no), inv])).values()
      );

      setInvoicesList(uniqueInvoices);

      const targetInv = selectedInvNo || (uniqueInvoices.length > 0 ? (uniqueInvoices[0].pm_bill_ref_no || String(uniqueInvoices[0].pm_ref_no)) : '');
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

      let { data: barData, error } = await query;
      if (error) throw error;

      let barList = barData || [];

      // Find matching invoice master details
      const matchingMast = uniqueInvoices.find(i => 
        String(i.pm_bill_ref_no) === String(targetInv) || 
        String(i.pm_ref_no) === String(targetInv) ||
        String(i.pm_rec_no) === String(targetInv)
      );

      // 3. ON-THE-FLY AUTO BARCODE GENERATION IF NO BARCODES EXIST YET FOR THIS INVOICE
      if (barList.length === 0 && targetInv && !showAllProducts && matchingMast) {
        // Fetch pur_child items for this invoice
        const { data: childItems } = await supabase
          .from('pur_child')
          .select('*, product(ref_no, prd_code, barcode_gen_type, sales_price, rate, product_group(grp_name))')
          .eq('pm_ref_no', matchingMast.pm_ref_no);

        if (childItems && childItems.length > 0) {
          // Fetch barcode setting sequence
          const { data: settings } = await supabase
            .from('barcode_setting')
            .select('*')
            .or(`frm_code.eq.${company.frm_code},frm_code.is.null`)
            .order('ref_no', { ascending: true });

          const barRule = (settings && settings.length > 0) ? settings[0] : { prefix: 'KS', seed: 2304, seed_len: 5, suffix: '' };
          const prefix = barRule.prefix || 'KS';
          const suffix = barRule.suffix || '';
          const seedLen = barRule.seed_len || 5;

          // Safe Seed Recovery: query existing bar_temp to find highest numerical seed in DB
          const { data: existingBars } = await supabase
            .from('bar_temp')
            .select('bar_no')
            .eq('frm_code', company.frm_code)
            .order('bar_ref_id', { ascending: false });

          let maxSeedInDb = (barRule.seed || 2304) - 1;
          if (existingBars && existingBars.length > 0) {
            existingBars.forEach(b => {
              const match = (b.bar_no || '').match(/\d+/);
              if (match) {
                const num = parseInt(match[0]);
                if (num > maxSeedInDb) maxSeedInDb = num;
              }
            });
          }

          let currentSeed = Math.max(barRule.seed || 2304, maxSeedInDb + 1);
          const newBarEntries: any[] = [];

          childItems.forEach((cItem: any, idx: number) => {
            const genType = cItem.product?.barcode_gen_type || 'Auto Tracking Unique No';
            const pRate = cItem.pc_pur_rate || cItem.pc_txbl_rate || 0;
            const saleRate = cItem.pc_sale_rate && cItem.pc_sale_rate > 0 
              ? cItem.pc_sale_rate 
              : cItem.product?.sales_price && cItem.product?.sales_price > 0 
                ? cItem.product.sales_price 
                : Number((pRate * 1.25).toFixed(2));

            const costRate = cItem.pc_txbl_rate || pRate;
            const markup = costRate > 0 && saleRate > costRate ? Number((((saleRate - costRate) / costRate) * 100).toFixed(1)) : 0;
            const margin = saleRate > 0 ? Number((((saleRate - costRate) / saleRate) * 100).toFixed(2)) : 0;

            if (genType === 'Auto Tracking Unique No') {
              const unitQty = Math.max(1, Math.floor(cItem.pc_qty || 1));
              for (let u = 0; u < unitQty; u++) {
                const barNo = `${prefix}${String(currentSeed).padStart(seedLen, '0')}${suffix}`;
                newBarEntries.push({
                  bar_no: barNo,
                  prcode: cItem.pc_prcode || null,
                  pc_pur_rate: pRate,
                  pc_sale_rate: saleRate,
                  qty: 1,
                  cr_code: matchingMast.pm_cr_code,
                  sold_status: 'A',
                  frm_code: company.frm_code,
                  inv_no: targetInv,
                  inv_date: matchingMast.pm_bill_date,
                  entry_sno: cItem.pc_sno || (idx + 1),
                  cost_rate: costRate,
                  markup: markup,
                  margin: margin,
                  print_count: 1,
                  grp_name: cItem.product?.product_group?.grp_name || 'PURE SILK',
                  unit_name: cItem.pc_unit || 'NOS'
                });
                currentSeed++;
              }
            } else {
              const barNo = `${prefix}${String(currentSeed).padStart(seedLen, '0')}${suffix}`;
              newBarEntries.push({
                bar_no: barNo,
                prcode: cItem.pc_prcode || null,
                pc_pur_rate: pRate,
                pc_sale_rate: saleRate,
                qty: cItem.pc_qty || 1,
                cr_code: matchingMast.pm_cr_code,
                sold_status: 'A',
                frm_code: company.frm_code,
                inv_no: targetInv,
                inv_date: matchingMast.pm_bill_date,
                entry_sno: cItem.pc_sno || (idx + 1),
                cost_rate: costRate,
                markup: markup,
                margin: margin,
                print_count: 1,
                grp_name: cItem.product?.product_group?.grp_name || 'PURE SILK',
                unit_name: cItem.pc_unit || 'NOS'
              });
              currentSeed++;
            }
          });

          if (newBarEntries.length > 0) {
            await supabase.from('bar_temp').insert(newBarEntries);
            try {
              if (barRule.ref_no) {
                await supabase.from('barcode_setting').update({ seed: currentSeed }).eq('ref_no', barRule.ref_no);
              }
            } catch (e) {
              console.log("barcode_setting update skipped");
            }

            // Re-fetch generated barcodes for target invoice
            const { data: refetchedBars } = await supabase
              .from('bar_temp')
              .select('*, product(prd_code, prd_name, sales_price, rate, hsn_code, units, product_group(grp_name))')
              .eq('frm_code', company.frm_code)
              .eq('inv_no', targetInv)
              .order('bar_ref_id', { ascending: false });

            barList = refetchedBars || [];
          }
        }
      }

      // Ensure barcode list count matches matching invoice total quantity if any orphaned rows exist
      if (matchingMast?.pm_tot_qty && barList.length > matchingMast.pm_tot_qty && !showAllProducts) {
        barList = barList.slice(0, Math.floor(matchingMast.pm_tot_qty));
      }

      setRecords(barList);
      setSelectedIds(new Set(barList.map(r => r.bar_ref_id)));

      // 4. Update Header Summary Badges
      if (matchingMast) {
        setActiveInvoiceInfo({
          invNo: matchingMast.pm_bill_ref_no || matchingMast.pm_ref_no,
          invDate: matchingMast.pm_bill_date ? new Date(matchingMast.pm_bill_date).toISOString().split('T')[0] : '2026-08-20',
          totQty: matchingMast.pm_tot_qty || barList.reduce((sum, r) => sum + (r.qty || 1), 0)
        });
      } else if (barList.length > 0) {
        setActiveInvoiceInfo({
          invNo: targetInv || barList[0].inv_no || '56',
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

  const handlePrintCountChange = (index: number, valStr: string) => {
    const parsed = Math.max(1, parseInt(valStr) || 1);
    setRecords(prev => prev.map((item, idx) => idx === index ? { ...item, print_count: parsed } : item));
  };

  const handleOpenPrintPreview = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No barcodes selected for printing', variant: 'destructive' });
      return;
    }
    setShowPreviewModal(true);
  };

  const handleExecutePrint = () => {
    window.print();
  };

  // Keyboard Shortcuts (F11 for Print, F5 for Refresh)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        handleOpenPrintPreview();
      } else if (e.key === 'F5') {
        e.preventDefault();
        fetchBarcodes();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchBarcodes, selectedIds]);

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

  // ==========================================
  // Expanded Stickers List & Paired 2-Column Grid for 50x25mm Label Sheets
  // ==========================================
  const printableStickersList = useMemo(() => {
    const list: any[] = [];
    records.forEach((r, idx) => {
      if (selectedIds.has(r.bar_ref_id)) {
        const count = Math.max(1, r.print_count || 1);
        const purchaseRate = r.pc_pur_rate || r.product?.rate || 0;
        const salesRate = r.pc_sale_rate && r.pc_sale_rate > 0 
          ? r.pc_sale_rate 
          : r.product?.sales_price && r.product?.sales_price > 0 
            ? r.product.sales_price 
            : Number((purchaseRate * 1.25).toFixed(2));

        const trackingCode = buildTrackingCode(r, idx, activeInvoiceInfo?.invDate);

        for (let c = 0; c < count; c++) {
          list.push({
            ...r,
            idx,
            salesRate,
            trackingCode,
            batchNo: r.bar_no || 'KS00001',
            rateType: 'Fixed Rate'
          });
        }
      }
    });
    return list;
  }, [records, selectedIds, activeInvoiceInfo]);

  // Group stickers into pairs (1 row 2 columns)
  const stickerPairs = useMemo(() => {
    const pairs: any[][] = [];
    for (let i = 0; i < printableStickersList.length; i += 2) {
      pairs.push([
        printableStickersList[i],
        printableStickersList[i + 1] || null
      ]);
    }
    return pairs;
  }, [printableStickersList]);

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
          className="text-sm cursor-pointer hover:bg-amber-600 px-2 py-0.5 rounded transition font-bold"
          title="Close & Return to Purchase Entry"
        >
          ✕
        </button>
      </div>

      {/* Invoice Summary Header Card */}
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

        <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={handleCloseForm}>
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
              <option value="2StickerFixedPrice">2StickerFixedPrice (50x25mm QR)</option>
              <option value="[Default]">[Default]</option>
            </select>
          </div>

          {/* Printer Selection Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">Printer Name</Label>
            <select
              className="h-7 rounded border border-input bg-background px-2 text-xs min-w-[220px] font-medium"
              value={printerName}
              onChange={e => setPrinterName(e.target.value)}
            >
              <option value="Default System Printer (System Dialog)">Default System Printer (System Dialog)</option>
              <option value="TVS LP 46 Neo">TVS LP 46 Neo (Thermal 50x25mm)</option>
              <option value="Zebra ZD220 / ZT230">Zebra ZD220 / ZT230 (Thermal)</option>
              <option value="TSC TE244 / TTP-244 Pro">TSC TE244 / TTP-244 Pro (2-Up)</option>
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
          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shadow" onClick={handleOpenPrintPreview}>
            Print [F11]
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPreviewModal(true)}>
            Attach Image
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
            alert(`50x25mm Barcode Sticker Field List:\n\n1. QR Code: Encodes tracking composite code\n2. Rate: RS.xxxx.xx\n3. Product Code / Tracking: Ex. 103260821\n4. Batch No: Ex. KS02433\n5. Rate Type: Fixed Rate`);
          }}>
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
                <TableHead className="w-20 text-center p-1 bg-lime-500 text-white dark:bg-lime-600">Print Count</TableHead>
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
                <TableHead className="text-right p-1 bg-emerald-600 text-white font-bold">Sales Rate</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={19} className="text-center py-8">Loading generated barcodes...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={19} className="text-center py-8">
                    No generated barcodes found for Invoice #{selectedInvNo || '56'}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((r, idx) => {
                  const isChecked = selectedIds.has(r.bar_ref_id);
                  const prdCode = r.product?.prd_code || `S${r.prcode || idx + 1}`;
                  const prdName = r.product?.prd_name || 'Stock Item';
                  const purchaseRate = r.pc_pur_rate || r.product?.rate || 0;
                  const salesRate = r.pc_sale_rate && r.pc_sale_rate > 0 
                    ? r.pc_sale_rate 
                    : r.product?.sales_price && r.product?.sales_price > 0 
                      ? r.product.sales_price 
                      : Number((purchaseRate * 1.25).toFixed(2));

                  const costRate = r.cost_rate || purchaseRate;
                  const markup = costRate > 0 && salesRate > costRate ? Number((((salesRate - costRate) / costRate) * 100).toFixed(1)) : 0;
                  const margin = salesRate > 0 ? Number((((salesRate - costRate) / salesRate) * 100).toFixed(2)) : 0;
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
                        <input
                          type="number"
                          min="1"
                          value={r.print_count || 1}
                          onChange={(e) => handlePrintCountChange(idx, e.target.value)}
                          className="w-12 h-6 text-center font-bold bg-white dark:bg-slate-800 border rounded font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="Print Count (Copies)"
                        />
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
                      <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 p-1 bg-emerald-50 dark:bg-emerald-950/40">₹{salesRate.toFixed(2)}</TableCell>
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

      {/* ========================================================================= */}
      {/* Interactive 50x25mm 2-Column QR Code Barcode Print Preview Modal */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-amber-500 text-white p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">QR Code Barcode Print Preview (50×25mm 1 Row 2 Column)</span>
                <span className="bg-amber-700/60 px-2 py-0.5 rounded text-xs font-mono font-bold">
                  {totalSelectedStickers} Stickers Selected
                </span>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-white hover:bg-amber-600 rounded px-2 py-0.5 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable Sheet of 50x25mm 2-Column Stickers */}
            <div className="p-4 overflow-y-auto flex-1 bg-slate-200 dark:bg-slate-950 flex flex-col items-center gap-3">
              <div className="text-xs text-muted-foreground bg-background border px-4 py-1.5 rounded-full shadow-sm">
                Showing exact 50×25mm 2-column sticker pairs with QR Code, Rate, Composite Tracking Code (<span className="font-mono font-bold">Ex: 103260821</span>), Batch No &amp; Fixed Rate
              </div>

              {/* Printable Stickers Preview Container */}
              <div className="bg-white p-4 rounded shadow border border-slate-300 flex flex-col gap-2">
                {stickerPairs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No stickers selected for printing.</div>
                ) : (
                  stickerPairs.map((pair, rowIdx) => (
                    <div 
                      key={rowIdx} 
                      style={{ width: '104mm', height: '25mm' }} 
                      className="flex items-center justify-between gap-1 border-b border-dashed border-slate-300 pb-1"
                    >
                      <BarcodeStickerCard sticker={pair[0]} />
                      <BarcodeStickerCard sticker={pair[1]} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-card border-t p-3 flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Printer: <span className="font-bold font-mono text-foreground">{printerName}</span> (Size: 50×25mm / 2-Up Roll)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreviewModal(false)}>
                  Close
                </Button>
                <Button 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 px-4 shadow"
                  onClick={handleExecutePrint}
                >
                  Print Stickers Now [F11]
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Hidden DOM Area Exclusively Rendered during Thermal Window Printing */}
      {/* ========================================================================= */}
      <div id="barcode-printable-area" className="hidden print:block">
        {stickerPairs.map((pair, rowIdx) => (
          <div 
            key={`print-row-${rowIdx}`}
            className="sticker-pair-row"
          >
            <BarcodeStickerCard sticker={pair[0]} />
            <BarcodeStickerCard sticker={pair[1]} />
          </div>
        ))}
      </div>

      {/* Dedicated Thermal Printing CSS Rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #barcode-printable-area,
          #barcode-printable-area * {
            visibility: visible !important;
          }
          #barcode-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 104mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            display: block !important;
          }
          .sticker-pair-row {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            width: 104mm !important;
            height: 25mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          @page {
            size: 104mm 25mm;
            margin: 0mm;
          }
        }
      `}</style>
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
