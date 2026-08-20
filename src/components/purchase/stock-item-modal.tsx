'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export interface StockDetailRow {
  sno: number;
  qty: number;
  p_rate: number;
  disc_perc: number;
  amount: number;
  cost_rate: number;
  markup: number;
  sale_rate: number;
}

interface StockItemModalProps {
  isOpen: boolean;
  product: any | null;
  onClose: () => void;
  onProceed: (product: any, rows: StockDetailRow[]) => void;
}

export function StockItemModal({ isOpen, product, onClose, onProceed }: StockItemModalProps) {
  const [targetQty, setTargetQty] = useState<number>(0);
  const [rows, setRows] = useState<StockDetailRow[]>([
    { sno: 1, qty: 0, p_rate: 0, disc_perc: 0, amount: 0, cost_rate: 0, markup: 0, sale_rate: 0 }
  ]);

  const targetQtyRef = useRef<HTMLInputElement | null>(null);
  const rowQtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen && product) {
      const defaultPRate = product.rate || 0;
      const defaultSaleRate = product.sales_price || 0;
      const markup = defaultPRate > 0 && defaultSaleRate > defaultPRate 
        ? Number((((defaultSaleRate - defaultPRate) / defaultPRate) * 100).toFixed(2)) 
        : 0;

      setTargetQty(0);
      setRows([
        {
          sno: 1,
          qty: 0,
          p_rate: defaultPRate,
          disc_perc: 0,
          amount: 0,
          cost_rate: defaultPRate,
          markup: markup,
          sale_rate: defaultSaleRate
        }
      ]);

      setTimeout(() => {
        targetQtyRef.current?.focus();
        targetQtyRef.current?.select();
      }, 100);
    }
  }, [isOpen, product]);

  // Shortcut key handling (F5 to proceed, Esc to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleProceed();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, rows, targetQty, product]);

  if (!isOpen || !product) return null;

  const totalRowQty = rows.reduce((sum, r) => sum + (r.qty || 0), 0);
  const unadjQty = Math.max(0, targetQty - totalRowQty);
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  const updateRow = (index: number, field: keyof StockDetailRow, value: any) => {
    const updated = [...rows];
    const row = { ...updated[index], [field]: parseFloat(String(value)) || 0 };

    const qty = row.qty || 0;
    const pRate = row.p_rate || 0;
    const discPerc = row.disc_perc || 0;

    const baseAmount = qty * pRate;
    const discAmt = (baseAmount * discPerc) / 100;
    const netAmount = baseAmount - discAmt;
    const costRate = qty > 0 ? netAmount / qty : pRate;

    if (field === 'markup' || field === 'p_rate' || field === 'disc_perc') {
      const saleRate = costRate + (costRate * (row.markup || 0)) / 100;
      row.sale_rate = Number(saleRate.toFixed(2));
    } else if (field === 'sale_rate') {
      const markup = costRate > 0 ? ((row.sale_rate - costRate) / costRate) * 100 : 0;
      row.markup = Number(markup.toFixed(2));
    }

    row.amount = Number(netAmount.toFixed(2));
    row.cost_rate = Number(costRate.toFixed(2));

    updated[index] = row;
    setRows(updated);
  };

  // Focus transition from Header Quantity input on Enter keypress
  const handleTargetQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = parseFloat((e.target as HTMLInputElement).value) || 0;
      setTargetQty(val);
      if (rows.length > 0 && (rows[0].qty === 0 || rows[0].qty === undefined)) {
        updateRow(0, 'qty', val);
      }
      setTimeout(() => {
        rowQtyRefs.current[0]?.focus();
        rowQtyRefs.current[0]?.select();
      }, 50);
    }
  };

  // Focus transition and Auto Row Creation on Enter keypress in Row Qty
  const handleRowQtyKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentQty = parseFloat((e.target as HTMLInputElement).value) || 0;
      updateRow(index, 'qty', currentQty);

      // Compute unadjusted quantity remaining after this row
      const currentSum = rows.reduce((sum, r, idx) => sum + (idx <= index ? (idx === index ? currentQty : r.qty || 0) : 0), 0);
      const remaining = Math.max(0, targetQty - currentSum);

      if (remaining > 0) {
        if (index + 1 < rows.length) {
          const updated = [...rows];
          updated[index + 1].qty = remaining;
          setRows(updated);
          setTimeout(() => {
            rowQtyRefs.current[index + 1]?.focus();
            rowQtyRefs.current[index + 1]?.select();
          }, 50);
        } else {
          // Add a new row with remaining quantity balance
          const lastRow = rows[index] || {};
          const newRowIndex = rows.length;
          setRows(prev => [
            ...prev,
            {
              sno: prev.length + 1,
              qty: remaining,
              p_rate: lastRow.p_rate || product?.rate || 0,
              disc_perc: lastRow.disc_perc || 0,
              amount: Number((remaining * (lastRow.p_rate || product?.rate || 0)).toFixed(2)),
              cost_rate: lastRow.cost_rate || product?.rate || 0,
              markup: lastRow.markup || 0,
              sale_rate: lastRow.sale_rate || product?.sales_price || 0
            }
          ]);
          setTimeout(() => {
            rowQtyRefs.current[newRowIndex]?.focus();
            rowQtyRefs.current[newRowIndex]?.select();
          }, 50);
        }
      }
    }
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1] || {};
    const defaultQty = unadjQty > 0 ? unadjQty : 0;
    setRows(prev => [
      ...prev,
      {
        sno: prev.length + 1,
        qty: defaultQty,
        p_rate: lastRow.p_rate || product?.rate || 0,
        disc_perc: lastRow.disc_perc || 0,
        amount: Number((defaultQty * (lastRow.p_rate || product?.rate || 0)).toFixed(2)),
        cost_rate: lastRow.cost_rate || product?.rate || 0,
        markup: lastRow.markup || 0,
        sale_rate: lastRow.sale_rate || product?.sales_price || 0
      }
    ]);
  };

  const deleteRow = (index: number) => {
    if (rows.length === 1) return;
    const updated = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, sno: i + 1 }));
    setRows(updated);
  };

  const copyBatch = () => {
    if (rows.length === 0) return;
    const lastRow = { ...rows[rows.length - 1], sno: rows.length + 1 };
    setRows(prev => [...prev, lastRow]);
  };

  const handleProceed = () => {
    const validRows = rows.filter(r => r.qty > 0);
    if (validRows.length === 0) {
      onProceed(product, rows.map(r => r.qty === 0 ? { ...r, qty: 1 } : r));
    } else {
      onProceed(product, validRows);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-5xl rounded-lg shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Title Bar */}
        <div className="bg-slate-800 text-white font-bold px-4 py-2 flex justify-between items-center text-sm">
          <span>Stock : {product.prd_name}</span>
          <button onClick={onClose} className="hover:bg-slate-700 px-2 py-0.5 rounded">✕</button>
        </div>

        {/* Top Summary Badges */}
        <div className="p-3 bg-muted/20 border-b flex items-center gap-4 text-xs">
          <div className="bg-emerald-600 text-white rounded overflow-hidden flex flex-col text-center min-w-[120px] shadow">
            <span className="bg-emerald-700 text-[10px] font-bold py-0.5 px-2 uppercase">Quantity</span>
            <div className="bg-white px-1 py-0.5 border border-emerald-600">
              <input
                ref={targetQtyRef}
                type="number"
                value={targetQty || ''}
                onChange={e => setTargetQty(parseFloat(e.target.value) || 0)}
                onKeyDown={handleTargetQtyKeyDown}
                placeholder="Enter Qty..."
                className="w-full text-center font-mono text-base font-bold text-emerald-900 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-emerald-600 text-white rounded overflow-hidden flex flex-col text-center min-w-[120px] shadow">
            <span className="bg-emerald-700 text-[10px] font-bold py-0.5 px-2 uppercase">UnAdj.Qty</span>
            <span className="font-mono text-base font-bold px-2 py-1 bg-white text-emerald-900 border border-emerald-600">
              {unadjQty.toFixed(2)}
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground italic pl-2">
            Enter Total Qty → Press [Enter] to focus row. Split quantities row-by-row until UnAdj.Qty is 0.00
          </div>
        </div>

        {/* Stock Detail Rows Grid Table */}
        <div className="flex-1 overflow-auto p-2 min-h-[250px]">
          <Table>
            <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold">
              <TableRow>
                <TableHead className="w-8 text-center p-1.5">Del</TableHead>
                <TableHead className="w-10 text-center p-1.5">SNo</TableHead>
                <TableHead className="w-28 text-center p-1.5">Quantity</TableHead>
                <TableHead className="w-24 text-right p-1.5">P.Rate</TableHead>
                <TableHead className="w-20 text-right p-1.5">Disc.%</TableHead>
                <TableHead className="w-28 text-right p-1.5">Amount</TableHead>
                <TableHead className="w-24 text-right p-1.5">Cost Rate</TableHead>
                <TableHead className="w-20 text-right p-1.5">MarkUp</TableHead>
                <TableHead className="w-24 text-right p-1.5">Sale Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {rows.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/40">
                  <TableCell className="text-center p-1">
                    <button 
                      onClick={() => deleteRow(idx)}
                      className="text-red-500 hover:text-red-700 font-bold text-sm"
                      title="Delete Row"
                    >
                      ✕
                    </button>
                  </TableCell>
                  <TableCell className="text-center font-mono p-1">{row.sno}</TableCell>
                  <TableCell className="p-1">
                    <Input
                      ref={el => { rowQtyRefs.current[idx] = el; }}
                      type="number"
                      value={row.qty || ''}
                      onChange={e => updateRow(idx, 'qty', e.target.value)}
                      onKeyDown={e => handleRowQtyKeyDown(idx, e)}
                      className="h-7 text-xs text-right font-mono bg-cyan-400 dark:bg-cyan-600 text-slate-950 font-bold focus:bg-cyan-300"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      value={row.p_rate || ''}
                      onChange={e => updateRow(idx, 'p_rate', e.target.value)}
                      className="h-7 text-xs text-right font-mono bg-background"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      value={row.disc_perc || ''}
                      onChange={e => updateRow(idx, 'disc_perc', e.target.value)}
                      className="h-7 text-xs text-right font-mono bg-background"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold p-1">
                    ₹{(row.amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono p-1">
                    ₹{(row.cost_rate || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      value={row.markup || ''}
                      onChange={e => updateRow(idx, 'markup', e.target.value)}
                      className="h-7 text-xs text-right font-mono bg-background"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      value={row.sale_rate || ''}
                      onChange={e => updateRow(idx, 'sale_rate', e.target.value)}
                      className="h-7 text-xs text-right font-mono bg-background font-bold"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer Summary Row */}
        <div className="bg-slate-100 dark:bg-slate-900 p-2 border-t flex justify-between items-center text-xs font-bold">
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={addRow}>
            + Add Row
          </Button>

          <div className="flex gap-8 font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total Qty:</span>
              <span className="bg-background border rounded px-3 py-0.5">{totalRowQty.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="bg-background border rounded px-3 py-0.5 text-emerald-600">
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Toolbar Bar */}
        <div className="bg-muted/40 p-3 border-t flex justify-between items-center">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copyBatch}>
            Copy Batch [F6]
          </Button>

          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleProceed}>
              Proceed [F5]
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
              Cancel [Esc]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
