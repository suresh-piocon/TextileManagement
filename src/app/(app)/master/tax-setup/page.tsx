'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function TaxSetupPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'ledger' | 'product'>('ledger');
  const [loading, setLoading] = useState(true);
  
  // Ledger Tax State
  const [ledgerTaxes, setLedgerTaxes] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerForm, setLedgerForm] = useState<any>({});
  
  // Product Tax State
  const [productTaxes, setProductTaxes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const [lTaxes, pTaxes, lData, pData] = await Promise.all([
        supabase.from('tax_setup').select('*').order('tax_reg_code', { ascending: false }),
        supabase.from('prod_tax_setup').select('*').order('prd_code', { ascending: false }),
        supabase.from('ledger').select('ledg_code, ledg_name').eq('frm_code', company.frm_code),
        supabase.from('product').select('prd_code, prd_name').eq('frm_code', company.frm_code)
      ]);
      
      setLedgerTaxes(lTaxes.data || []);
      setProductTaxes(pTaxes.data || []);
      setLedgers(lData.data || []);
      setProducts(pData.data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching tax data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLedgerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...ledgerForm };
      
      let error;
      if (ledgerForm.tax_reg_code && ledgerTaxes.some(t => t.tax_reg_code === ledgerForm.tax_reg_code)) {
        const { error: updateError } = await supabase.from('tax_setup').update(payload).eq('tax_reg_code', ledgerForm.tax_reg_code);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('tax_setup').insert([payload]);
        error = insertError;
      }
      if (error) throw error;
      
      toast({ title: 'Ledger Tax saved', variant: 'success' });
      setShowLedgerForm(false);
      setLedgerForm({});
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error saving ledger tax', description: e.message, variant: 'destructive' });
    }
  };

  const handleProductSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...productForm };
      
      let error;
      if (productForm.prd_code && productTaxes.some(t => t.prd_code === productForm.prd_code)) {
        const { error: updateError } = await supabase.from('prod_tax_setup').update(payload).eq('prd_code', productForm.prd_code);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('prod_tax_setup').insert([payload]);
        error = insertError;
      }
      if (error) throw error;
      
      toast({ title: 'Product Tax saved', variant: 'success' });
      setShowProductForm(false);
      setProductForm({});
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error saving product tax', description: e.message, variant: 'destructive' });
    }
  };

  const deleteTax = async (table: string, keyColumn: string, id: string) => {
    if (!confirm('Delete this tax setup?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq(keyColumn, id);
      if (error) throw error;
      toast({ title: 'Tax setup deleted', variant: 'success' });
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error deleting tax', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Tax Setup Master</h1>
      
      <div className="flex gap-2 border-b mb-4">
        <button 
          onClick={() => setActiveTab('ledger')} 
          className={`px-4 py-2 border-b-2 font-medium ${activeTab === 'ledger' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          Ledger Tax
        </button>
        <button 
          onClick={() => setActiveTab('product')} 
          className={`px-4 py-2 border-b-2 font-medium ${activeTab === 'product' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          Product Tax
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {activeTab === 'ledger' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setLedgerForm({}); setShowLedgerForm(!showLedgerForm); }}>
              {showLedgerForm ? 'Cancel' : 'Add Ledger Tax'}
            </Button>
          </div>
          
          {showLedgerForm && (
            <div className="p-4 border rounded-md bg-card">
              <form onSubmit={handleLedgerSave} className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tax Reg Code</Label>
                  <Input value={ledgerForm.tax_reg_code || ''} onChange={e => setLedgerForm({...ledgerForm, tax_reg_code: e.target.value})} required />
                </div>
                <div>
                  <Label>Tax Head (Ledger)</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={ledgerForm.tax_head_code || ''} onChange={e => setLedgerForm({...ledgerForm, tax_head_code: e.target.value})} required>
                    <option value="">Select Ledger</option>
                    {ledgers.map(l => <option key={l.ledg_code} value={l.ledg_code}>{l.ledg_name}</option>)}
                  </select>
                </div>
                {/* Simplified GST Inputs */}
                <div>
                  <Label>CGST %</Label>
                  <Input type="number" value={ledgerForm.cgst_perc || ''} onChange={e => setLedgerForm({...ledgerForm, cgst_perc: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <Label>SGST %</Label>
                  <Input type="number" value={ledgerForm.sgst_perc || ''} onChange={e => setLedgerForm({...ledgerForm, sgst_perc: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <Label>IGST %</Label>
                  <Input type="number" value={ledgerForm.igst_perc || ''} onChange={e => setLedgerForm({...ledgerForm, igst_perc: parseFloat(e.target.value)})} />
                </div>
                <div className="col-span-2 pt-2">
                  <Button type="submit">Save Ledger Tax</Button>
                </div>
              </form>
            </div>
          )}

          <Table className="border rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead>Tax Reg Code</TableHead>
                <TableHead>Tax Head Code</TableHead>
                <TableHead>CGST %</TableHead>
                <TableHead>SGST %</TableHead>
                <TableHead>IGST %</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerTaxes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">No records</TableCell></TableRow>
              ) : (
                ledgerTaxes.map(r => (
                  <TableRow key={r.tax_reg_code}>
                    <TableCell>{r.tax_reg_code}</TableCell>
                    <TableCell>{r.tax_head_code}</TableCell>
                    <TableCell>{r.cgst_perc}</TableCell>
                    <TableCell>{r.sgst_perc}</TableCell>
                    <TableCell>{r.igst_perc}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setLedgerForm(r); setShowLedgerForm(true); }}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteTax('tax_setup', 'tax_reg_code', r.tax_reg_code)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'product' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setProductForm({}); setShowProductForm(!showProductForm); }}>
              {showProductForm ? 'Cancel' : 'Add Product Tax'}
            </Button>
          </div>
          
          {showProductForm && (
            <div className="p-4 border rounded-md bg-card">
              <form onSubmit={handleProductSave} className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productForm.prd_code || ''} onChange={e => setProductForm({...productForm, prd_code: e.target.value})} required>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.prd_code} value={p.prd_code}>{p.prd_name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>HSN</Label>
                  <Input value={productForm.hsn || ''} onChange={e => setProductForm({...productForm, hsn: e.target.value})} />
                </div>
                <div>
                  <Label>CGST %</Label>
                  <Input type="number" value={productForm.cgst_perc || ''} onChange={e => setProductForm({...productForm, cgst_perc: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <Label>SGST %</Label>
                  <Input type="number" value={productForm.sgst_perc || ''} onChange={e => setProductForm({...productForm, sgst_perc: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <Label>IGST %</Label>
                  <Input type="number" value={productForm.igst_perc || ''} onChange={e => setProductForm({...productForm, igst_perc: parseFloat(e.target.value)})} />
                </div>
                <div className="col-span-2 pt-2">
                  <Button type="submit">Save Product Tax</Button>
                </div>
              </form>
            </div>
          )}

          <Table className="border rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead>Product Code</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>CGST %</TableHead>
                <TableHead>SGST %</TableHead>
                <TableHead>IGST %</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productTaxes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">No records</TableCell></TableRow>
              ) : (
                productTaxes.map(r => (
                  <TableRow key={r.prd_code}>
                    <TableCell>{r.prd_code}</TableCell>
                    <TableCell>{r.hsn}</TableCell>
                    <TableCell>{r.cgst_perc}</TableCell>
                    <TableCell>{r.sgst_perc}</TableCell>
                    <TableCell>{r.igst_perc}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setProductForm(r); setShowProductForm(true); }}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteTax('prod_tax_setup', 'prd_code', r.prd_code)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
