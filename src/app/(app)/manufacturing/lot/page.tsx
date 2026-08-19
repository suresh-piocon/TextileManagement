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
import { LedgerSearch } from '@/components/search/ledger-search';

export default function ProductionLotPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    lot_no: '',
    lot_name: '',
    date: new Date().toISOString().split('T')[0],
    party_id: null as number | null,
    party_name: '',
  });

  useEffect(() => {
    if (company?.frm_code) {
      fetchLots();
    }
  }, [company]);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lot_info')
        .select('*')
        .eq('frm_code', company!.frm_code)
        .order('id', { ascending: false });

      if (error) throw error;
      setLots(data || []);
    } catch (error: any) {
      console.error('Error fetching lots:', error);
      alert('Failed to load lots.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.lot_no || !formData.lot_name || !formData.party_id) {
      alert('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('lot_info').insert({
        frm_code: company!.frm_code,
        lot_no: formData.lot_no,
        lot_name: formData.lot_name,
        date: formData.date,
        party_id: formData.party_id,
      });

      if (error) throw error;
      
      alert('Production lot created successfully!');
      setFormData({
        ...formData,
        lot_no: '',
        lot_name: '',
        party_id: null,
        party_name: '',
      });
      fetchLots();
    } catch (error: any) {
      console.error('Error saving lot:', error);
      alert('Failed to save production lot.');
    } finally {
      setSaving(false);
    }
  };

  const filteredLots = lots.filter(
    (lot) =>
      lot.lot_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.lot_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Production Lots</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Create New Lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lot_no">Lot No</Label>
              <Input
                id="lot_no"
                value={formData.lot_no}
                onChange={(e) => setFormData({ ...formData, lot_no: e.target.value })}
                placeholder="Auto / Manual"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lot_name">Lot Name</Label>
              <Input
                id="lot_name"
                value={formData.lot_name}
                onChange={(e) => setFormData({ ...formData, lot_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Party / Supplier</Label>
              <LedgerSearch
                onSelect={(ledger) =>
                  setFormData({ ...formData, party_id: ledger.id, party_name: ledger.name })
                }
                placeholder="Search supplier..."
              />
              {formData.party_name && (
                <Badge variant="secondary" className="mt-2">
                  {formData.party_name}
                </Badge>
              )}
            </div>

            <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Production Lot'}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Existing Lots</CardTitle>
              <Input
                placeholder="Search lot no or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading lots...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot No</TableHead>
                      <TableHead>Lot Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Party ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No lots found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLots.map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell className="font-medium">{lot.lot_no}</TableCell>
                          <TableCell>{lot.lot_name}</TableCell>
                          <TableCell>{new Date(lot.date).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell>{lot.party_id}</TableCell>
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
