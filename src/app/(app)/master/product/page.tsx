'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function ProductPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({ is_stock: 'Yes', status: 'Active', barcode_gen_type: 'Manual', gst_perc: 0 });
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const [productsRes, groupsRes, unitsRes] = await Promise.all([
        supabase.from('product').select('*, product_group(grp_name)').eq('frm_code', company.frm_code).order('ref_no', { ascending: false }),
        supabase.from('product_group').select('*').eq('frm_code', company.frm_code),
        supabase.from('units_master').select('*').eq('frm_code', company.frm_code)
      ]);
        
      if (productsRes.error) throw productsRes.error;
      
      setRecords(productsRes.data || []);
      setGroups(groupsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching products', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.frm_code) return;
    try {
      const payload = { ...formData, frm_code: company.frm_code };
      delete payload.product_group;

      let error;
      if (formData.ref_no) {
        const { error: updateError } = await supabase
          .from('product')
          .update(payload)
          .eq('ref_no', formData.ref_no);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('product')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      toast({ title: 'Product saved successfully', variant: 'success' });
      setShowForm(false);
      setFormData({ is_stock: 'Yes', status: 'Active', barcode_gen_type: 'Manual', gst_perc: 0 });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error saving product', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const { error } = await supabase.from('product').delete().eq('ref_no', id);
      if (error) throw error;
      toast({ title: 'Product deleted', variant: 'success' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error deleting product', variant: 'destructive' });
    }
  };

  const filteredRecords = records.filter(r => 
    r.prd_name?.toLowerCase().includes(search.toLowerCase()) || 
    r.prd_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.hsn_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Product Master</h1>
        <Button onClick={() => { setFormData({ is_stock: 'Yes', status: 'Active', barcode_gen_type: 'Manual', gst_perc: 0 }); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Product'}
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-md bg-card">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Basic Info */}
            <div className="col-span-4 font-semibold border-b pb-2 mt-2">Basic Info</div>
            <div>
              <Label>Product Code</Label>
              <Input value={formData.prd_code || ''} onChange={e => setFormData({...formData, prd_code: e.target.value})} required />
            </div>
            <div className="col-span-2">
              <Label>Product Name</Label>
              <Input value={formData.prd_name || ''} onChange={e => setFormData({...formData, prd_name: e.target.value})} required />
            </div>
            <div>
              <Label>Barcode Generation Type</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.barcode_gen_type || 'Manual'} 
                onChange={e => setFormData({...formData, barcode_gen_type: e.target.value})}
              >
                <option value="Auto Tracking Unique No">1. Auto Tracking Unique No</option>
                <option value="Auto Tracking Batch No">2. Auto Tracking Batch No</option>
                <option value="Manual">3. Manual</option>
              </select>
            </div>
            <div>
              <Label>Group</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.grp_code || ''} onChange={e => setFormData({...formData, grp_code: e.target.value})} required>
                <option value="">Select Group</option>
                {groups.map(g => <option key={g.ref_no} value={g.ref_no}>{g.grp_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Unit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.units || ''} onChange={e => setFormData({...formData, units: e.target.value})} required>
                <option value="">Select Unit</option>
                {units.map(u => <option key={u.id} value={u.unit_name}>{u.unit_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label>Maintain Stock</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.is_stock || 'Yes'} onChange={e => setFormData({...formData, is_stock: e.target.value})}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            {/* Tax Info */}
            <div className="col-span-4 font-semibold border-b pb-2 mt-2">Tax Info</div>
            <div>
              <Label>HSN Code</Label>
              <Input value={formData.hsn_code || ''} onChange={e => setFormData({...formData, hsn_code: e.target.value})} placeholder="HSN Code" />
            </div>
            <div>
              <Label>GST Tax %</Label>
              <Input type="number" value={formData.gst_perc ?? 0} onChange={e => setFormData({...formData, gst_perc: parseFloat(e.target.value) || 0})} placeholder="GST %" />
            </div>

            {/* Pricing Info */}
            <div className="col-span-4 font-semibold border-b pb-2 mt-2">Pricing Details</div>
            <div>
              <Label>Rate (Purchase)</Label>
              <Input type="number" value={formData.rate || ''} onChange={e => setFormData({...formData, rate: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <Label>Sales Price</Label>
              <Input type="number" value={formData.sales_price || ''} onChange={e => setFormData({...formData, sales_price: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <Label>Tag Price</Label>
              <Input type="number" value={formData.tag_price || ''} onChange={e => setFormData({...formData, tag_price: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <Label>Discount %</Label>
              <Input type="number" value={formData.dis_perc || ''} onChange={e => setFormData({...formData, dis_perc: parseFloat(e.target.value) || 0})} />
            </div>

            {/* Stock Info */}
            <div className="col-span-4 font-semibold border-b pb-2 mt-2">Stock & Details</div>
            <div>
              <Label>Min Stock</Label>
              <Input type="number" value={formData.min_stock || ''} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Max Stock</Label>
              <Input type="number" value={formData.max_stock || ''} onChange={e => setFormData({...formData, max_stock: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Reorder Level</Label>
              <Input type="number" value={formData.re_order || ''} onChange={e => setFormData({...formData, re_order: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Weight</Label>
              <Input type="number" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})} />
            </div>

            <div className="col-span-4 pt-4">
              <Button type="submit">Save Product</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search by name, code, HSN..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Barcode Type</TableHead>
              <TableHead>HSN Code</TableHead>
              <TableHead>GST Tax %</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Sales Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => (
                <TableRow key={record.ref_no}>
                  <TableCell>{record.prd_code}</TableCell>
                  <TableCell>{record.prd_name}</TableCell>
                  <TableCell>{record.product_group?.grp_name}</TableCell>
                  <TableCell>{record.barcode_gen_type || 'Manual'}</TableCell>
                  <TableCell>{record.hsn_code || '-'}</TableCell>
                  <TableCell>{record.gst_perc || 0}%</TableCell>
                  <TableCell>{record.units}</TableCell>
                  <TableCell>{record.rate}</TableCell>
                  <TableCell>{record.sales_price}</TableCell>
                  <TableCell>{record.status}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setFormData(record); setShowForm(true); }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(record.ref_no)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
