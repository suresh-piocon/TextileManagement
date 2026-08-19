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
import { ProductSearch } from '@/components/search/product-search';
import { formatCurrency } from '@/lib/utils';

export default function DyeingPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'issue' | 'receive'>('issue');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Issue State
  const [issueData, setIssueData] = useState({
    dyer_id: null as number | null,
    dyer_name: '',
    charges_ac_id: null as number | null,
    charges_ac_name: '',
    issue_date: new Date().toISOString().split('T')[0],
    items: [] as any[],
  });
  
  // Receive State
  const [receiveData, setReceiveData] = useState({
    dyer_id: null as number | null,
    dyer_name: '',
    recd_date: new Date().toISOString().split('T')[0],
    items: [] as any[],
  });

  const [issueItem, setIssueItem] = useState({
    product_id: null as number | null,
    product_name: '',
    weight: '',
    rate: '',
  });

  const [receiveItem, setReceiveItem] = useState({
    product_id: null as number | null,
    product_name: '',
    weight: '',
    waste_kg: '',
    colour: 'Red',
    wages_amount: '',
  });

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (company?.frm_code) {
      fetchHistory();
    }
  }, [company, activeTab]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const table = activeTab === 'issue' ? 'dyeing_issue_master' : 'dyeing_recd_master';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('frm_code', company!.frm_code)
        .order('id', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const addIssueItem = () => {
    if (!issueItem.product_id || !issueItem.weight || !issueItem.rate) {
      alert('Please fill product, weight, and rate');
      return;
    }
    const total = parseFloat(issueItem.weight) * parseFloat(issueItem.rate);
    setIssueData({
      ...issueData,
      items: [...issueData.items, { ...issueItem, total }],
    });
    setIssueItem({ product_id: null, product_name: '', weight: '', rate: '' });
  };

  const addReceiveItem = () => {
    if (!receiveItem.product_id || !receiveItem.weight || !receiveItem.wages_amount) {
      alert('Please fill product, weight, and wages amount');
      return;
    }
    setReceiveData({
      ...receiveData,
      items: [...receiveData.items, { ...receiveItem }],
    });
    setReceiveItem({ product_id: null, product_name: '', weight: '', waste_kg: '', colour: 'Red', wages_amount: '' });
  };

  const handleSaveIssue = async () => {
    if (!issueData.dyer_id || issueData.items.length === 0) {
      alert('Please select dyer and add items');
      return;
    }
    setSaving(true);
    try {
      const total_amount = issueData.items.reduce((sum, item) => sum + item.total, 0);

      const { data, error } = await supabase
        .from('dyeing_issue_master')
        .insert({
          frm_code: company!.frm_code,
          dyer_id: issueData.dyer_id,
          charges_ac_id: issueData.charges_ac_id,
          issue_date: issueData.issue_date,
          total_amount,
        })
        .select()
        .single();

      if (error) throw error;

      const childItems = issueData.items.map(item => ({
        master_id: data.id,
        product_id: item.product_id,
        weight_kg: parseFloat(item.weight),
        rate: parseFloat(item.rate),
        total_amount: item.total,
      }));

      const { error: childError } = await supabase
        .from('dyeing_issue_child')
        .insert(childItems);

      if (childError) throw childError;

      alert('Yarn issue saved successfully!');
      setIssueData({ ...issueData, items: [], dyer_id: null, dyer_name: '' });
      fetchHistory();
    } catch (error: any) {
      console.error('Error saving issue:', error);
      alert('Failed to save issue: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReceive = async () => {
    if (!receiveData.dyer_id || receiveData.items.length === 0) {
      alert('Please select dyer and add items');
      return;
    }
    setSaving(true);
    try {
      const total_wages = receiveData.items.reduce((sum, item) => sum + parseFloat(item.wages_amount), 0);

      const { data, error } = await supabase
        .from('dyeing_recd_master')
        .insert({
          frm_code: company!.frm_code,
          dyer_id: receiveData.dyer_id,
          recd_date: receiveData.recd_date,
          total_wages_amount: total_wages,
        })
        .select()
        .single();

      if (error) throw error;

      const childItems = receiveData.items.map(item => ({
        master_id: data.id,
        product_id: item.product_id,
        weight_kg: parseFloat(item.weight),
        waste_kg: parseFloat(item.waste_kg || '0'),
        colour_info: item.colour,
        wages_amount: parseFloat(item.wages_amount),
      }));

      const { error: childError } = await supabase
        .from('dyeing_recd_child')
        .insert(childItems);

      if (childError) throw childError;

      alert('Yarn receipt saved successfully!');
      setReceiveData({ ...receiveData, items: [], dyer_id: null, dyer_name: '' });
      fetchHistory();
    } catch (error: any) {
      console.error('Error saving receipt:', error);
      alert('Failed to save receipt: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Yarn Dyeing</h1>
      </div>

      <div className="flex space-x-4 mb-4">
        <Button
          variant={activeTab === 'issue' ? 'default' : 'outline'}
          onClick={() => setActiveTab('issue')}
        >
          Issue Yarn to Dyer
        </Button>
        <Button
          variant={activeTab === 'receive' ? 'default' : 'outline'}
          onClick={() => setActiveTab('receive')}
        >
          Receive Dyed Yarn
        </Button>
      </div>

      {activeTab === 'issue' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Issue Yarn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dyer</Label>
                <LedgerSearch
                  onSelect={(l) => setIssueData({ ...issueData, dyer_id: l.id, dyer_name: l.name })}
                />
                {issueData.dyer_name && <Badge>{issueData.dyer_name}</Badge>}
              </div>
              <div className="space-y-2">
                <Label>Dyeing Charges A/c</Label>
                <LedgerSearch
                  onSelect={(l) => setIssueData({ ...issueData, charges_ac_id: l.id, charges_ac_name: l.name })}
                />
                {issueData.charges_ac_name && <Badge>{issueData.charges_ac_name}</Badge>}
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={issueData.issue_date}
                  onChange={(e) => setIssueData({ ...issueData, issue_date: e.target.value })}
                />
              </div>

              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="font-semibold">Add Items</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Yarn Product</Label>
                    <ProductSearch
                      onSelect={(p) => setIssueItem({ ...issueItem, product_id: p.id, product_name: p.name })}
                    />
                    {issueItem.product_name && <Badge>{issueItem.product_name}</Badge>}
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      value={issueItem.weight}
                      onChange={(e) => setIssueItem({ ...issueItem, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      value={issueItem.rate}
                      onChange={(e) => setIssueItem({ ...issueItem, rate: e.target.value })}
                    />
                  </div>
                </div>
                <Button variant="secondary" onClick={addIssueItem}>Add Item</Button>
              </div>

              {issueData.items.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issueData.items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell>{it.weight} kg</TableCell>
                          <TableCell>{formatCurrency(it.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button className="w-full mt-4" onClick={handleSaveIssue} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Issue Entry'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Dyer ID</TableHead>
                    <TableHead>Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{new Date(h.issue_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{h.dyer_id}</TableCell>
                      <TableCell>{formatCurrency(h.total_amount || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'receive' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Receive Dyed Yarn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dyer</Label>
                <LedgerSearch
                  onSelect={(l) => setReceiveData({ ...receiveData, dyer_id: l.id, dyer_name: l.name })}
                />
                {receiveData.dyer_name && <Badge>{receiveData.dyer_name}</Badge>}
              </div>
              <div className="space-y-2">
                <Label>Receive Date</Label>
                <Input
                  type="date"
                  value={receiveData.recd_date}
                  onChange={(e) => setReceiveData({ ...receiveData, recd_date: e.target.value })}
                />
              </div>

              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="font-semibold">Add Items</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Yarn Product</Label>
                    <ProductSearch
                      onSelect={(p) => setReceiveItem({ ...receiveItem, product_id: p.id, product_name: p.name })}
                    />
                    {receiveItem.product_name && <Badge>{receiveItem.product_name}</Badge>}
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      value={receiveItem.weight}
                      onChange={(e) => setReceiveItem({ ...receiveItem, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Waste (kg)</Label>
                    <Input
                      type="number"
                      value={receiveItem.waste_kg}
                      onChange={(e) => setReceiveItem({ ...receiveItem, waste_kg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colour</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={receiveItem.colour}
                      onChange={(e) => setReceiveItem({ ...receiveItem, colour: e.target.value })}
                    >
                      <option value="Red">Red</option>
                      <option value="Blue">Blue</option>
                      <option value="Green">Green</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Black">Black</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Wages Amount</Label>
                    <Input
                      type="number"
                      value={receiveItem.wages_amount}
                      onChange={(e) => setReceiveItem({ ...receiveItem, wages_amount: e.target.value })}
                    />
                  </div>
                </div>
                <Button variant="secondary" onClick={addReceiveItem}>Add Item</Button>
              </div>

              {receiveData.items.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Colour</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Wages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiveData.items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell>{it.colour}</TableCell>
                          <TableCell>{it.weight} kg</TableCell>
                          <TableCell>{formatCurrency(it.wages_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button className="w-full mt-4" onClick={handleSaveReceive} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Receipt Entry'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Dyer ID</TableHead>
                    <TableHead>Total Wages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{new Date(h.recd_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{h.dyer_id}</TableCell>
                      <TableCell>{formatCurrency(h.total_wages_amount || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
