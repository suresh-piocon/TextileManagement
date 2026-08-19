'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function LedgerGroupPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [primaryGroups, setPrimaryGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({ grp_type: 'Primary' });
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_master')
        .select('*')
        .order('grp_name');
        
      if (error) throw error;
      setRecords(data || []);
      setPrimaryGroups((data || []).filter(g => g.grp_type === 'Primary'));
    } catch (e: any) {
      toast({ title: 'Error fetching groups', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let error;
      if (formData.grp_id) {
        const { error: updateError } = await supabase
          .from('group_master')
          .update(formData)
          .eq('grp_id', formData.grp_id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('group_master')
          .insert([formData]);
        error = insertError;
      }

      if (error) throw error;
      
      toast({ title: 'Group saved successfully', variant: 'success' });
      setShowForm(false);
      setFormData({ grp_type: 'Primary' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error saving group', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      const { error } = await supabase.from('group_master').delete().eq('grp_id', id);
      if (error) throw error;
      toast({ title: 'Group deleted', variant: 'success' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error deleting group', variant: 'destructive' });
    }
  };

  const filteredRecords = records.filter(r => 
    r.grp_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ledger Groups</h1>
        <Button onClick={() => { setFormData({ grp_type: 'Primary' }); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Group'}
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-md bg-card">
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div>
              <Label>Group Name</Label>
              <Input 
                value={formData.grp_name || ''} 
                onChange={e => setFormData({...formData, grp_name: e.target.value})} 
                required 
              />
            </div>
            <div>
              <Label>Group Type</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.grp_type || 'Primary'}
                onChange={e => setFormData({...formData, grp_type: e.target.value})}
              >
                <option value="Primary">Primary</option>
                <option value="SubGroup">SubGroup</option>
              </select>
            </div>
            {formData.grp_type === 'SubGroup' && (
              <div>
                <Label>Base Group</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.base_grp_id || ''}
                  onChange={e => setFormData({...formData, base_grp_id: e.target.value})}
                  required={formData.grp_type === 'SubGroup'}
                >
                  <option value="">Select Base Group</option>
                  {primaryGroups.map(pg => (
                    <option key={pg.grp_id} value={pg.grp_id}>{pg.grp_name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit">Save Group</Button>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search groups..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Base Group</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => {
                const baseGrp = primaryGroups.find(p => p.grp_id === record.base_grp_id);
                return (
                  <TableRow key={record.grp_id}>
                    <TableCell>{record.grp_name}</TableCell>
                    <TableCell>{record.grp_type}</TableCell>
                    <TableCell>{baseGrp?.grp_name || '-'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setFormData(record); setShowForm(true); }}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(record.grp_id)}>Delete</Button>
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
