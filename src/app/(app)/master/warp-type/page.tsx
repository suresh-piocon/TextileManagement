'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { DataTable, Column } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash2 } from 'lucide-react';

export default function WarpTypeMaster() {
  const { company } = useApp();
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ wt_no: 0, warp_type: '' });

  useEffect(() => {
    if (company?.frm_code) {
      loadData();
    }
  }, [company?.frm_code]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('warp_type')
      .select('*')
      .eq('frm_code', company!.frm_code)
      .order('wt_no', { ascending: false });
    
    if (data) setData(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.wt_no) {
      await supabase
        .from('warp_type')
        .update({ warp_type: formData.warp_type })
        .eq('wt_no', formData.wt_no)
        .eq('frm_code', company!.frm_code);
    } else {
      await supabase
        .from('warp_type')
        .insert([{ warp_type: formData.warp_type, frm_code: company!.frm_code }]);
    }
    setIsFormOpen(false);
    loadData();
  };

  const columns: Column<any>[] = [
    { key: 'warp_type', label: 'Warp Type', sortable: true }
  ];

  if (isFormOpen) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{formData.wt_no ? 'Edit Warp Type' : 'Add Warp Type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 max-w-sm">
                <div className="grid gap-2">
                  <Label htmlFor="warp_type">Warp Type</Label>
                  <Input
                    id="warp_type"
                    value={formData.warp_type}
                    onChange={(e) => setFormData(p => ({ ...p, warp_type: e.target.value }))}
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
        <h1 className="text-2xl font-bold">Warp Type Master</h1>
        <Button onClick={() => { setFormData({ wt_no: 0, warp_type: '' }); setIsFormOpen(true); }}>
          Add Warp Type
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchable
        searchKeys={['warp_type']}
        searchPlaceholder="Search warp type..."
        actions={(row) => (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setFormData(row); setIsFormOpen(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => {
              if (confirm('Are you sure?')) {
                await supabase.from('warp_type').delete().eq('wt_no', row.wt_no);
                loadData();
              }
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />
    </div>
  );
}

