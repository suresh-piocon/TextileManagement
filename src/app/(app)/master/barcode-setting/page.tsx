'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function BarcodeSettingPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<any>({
    bar_name: '[Default]',
    is_inactive: false,
    app_from: '0001-01-01',
    prefix: 'KS',
    suffix: '',
    seed_len: 5,
    seed: 2615
  });

  const fetchSettings = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('barcode_setting')
        .select('*')
        .or(`frm_code.eq.${company.frm_code},frm_code.is.null`)
        .order('ref_no', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
      if (data && data.length > 0) {
        setFormData(data[0]);
      }
    } catch (e: any) {
      toast({ title: 'Error fetching barcode settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!company?.frm_code) return;
    try {
      const payload = {
        ...formData,
        seed_len: parseInt(formData.seed_len) || 5,
        seed: parseInt(formData.seed) || 1,
        frm_code: company.frm_code
      };

      let error;
      if (formData.ref_no) {
        const { error: updateError } = await supabase
          .from('barcode_setting')
          .update(payload)
          .eq('ref_no', formData.ref_no);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('barcode_setting')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: 'Barcode setting saved successfully', variant: 'success' });
      fetchSettings();
    } catch (e: any) {
      toast({ title: 'Error saving barcode setting', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this barcode setting rule?')) return;
    try {
      const { error } = await supabase.from('barcode_setting').delete().eq('ref_no', id);
      if (error) throw error;
      toast({ title: 'Barcode setting deleted', variant: 'success' });
      fetchSettings();
    } catch (e) {
      toast({ title: 'Error deleting setting', variant: 'destructive' });
    }
  };

  const handleNew = () => {
    setFormData({
      bar_name: '2StickerFixedPrice',
      is_inactive: false,
      app_from: new Date().toISOString().split('T')[0],
      prefix: 'KS',
      suffix: '',
      seed_len: 5,
      seed: 2615
    });
  };

  const filteredSettings = settings.filter(s =>
    s.bar_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.prefix?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex justify-between items-center border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold">Barcode Setting Master</h1>
          <p className="text-sm text-muted-foreground">Configure automatic barcode prefix, seed sequence, and pattern formats</p>
        </div>
      </div>

      {/* Main Barcode Form Matching Image 2 */}
      <div className="p-4 border rounded-md bg-card shadow-sm space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
            {/* Barcode Name */}
            <div className="md:col-span-8 flex items-center gap-2">
              <Label className="w-28 text-xs font-semibold">Barcode Name</Label>
              <Input
                value={formData.bar_name || ''}
                onChange={e => setFormData({ ...formData, bar_name: e.target.value })}
                required
                className="h-8 font-bold bg-background flex-1"
                placeholder="[Default] or 2StickerFixedPrice"
              />
            </div>

            {/* Is Inactive Checkbox */}
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={formData.is_inactive || false}
                  onChange={e => setFormData({ ...formData, is_inactive: e.target.checked })}
                  className="rounded border-input"
                />
                Is Inactive
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
            {/* Applicable From */}
            <div className="md:col-span-4 flex items-center gap-2">
              <Label className="w-28 text-xs font-semibold">Applicable From</Label>
              <Input
                type="date"
                value={formData.app_from ? String(formData.app_from).split('T')[0] : '0001-01-01'}
                onChange={e => setFormData({ ...formData, app_from: e.target.value })}
                className="h-8 font-mono bg-background"
              />
            </div>

            {/* Prefix */}
            <div className="md:col-span-4 flex items-center gap-2">
              <Label className="w-16 text-xs font-semibold">Prefix</Label>
              <Input
                value={formData.prefix || ''}
                onChange={e => setFormData({ ...formData, prefix: e.target.value })}
                className="h-8 font-mono font-bold bg-background"
                placeholder="KS"
              />
            </div>

            {/* Suffix */}
            <div className="md:col-span-4 flex items-center gap-2">
              <Label className="w-16 text-xs font-semibold">Suffix</Label>
              <Input
                value={formData.suffix || ''}
                onChange={e => setFormData({ ...formData, suffix: e.target.value })}
                className="h-8 font-mono bg-background"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
            {/* Seed Length */}
            <div className="md:col-span-4 flex items-center gap-2">
              <Label className="w-28 text-xs font-semibold">Seed Length</Label>
              <Input
                type="number"
                value={formData.seed_len ?? 5}
                onChange={e => setFormData({ ...formData, seed_len: e.target.value })}
                className="h-8 font-mono bg-background"
              />
            </div>

            {/* Seed Counter */}
            <div className="md:col-span-8 flex items-center gap-2">
              <Label className="w-16 text-xs font-semibold">Seed</Label>
              <Input
                type="number"
                value={formData.seed ?? 2615}
                onChange={e => setFormData({ ...formData, seed: e.target.value })}
                className="h-8 font-mono font-bold bg-background flex-1 text-emerald-700 dark:text-emerald-400"
              />
              <span className="text-[11px] text-muted-foreground font-mono">
                Sample: {formData.prefix || ''}{String(formData.seed || 1).padStart(parseInt(formData.seed_len) || 5, '0')}{formData.suffix || ''}
              </span>
            </div>
          </div>

          {/* Action Controls Toolbar matching Image 2 */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSave()}>
              Edit [F9]
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleNew}>
              New [F4]
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              size="sm" 
              className="h-8 text-xs" 
              onClick={() => formData.ref_no && handleDelete(formData.ref_no)}
              disabled={!formData.ref_no}
            >
              Delete
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fetchSettings()}>
              Search [F3]
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold ml-auto">
              Save Barcode Setting
            </Button>
          </div>
        </form>
      </div>

      {/* Configured Barcode Settings Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-muted text-xs">
            <TableRow>
              <TableHead>Barcode Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Seed Len</TableHead>
              <TableHead>Current Seed</TableHead>
              <TableHead>Next Barcode Sample</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Loading settings...</TableCell></TableRow>
            ) : filteredSettings.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center">No barcode settings found</TableCell></TableRow>
            ) : (
              filteredSettings.map(s => {
                const sample = `${s.prefix || ''}${String(s.seed || 1).padStart(s.seed_len || 5, '0')}${s.suffix || ''}`;
                return (
                  <TableRow key={s.ref_no} className="hover:bg-muted/50">
                    <TableCell className="font-bold">{s.bar_name}</TableCell>
                    <TableCell className="font-mono">{s.prefix}</TableCell>
                    <TableCell className="font-mono">{s.seed_len}</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-600">{s.seed}</TableCell>
                    <TableCell className="font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                      {sample}
                    </TableCell>
                    <TableCell>{s.is_inactive ? 'Inactive' : 'Active'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFormData(s)}>Select</Button>
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
