'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function ProductGroupPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({ status: 'Primary' });
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_group')
        .select('*')
        .eq('frm_code', company.frm_code)
        .order('ref_no', { ascending: false });
        
      if (error) throw error;
      setRecords(data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching product groups', variant: 'destructive' });
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
      let error;
      if (formData.ref_no) {
        const { error: updateError } = await supabase
          .from('product_group')
          .update(payload)
          .eq('ref_no', formData.ref_no);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('product_group')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      toast({ title: 'Product Group saved successfully', variant: 'success' });
      setShowForm(false);
      setFormData({ status: 'Primary' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error saving product group', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product group?')) return;
    try {
      const { error } = await supabase.from('product_group').delete().eq('ref_no', id);
      if (error) throw error;
      toast({ title: 'Product Group deleted', variant: 'success' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error deleting product group', variant: 'destructive' });
    }
  };

  const filteredRecords = records.filter(r => 
    r.grp_name?.toLowerCase().includes(search.toLowerCase()) || 
    r.grp_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Product Groups</h1>
        <Button onClick={() => { setFormData({ status: 'Primary' }); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Product Group'}
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-md bg-card">
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4 max-w-2xl">
            <div>
              <Label>Group Code</Label>
              <Input 
                value={formData.grp_code || ''} 
                onChange={e => setFormData({...formData, grp_code: e.target.value})} 
                required 
              />
            </div>
            <div>
              <Label>Group Name</Label>
              <Input 
                value={formData.grp_name || ''} 
                onChange={e => setFormData({...formData, grp_name: e.target.value})} 
                required 
              />
            </div>
            <div>
              <Label>HSN Code</Label>
              <Input 
                value={formData.hsn_code || ''} 
                onChange={e => setFormData({...formData, hsn_code: e.target.value})} 
              />
            </div>
            <div>
              <Label>GST %</Label>
              <Input 
                type="number"
                value={formData.gst_perc || 0} 
                onChange={e => setFormData({...formData, gst_perc: parseFloat(e.target.value)})} 
              />
            </div>
            <div>
              <Label>Status</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.status || 'Primary'}
                onChange={e => setFormData({...formData, status: e.target.value})}
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            </div>
            <div className="col-span-2 pt-4">
              <Button type="submit">Save Product Group</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search product groups..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>GST %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => (
                <TableRow key={record.ref_no}>
                  <TableCell>{record.grp_code}</TableCell>
                  <TableCell>{record.grp_name}</TableCell>
                  <TableCell>{record.hsn_code}</TableCell>
                  <TableCell>{record.gst_perc}</TableCell>
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
