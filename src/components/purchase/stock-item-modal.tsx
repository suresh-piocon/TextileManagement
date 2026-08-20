'use client';

import { useState, useEffect } from 'react';
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
  const [rows, setRows] = useState<StockDetailRow[]>([
    { sno: 1, qty: 0, p_rate: 0, disc_perc: 0, amount: 0, cost_rate: 0, markup: 0, sale_rate: 0 }
  ]);

  useEffect(() => {
    if (isOpen && product) {
      const defaultPRate = product.rate || 0;
      const defaultSaleRate = product.sales_price || 0;
      const markup = defaultPRate > 0 && defaultSaleRate > defaultPRate 
        ? Number((((defaultSaleRate - defaultPRate) / defaultPRate) * 100).toFixed(2)) 
        : 0;

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
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

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

    // Recalculate Sale Rate if Markup changes or vice versa
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

  const addRow = () => {
    const lastRow = rows[rows.length - 1] || {};
    setRows(prev => [
      ...prev,
      {
        sno: prev.length + 1,
        qty: 0,
        p_rate: lastRow.p_rate || product?.rate || 0,
        disc_perc: lastRow.disc_perc || 0,
        amount: 0,
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

  const totalQty = rows.reduce((sum, r) => sum + (r.qty || 0), 0);
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  const handleProceed = () => {
    const validRows = rows.filter(r => r.qty > 0);
    if (validRows.length === 0) {
      // If user left qty 0 on row 1 but typed rate, set qty to 1 or proceed
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
        <div className="p-3 bg-muted/20 border-b flex items-center gap-3 text-xs">
          <div className="bg-emerald-600 text-white rounded overflow-hidden flex flex-col text-center min-w-[90px] shadow">
            <span className="bg-emerald-700 text-[10px] font-bold py-0.5 px-2 uppercase">Quantity</span>
            <span className="font-mono text-base font-bold px-2 py-1 bg-white text-emerald-900 border border-emerald-600">
              {totalQty.toFixed(2)}
            </span>
          </div>

          <div className="bg-emerald-600 text-white rounded overflow-hidden flex flex-col text-center min-w-[90px] shadow">
            <span className="bg-emerald-700 text-[10px] font-bold py-0.5 px-2 uppercase">UnAdj.Qty</span>
            <span className="font-mono text-base font-bold px-2 py-1 bg-white text-emerald-900 border border-emerald-600">
              0.00
            </span>
          </div>
        </div>

        {/* Stock Detail Rows Grid Table */}
        <div className="flex-1 overflow-auto p-2 min-h-[250px]">
          <Table>
            <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold">
              <TableRow>
                <TableHead className="w-8 text-center p-1.5">Del</TableHead>
                <TableHead className="w-10 text-center p-1.5">SNo</TableHead>
                <TableHead className="w-24 text-center p-1.5">Quantity</TableHead>
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
                      type="number"
                      value={row.qty || ''}
                      onChange={e => updateRow(idx, 'qty', e.target.value)}
                      className="h-7 text-xs text-right font-mono bg-cyan-400 dark:bg-cyan-600 text-slate-950 font-bold focus:bg-cyan-300"
                      autoFocus={idx === 0}
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
              <span className="bg-background border rounded px-3 py-0.5">{totalQty.toFixed(2)}</span>
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
