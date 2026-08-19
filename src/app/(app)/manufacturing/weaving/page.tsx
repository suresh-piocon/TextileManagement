'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LedgerSearch } from '@/components/search/ledger-search';
import { ProductSearch } from '@/components/search/product-search';

import { formatCurrency } from '@/lib/utils';

export default function WeavingJournalPage() {
  const { company } = useApp();
  const supabase = createClient();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [weaverId, setWeaverId] = useState('');
  const [loomNo, setLoomNo] = useState('');
  const [date, setDate] = useState('');
  const [entryType, setEntryType] = useState('Warp Issue');
  const [productId, setProductId] = useState('');
  
  const [warpQty, setWarpQty] = useState(0);
  const [issuedWt, setIssuedWt] = useState(0);
  const [receivedSareeQty, setReceivedSareeQty] = useState(0);
  const [receivedWt, setReceivedWt] = useState(0);
  const [outQty, setOutQty] = useState(0);
  
  const [wageDebit, setWageDebit] = useState(0);
  const [wageCredit, setWageCredit] = useState(0);
  const [narration, setNarration] = useState('');

  const loadData = async () => {
    if (!company?.frm_code) return;
    const { data } = await supabase
      .from('weaving_trans')
      .select('*')
      .eq('frm_code', company.frm_code)
      .order('date', { ascending: false });
    if (data) setTransactions(data);
  };

  useEffect(() => {
    loadData();
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.frm_code) return;
    
    try {
      const { error } = await supabase.from('weaving_trans').insert({
        frm_code: company.frm_code,
        weaver_id: weaverId,
        loom_no: loomNo,
        date: date,
        entry_type: entryType,
        product_id: productId || null,
        warp_qty: warpQty,
        issued_wt: issuedWt,
        received_saree_qty: receivedSareeQty,
        received_wt: receivedWt,
        out_qty: outQty,
        wage_debit: wageDebit,
        wage_credit: wageCredit,
        narration: narration
      });

      if (error) throw error;
      alert('Transaction saved');
      loadData();
      
      setWarpQty(0);
      setIssuedWt(0);
      setReceivedSareeQty(0);
      setReceivedWt(0);
      setOutQty(0);
      setWageDebit(0);
      setWageCredit(0);
      setNarration('');
      
    } catch (err: any) {
      alert(err.message || 'Error saving transaction');
    }
  };

  const totalSarees = transactions.reduce((sum, t) => sum + (Number(t.received_saree_qty) || 0), 0);
  const totalWagesPaid = transactions.reduce((sum, t) => sum + (Number(t.wage_debit) || 0), 0);
  const netBalance = transactions.reduce((sum, t) => sum + (Number(t.wage_credit) || 0) - (Number(t.wage_debit) || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Weaving Job Transaction Journal</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-lg">Sarees Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalSarees}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-lg">Wages Paid</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalWagesPaid)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-lg">Net Wage Balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(netBalance)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Weaver</Label>
                <LedgerSearch value={weaverId} onSelect={(l: any) => setWeaverId(l.ledg_code.toString())} />
              </div>
              <div className="space-y-2">
                <Label>Loom No</Label>
                <Input value={loomNo} onChange={(e) => setLoomNo(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Entry Type</Label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={entryType} 
                  onChange={(e) => setEntryType(e.target.value)}
                >
                  <option value="Warp Issue">Warp Issue</option>
                  <option value="Weft Issue">Weft Issue</option>
                  <option value="Zari Issue">Zari Issue</option>
                  <option value="Saree Received">Saree Received</option>
                  <option value="Wage Payment">Wage Payment</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Item/Product</Label>
                <ProductSearch value={productId} onSelect={(p: any) => setProductId(p.ref_no.toString())} />
              </div>
              
              <div className="space-y-2">
                <Label>Warp Qty (Mtrs)</Label>
                <Input type="number" value={warpQty} onChange={(e) => setWarpQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Issued Wt (Kg)</Label>
                <Input type="number" step="0.001" value={issuedWt} onChange={(e) => setIssuedWt(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Received Saree Qty</Label>
                <Input type="number" value={receivedSareeQty} onChange={(e) => setReceivedSareeQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Received Wt (Kg)</Label>
                <Input type="number" step="0.001" value={receivedWt} onChange={(e) => setReceivedWt(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Out Qty</Label>
                <Input type="number" value={outQty} onChange={(e) => setOutQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Wage Credit (Earned)</Label>
                <Input type="number" step="0.01" value={wageCredit} onChange={(e) => setWageCredit(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Wage Debit (Paid)</Label>
                <Input type="number" step="0.01" value={wageDebit} onChange={(e) => setWageDebit(Number(e.target.value))} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Narration / Details</Label>
                <Input value={narration} onChange={(e) => setNarration(e.target.value)} />
              </div>
            </div>
            <Button type="submit">Save Transaction</Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Transaction Journal</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Loom No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Issued Wt</TableHead>
                <TableHead className="text-right">Sarees</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.date}</TableCell>
                  <TableCell>{t.loom_no}</TableCell>
                  <TableCell>{t.entry_type}</TableCell>
                  <TableCell className="text-right">{t.issued_wt}</TableCell>
                  <TableCell className="text-right">{t.received_saree_qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.wage_debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.wage_credit)}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center">No transactions found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
