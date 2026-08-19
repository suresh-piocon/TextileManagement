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

export default function ColourMaster() {
  const { company } = useApp();
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ ref_no: 0, colour_code: '', colour_name: '' });

  useEffect(() => {
    if (company?.frm_code) {
      loadData();
    }
  }, [company?.frm_code]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('colour_info')
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
        .from('colour_info')
        .update({ colour_code: formData.colour_code, colour_name: formData.colour_name })
        .eq('ref_no', formData.ref_no)
        .eq('frm_code', company!.frm_code);
    } else {
      await supabase
        .from('colour_info')
        .insert([{ colour_code: formData.colour_code, colour_name: formData.colour_name, frm_code: company!.frm_code }]);
    }
    setIsFormOpen(false);
    loadData();
  };

  const handleEdit = (row: any) => {
    setFormData({ ref_no: row.ref_no, colour_code: row.colour_code, colour_name: row.colour_name });
    setIsFormOpen(true);
  };

  const handleDelete = async (ref_no: number) => {
    if (confirm('Are you sure you want to delete this colour?')) {
      await supabase.from('colour_info').delete().eq('ref_no', ref_no);
      loadData();
    }
  };

  const columns: Column<any>[] = [
    { key: 'colour_code', label: 'Code', sortable: true },
    { key: 'colour_name', label: 'Name', sortable: true }
  ];

  if (isFormOpen) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{formData.ref_no ? 'Edit Colour' : 'Add Colour'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 max-w-sm">
                <div className="grid gap-2">
                  <Label htmlFor="colour_code">Colour Code</Label>
                  <Input
                    id="colour_code"
                    value={formData.colour_code}
                    onChange={(e) => setFormData(p => ({ ...p, colour_code: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="colour_name">Colour Name</Label>
                  <Input
                    id="colour_name"
                    value={formData.colour_name}
                    onChange={(e) => setFormData(p => ({ ...p, colour_name: e.target.value }))}
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
        <h1 className="text-2xl font-bold">Colour Master</h1>
        <Button onClick={() => { setFormData({ ref_no: 0, colour_code: '', colour_name: '' }); setIsFormOpen(true); }}>
          Add Colour
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchable
        searchKeys={['colour_code', 'colour_name']}
        searchPlaceholder="Search colours..."
        actions={(row) => (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(row.ref_no)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />
    </div>
  );
}

