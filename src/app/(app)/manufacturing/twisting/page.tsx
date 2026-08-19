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

export default function TwistingPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'issue' | 'receive'>('issue');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Issue State
  const [issueData, setIssueData] = useState({
    twister_id: null as number | null,
    twister_name: '',
    job_work_ac_id: null as number | null,
    job_work_ac_name: '',
    issue_date: new Date().toISOString().split('T')[0],
    items: [] as any[],
  });
  
  // Receive State
  const [receiveData, setReceiveData] = useState({
    twister_id: null as number | null,
    twister_name: '',
    recd_date: new Date().toISOString().split('T')[0],
    items: [] as any[],
  });

  const [issueItem, setIssueItem] = useState({
    product_id: null as number | null,
    product_name: '',
    weight: '',
    yarn_type: 'Cotton',
  });

  const [receiveItem, setReceiveItem] = useState({
    weight: '',
    wages_rate: '',
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
      const table = activeTab === 'issue' ? 'twist_master' : 'twist_recd_master';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('frm_code', company!.frm_code)
        .order('id', { ascending: false });

      if (error && error.code !== '42P01') throw error; // ignore table not found for now
      setHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const addIssueItem = () => {
    if (!issueItem.product_id || !issueItem.weight) {
      alert('Please select product and weight');
      return;
    }
    setIssueData({
      ...issueData,
      items: [...issueData.items, { ...issueItem }],
    });
    setIssueItem({ product_id: null, product_name: '', weight: '', yarn_type: 'Cotton' });
  };

  const addReceiveItem = () => {
    if (!receiveItem.weight || !receiveItem.wages_rate) {
      alert('Please enter weight and rate');
      return;
    }
    const amount = parseFloat(receiveItem.weight) * parseFloat(receiveItem.wages_rate);
    setReceiveData({
      ...receiveData,
      items: [...receiveData.items, { ...receiveItem, wages_amount: amount }],
    });
    setReceiveItem({ weight: '', wages_rate: '' });
  };

  const handleSaveIssue = async () => {
    if (!issueData.twister_id || issueData.items.length === 0) {
      alert('Please select twister and add items');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('twist_master')
        .insert({
          frm_code: company!.frm_code,
          twister_id: issueData.twister_id,
          job_work_ac_id: issueData.job_work_ac_id,
          issue_date: issueData.issue_date,
        })
        .select()
        .single();

      if (error) throw error;

      const childItems = issueData.items.map(item => ({
        master_id: data.id,
        product_id: item.product_id,
        weight_kg: parseFloat(item.weight),
        yarn_type: item.yarn_type,
      }));

      const { error: childError } = await supabase
        .from('twist_child')
        .insert(childItems);

      if (childError) throw childError;

      alert('Yarn issue saved successfully!');
      setIssueData({ ...issueData, items: [], twister_id: null, twister_name: '' });
      fetchHistory();
    } catch (error: any) {
      console.error('Error saving issue:', error);
      alert('Failed to save issue: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReceive = async () => {
    if (!receiveData.twister_id || receiveData.items.length === 0) {
      alert('Please select twister and add items');
      return;
    }
    setSaving(true);
    try {
      const total_wages = receiveData.items.reduce((sum, item) => sum + item.wages_amount, 0);

      const { data, error } = await supabase
        .from('twist_recd_master')
        .insert({
          frm_code: company!.frm_code,
          twister_id: receiveData.twister_id,
          recd_date: receiveData.recd_date,
          total_wages_amount: total_wages,
        })
        .select()
        .single();

      if (error) throw error;

      const childItems = receiveData.items.map(item => ({
        master_id: data.id,
        weight_kg: parseFloat(item.weight),
        wages_rate: parseFloat(item.wages_rate),
        wages_amount: item.wages_amount,
      }));

      const { error: childError } = await supabase
        .from('twist_recd_child')
        .insert(childItems);

      if (childError) throw childError;

      alert('Yarn receipt saved successfully!');
      setReceiveData({ ...receiveData, items: [], twister_id: null, twister_name: '' });
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
        <h1 className="text-3xl font-bold tracking-tight">Yarn Twisting</h1>
      </div>

      <div className="flex space-x-4 mb-4">
        <Button
          variant={activeTab === 'issue' ? 'default' : 'outline'}
          onClick={() => setActiveTab('issue')}
        >
          Issue Yarn to Twister
        </Button>
        <Button
          variant={activeTab === 'receive' ? 'default' : 'outline'}
          onClick={() => setActiveTab('receive')}
        >
          Receive Twisted Yarn
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
                <Label>Twister</Label>
                <LedgerSearch
                  onSelect={(l) => setIssueData({ ...issueData, twister_id: l.id, twister_name: l.name })}
                />
                {issueData.twister_name && <Badge>{issueData.twister_name}</Badge>}
              </div>
              <div className="space-y-2">
                <Label>Job Work A/c</Label>
                <LedgerSearch
                  onSelect={(l) => setIssueData({ ...issueData, job_work_ac_id: l.id, job_work_ac_name: l.name })}
                />
                {issueData.job_work_ac_name && <Badge>{issueData.job_work_ac_name}</Badge>}
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
                    <Label>Yarn Type</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={issueItem.yarn_type}
                      onChange={(e) => setIssueItem({ ...issueItem, yarn_type: e.target.value })}
                    >
                      <option value="Cotton">Cotton</option>
                      <option value="Silk">Silk</option>
                      <option value="Zari">Zari</option>
                    </select>
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
                        <TableHead>Type</TableHead>
                        <TableHead>Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issueData.items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell>{it.yarn_type}</TableCell>
                          <TableCell>{it.weight} kg</TableCell>
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
                    <TableHead>Twister ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{new Date(h.issue_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{h.twister_id}</TableCell>
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
              <CardTitle>Receive Yarn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Twister</Label>
                <LedgerSearch
                  onSelect={(l) => setReceiveData({ ...receiveData, twister_id: l.id, twister_name: l.name })}
                />
                {receiveData.twister_name && <Badge>{receiveData.twister_name}</Badge>}
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
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      value={receiveItem.weight}
                      onChange={(e) => setReceiveItem({ ...receiveItem, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wages Rate</Label>
                    <Input
                      type="number"
                      value={receiveItem.wages_rate}
                      onChange={(e) => setReceiveItem({ ...receiveItem, wages_rate: e.target.value })}
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
                        <TableHead>Weight</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiveData.items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{it.weight} kg</TableCell>
                          <TableCell>{formatCurrency(it.wages_rate)}</TableCell>
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
                    <TableHead>Twister ID</TableHead>
                    <TableHead>Total Wages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{new Date(h.recd_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{h.twister_id}</TableCell>
                      <TableCell>{formatCurrency(h.total_wages_amount)}</TableCell>
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
