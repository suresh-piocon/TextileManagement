'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProductSearch } from '@/components/search/product-search';
import { formatCurrency } from '@/lib/utils';

export default function WarpDesignPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    weave_name: '',
    warp_type: 'Silk',
    weft_type: 'Cotton',
    product_id: null as number | null,
    product_name: '',
    reed: '',
    thread: '',
    card_count: '',
    mark_count: '',
    warp_weight: '',
    weft_weight: '',
    zari_weight: '',
    item_weight: '',
    mfg_wages_rate: '',
  });

  useEffect(() => {
    if (company?.frm_code) {
      fetchSheets();
    }
  }, [company]);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('warp_sheet')
        .select('*')
        .eq('frm_code', company!.frm_code)
        .order('id', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      setSheets(data || []);
    } catch (error: any) {
      console.error('Error fetching sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.weave_name || !formData.product_id) {
      alert('Weave name and Product are required');
      return;
    }

    setSaving(true);
    try {
      const total_weight = 
        parseFloat(formData.warp_weight || '0') + 
        parseFloat(formData.weft_weight || '0') + 
        parseFloat(formData.zari_weight || '0');

      const { error } = await supabase.from('warp_sheet').insert({
        frm_code: company!.frm_code,
        weave_name: formData.weave_name,
        warp_type: formData.warp_type,
        weft_type: formData.weft_type,
        product_id: formData.product_id,
        reed: parseInt(formData.reed || '0'),
        thread: parseInt(formData.thread || '0'),
        card_count: parseInt(formData.card_count || '0'),
        mark_count: parseInt(formData.mark_count || '0'),
        warp_weight_kg: parseFloat(formData.warp_weight || '0'),
        weft_weight_kg: parseFloat(formData.weft_weight || '0'),
        zari_weight_kg: parseFloat(formData.zari_weight || '0'),
        item_weight_kg: parseFloat(formData.item_weight || '0'),
        total_weight_kg: total_weight,
        mfg_wages_rate: parseFloat(formData.mfg_wages_rate || '0'),
      });

      if (error) throw error;
      
      alert('Warp Design Sheet created successfully!');
      setFormData({
        weave_name: '', warp_type: 'Silk', weft_type: 'Cotton',
        product_id: null, product_name: '', reed: '', thread: '',
        card_count: '', mark_count: '', warp_weight: '', weft_weight: '',
        zari_weight: '', item_weight: '', mfg_wages_rate: '',
      });
      fetchSheets();
    } catch (error: any) {
      console.error('Error saving sheet:', error);
      alert('Failed to save warp design sheet.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSheets = sheets.filter(
    (sheet) =>
      sheet.weave_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Warp Design Sheets</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Design Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="weave_name">Weave Name</Label>
                <Input
                  id="weave_name"
                  value={formData.weave_name}
                  onChange={(e) => setFormData({ ...formData, weave_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Warp Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.warp_type}
                  onChange={(e) => setFormData({ ...formData, warp_type: e.target.value })}
                >
                  <option value="Silk">Silk</option>
                  <option value="Cotton">Cotton</option>
                  <option value="Zari">Zari</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Weft Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.weft_type}
                  onChange={(e) => setFormData({ ...formData, weft_type: e.target.value })}
                >
                  <option value="Cotton">Cotton</option>
                  <option value="Silk">Silk</option>
                  <option value="Zari">Zari</option>
                </select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Product / Saree</Label>
                <ProductSearch
                  onSelect={(p) => setFormData({ ...formData, product_id: p.id, product_name: p.name })}
                />
                {formData.product_name && (
                  <Badge variant="secondary" className="mt-2">
                    {formData.product_name}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>Reed</Label>
                <Input
                  type="number"
                  value={formData.reed}
                  onChange={(e) => setFormData({ ...formData, reed: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Thread</Label>
                <Input
                  type="number"
                  value={formData.thread}
                  onChange={(e) => setFormData({ ...formData, thread: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Card Count</Label>
                <Input
                  type="number"
                  value={formData.card_count}
                  onChange={(e) => setFormData({ ...formData, card_count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mark Count</Label>
                <Input
                  type="number"
                  value={formData.mark_count}
                  onChange={(e) => setFormData({ ...formData, mark_count: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Warp Weight (kg)</Label>
                <Input
                  type="number"
                  value={formData.warp_weight}
                  onChange={(e) => setFormData({ ...formData, warp_weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Weft Weight (kg)</Label>
                <Input
                  type="number"
                  value={formData.weft_weight}
                  onChange={(e) => setFormData({ ...formData, weft_weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Zari Weight (kg)</Label>
                <Input
                  type="number"
                  value={formData.zari_weight}
                  onChange={(e) => setFormData({ ...formData, zari_weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Item Weight (kg)</Label>
                <Input
                  type="number"
                  value={formData.item_weight}
                  onChange={(e) => setFormData({ ...formData, item_weight: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Mfg Wages Rate</Label>
                <Input
                  type="number"
                  value={formData.mfg_wages_rate}
                  onChange={(e) => setFormData({ ...formData, mfg_wages_rate: e.target.value })}
                />
              </div>
            </div>

            <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Design Sheet'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Existing Sheets</CardTitle>
              <Input
                placeholder="Search weave name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading sheets...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Weave</TableHead>
                      <TableHead>Warp/Weft</TableHead>
                      <TableHead>Total Wt</TableHead>
                      <TableHead>Wages Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSheets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No sheets found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSheets.map((sheet) => (
                        <TableRow key={sheet.id}>
                          <TableCell className="font-medium">{sheet.weave_name}</TableCell>
                          <TableCell>{sheet.warp_type} / {sheet.weft_type}</TableCell>
                          <TableCell>{sheet.total_weight_kg} kg</TableCell>
                          <TableCell>{formatCurrency(sheet.mfg_wages_rate)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
