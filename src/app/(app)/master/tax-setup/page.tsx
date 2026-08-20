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
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchProducts = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product')
        .select('*, product_group(grp_name)')
        .eq('frm_code', company.frm_code)
        .order('ref_no', { ascending: false });
        
      if (error) throw error;
      setProducts(data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching product tax data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct?.ref_no) return;
    try {
      const { error } = await supabase
        .from('product')
        .update({
          hsn_code: selectedProduct.hsn_code,
          gst_perc: parseFloat(selectedProduct.gst_perc) || 0
        })
        .eq('ref_no', selectedProduct.ref_no);

      if (error) throw error;

      toast({ title: 'Product tax setup updated', variant: 'success' });
      setShowEditForm(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (e: any) {
      toast({ title: 'Error updating product tax', description: e.message, variant: 'destructive' });
    }
  };

  const filteredProducts = products.filter(p => 
    p.prd_name?.toLowerCase().includes(search.toLowerCase()) || 
    p.prd_code?.toLowerCase().includes(search.toLowerCase()) ||
    p.hsn_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Product Tax Setup</h1>
          <p className="text-sm text-muted-foreground">Manage product-level tax rates, GST details, and HSN codes</p>
        </div>
      </div>

      {showEditForm && selectedProduct && (
        <div className="p-4 border rounded-md bg-card max-w-xl">
          <h2 className="text-lg font-semibold mb-3">Edit Tax Setup for: {selectedProduct.prd_name}</h2>
          <form onSubmit={handleSaveTax} className="grid grid-cols-2 gap-4">
            <div>
              <Label>HSN Code</Label>
              <Input 
                value={selectedProduct.hsn_code || ''} 
                onChange={e => setSelectedProduct({...selectedProduct, hsn_code: e.target.value})} 
                placeholder="Enter HSN Code"
              />
            </div>
            <div>
              <Label>GST Tax %</Label>
              <Input 
                type="number"
                value={selectedProduct.gst_perc ?? 0} 
                onChange={e => setSelectedProduct({...selectedProduct, gst_perc: e.target.value})} 
                placeholder="Enter GST Tax %"
              />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <Button type="submit">Update Tax Setup</Button>
              <Button type="button" variant="outline" onClick={() => { setShowEditForm(false); setSelectedProduct(null); }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search by product name, code, HSN..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>HSN Code</TableHead>
              <TableHead>GST Tax %</TableHead>
              <TableHead>CGST %</TableHead>
              <TableHead>SGST %</TableHead>
              <TableHead>IGST %</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center">No product records found</TableCell></TableRow>
            ) : (
              filteredProducts.map(p => {
                const gst = Number(p.gst_perc || 0);
                const halfGst = (gst / 2).toFixed(2);
                return (
                  <TableRow key={p.ref_no}>
                    <TableCell className="font-mono">{p.prd_code}</TableCell>
                    <TableCell className="font-medium">{p.prd_name}</TableCell>
                    <TableCell>{p.product_group?.grp_name || '-'}</TableCell>
                    <TableCell className="font-mono">{p.hsn_code || '-'}</TableCell>
                    <TableCell>{gst}%</TableCell>
                    <TableCell>{halfGst}%</TableCell>
                    <TableCell>{halfGst}%</TableCell>
                    <TableCell>{gst}%</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setSelectedProduct(p); setShowEditForm(true); }}
                      >
                        Edit Tax Setup
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
