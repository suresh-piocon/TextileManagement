'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function UnitsPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('units_master')
        .select('*')
        .eq('frm_code', company.frm_code)
        .order('id', { ascending: false });
        
      if (error) throw error;
      setRecords(data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching units', variant: 'destructive' });
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
      if (formData.id) {
        const { error: updateError } = await supabase
          .from('units_master')
          .update(payload)
          .eq('id', formData.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('units_master')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      toast({ title: 'Unit saved successfully', variant: 'success' });
      setShowForm(false);
      setFormData({});
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error saving unit', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
      const { error } = await supabase.from('units_master').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Unit deleted', variant: 'success' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error deleting unit', variant: 'destructive' });
    }
  };

  const filteredRecords = records.filter(r => 
    r.unit_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Units Master</h1>
        <Button onClick={() => { setFormData({}); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Unit'}
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-md bg-card">
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div>
              <Label>Unit Name</Label>
              <Input 
                value={formData.unit_name || ''} 
                onChange={e => setFormData({...formData, unit_name: e.target.value})} 
                required 
              />
            </div>
            <Button type="submit">Save Unit</Button>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search units..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Unit Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => (
                <TableRow key={record.id}>
                  <TableCell>{record.id}</TableCell>
                  <TableCell>{record.unit_name}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setFormData(record); setShowForm(true); }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(record.id)}>Delete</Button>
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
