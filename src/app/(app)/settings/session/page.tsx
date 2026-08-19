'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { DataTable, Column } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

export default function SessionMaster() {
  const { company } = useApp();
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ sn_from_year: '', sn_to_year: '', header: '' });

  useEffect(() => {
    if (company?.frm_code) {
      loadData();
    }
  }, [company?.frm_code]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('session')
      .select('*')
      .eq('frm_code', company!.frm_code)
      .order('sn_id', { ascending: false });
    
    if (data) setData(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase
      .from('session')
      .insert([{ 
        ...formData, 
        active: false,
        frm_code: company!.frm_code 
      }]);
    setIsFormOpen(false);
    loadData();
  };

  const setActiveSession = async (sn_id: number) => {
    await supabase
      .from('session')
      .update({ active: false })
      .eq('frm_code', company!.frm_code);
      
    await supabase
      .from('session')
      .update({ active: true })
      .eq('sn_id', sn_id)
      .eq('frm_code', company!.frm_code);
      
    loadData();
  };

  const columns: Column<any>[] = [
    { key: 'header', label: 'Header', sortable: true },
    { key: 'sn_from_year', label: 'From Year', sortable: true },
    { key: 'sn_to_year', label: 'To Year', sortable: true },
    { 
      key: 'active', 
      label: 'Status', 
      render: (val) => val ? <span className="text-green-600 font-bold">Active</span> : <span>Inactive</span>
    }
  ];

  if (isFormOpen) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 max-w-sm">
                <div className="grid gap-2">
                  <Label htmlFor="header">Session Name / Header</Label>
                  <Input
                    id="header"
                    placeholder="e.g. 2023-2024"
                    value={formData.header}
                    onChange={(e) => setFormData(p => ({ ...p, header: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sn_from_year">From Date</Label>
                  <Input
                    id="sn_from_year"
                    type="date"
                    value={formData.sn_from_year}
                    onChange={(e) => setFormData(p => ({ ...p, sn_from_year: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sn_to_year">To Date</Label>
                  <Input
                    id="sn_to_year"
                    type="date"
                    value={formData.sn_to_year}
                    onChange={(e) => setFormData(p => ({ ...p, sn_to_year: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Session Management</h1>
        <Button onClick={() => { setFormData({ sn_from_year: '', sn_to_year: '', header: '' }); setIsFormOpen(true); }}>
          Create Session
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        actions={(row) => (
          <div className="flex gap-2">
            {!row.active && (
              <Button variant="outline" size="sm" onClick={() => setActiveSession(row.sn_id)}>
                <Check className="h-4 w-4 mr-1" /> Set Active
              </Button>
            )}
          </div>
        )}
      />
    </div>
  );
}

