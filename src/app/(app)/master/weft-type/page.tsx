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

export default function WeftTypeMaster() {
  const { company } = useApp();
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ ref_no: 0, weft_type: '' });

  useEffect(() => {
    if (company?.frm_code) {
      loadData();
    }
  }, [company?.frm_code]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('weft_type')
      .select('*')
      .eq('frm_code', company!.frm_code)
      .order('ref_no', { ascending: false });
    
    if (data) setData(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.ref_no) {
      await supabase
        .from('weft_type')
        .update({ weft_type: formData.weft_type })
        .eq('ref_no', formData.ref_no)
        .eq('frm_code', company!.frm_code);
    } else {
      await supabase
        .from('weft_type')
        .insert([{ weft_type: formData.weft_type, frm_code: company!.frm_code }]);
    }
    setIsFormOpen(false);
    loadData();
  };

  const columns: Column<any>[] = [
    { key: 'weft_type', label: 'Weft Type', sortable: true }
  ];

  if (isFormOpen) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{formData.ref_no ? 'Edit Weft Type' : 'Add Weft Type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 max-w-sm">
                <div className="grid gap-2">
                  <Label htmlFor="weft_type">Weft Type</Label>
                  <Input
                    id="weft_type"
                    value={formData.weft_type}
                    onChange={(e) => setFormData(p => ({ ...p, weft_type: e.target.value }))}
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
        <h1 className="text-2xl font-bold">Weft Type Master</h1>
        <Button onClick={() => { setFormData({ ref_no: 0, weft_type: '' }); setIsFormOpen(true); }}>
          Add Weft Type
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchable
        searchKeys={['weft_type']}
        searchPlaceholder="Search weft type..."
        actions={(row) => (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setFormData(row); setIsFormOpen(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => {
              if (confirm('Are you sure?')) {
                await supabase.from('weft_type').delete().eq('ref_no', row.ref_no);
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

