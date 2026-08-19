'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { formatCurrency } from '@/lib/utils';
import { Trash } from 'lucide-react';

type LineItem = {
  id: string;
  item_name: string;
  units: string;
  qty: number;
  rate: number;
  amount: number;
};

export default function ProductCostingPage() {
  const { company } = useApp();
  const supabase = createClient();
  
  const [designSheet, setDesignSheet] = useState('');
  const [netQty, setNetQty] = useState(1);
  const [items, setItems] = useState<LineItem[]>([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newUnits, setNewUnits] = useState('Kg');
  const [newQty, setNewQty] = useState(0);
  const [newRate, setNewRate] = useState(0);
  
  const [savedCostings, setSavedCostings] = useState<any[]>([]);

  const loadData = async () => {
    if (!company?.frm_code) return;
    const { data } = await supabase
      .from('cost_mast')
      .select('*')
      .eq('frm_code', company.frm_code);
    if (data) setSavedCostings(data);
  };

  useEffect(() => {
    loadData();
  }, [company]);

  const addItem = () => {
    if (!newItemName) return;
    const amount = newQty * newRate;
    setItems([...items, { id: Date.now().toString(), item_name: newItemName, units: newUnits, qty: newQty, rate: newRate, amount }]);
    setNewItemName('');
    setNewQty(0);
    setNewRate(0);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const totalCost = items.reduce((sum, item) => sum + item.amount, 0);
  const costPerSaree = netQty > 0 ? totalCost / netQty : 0;

  const handleSave = async () => {
    if (!company?.frm_code) return;
    
    try {
      const { data: mastData, error: mastError } = await supabase.from('cost_mast').insert({
        frm_code: company.frm_code,
        design_sheet: designSheet,
        net_qty: netQty,
        total_cost: totalCost,
        cost_per_saree: costPerSaree
      }).select().single();
      
      if (mastError) throw mastError;
      
      const childData = items.map(item => ({
        frm_code: company.frm_code,
        cost_mast_id: mastData.id,
        item_name: item.item_name,
        units: item.units,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount
      }));
      
      if (childData.length > 0) {
        const { error: childError } = await supabase.from('cost_child').insert(childData);
        if (childError) throw childError;
      }
      
      alert('Cost sheet saved successfully');
      setDesignSheet('');
      setNetQty(1);
      setItems([]);
      loadData();
      
    } catch (err: any) {
      alert(err.message || 'Error saving cost sheet');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Product Costing Sheet</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calculate Cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Design Sheet / Product</Label>
                <Input value={designSheet} onChange={(e) => setDesignSheet(e.target.value)} placeholder="e.g. D-101" />
              </div>
              <div className="space-y-2">
                <Label>Expected Sarees (Net Qty)</Label>
                <Input type="number" value={netQty} onChange={(e) => setNetQty(Number(e.target.value))} min={1} />
              </div>
            </div>
            
            <div className="border p-4 rounded-md space-y-4 bg-muted/20">
              <h3 className="font-semibold text-sm">Add Material / Job Work</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">Item (Yarn, Zari, Wages)</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  >
                    <option value="">Select Item</option>
                    <option value="Silk Yarn">Silk Yarn</option>
                    <option value="Zari">Zari</option>
                    <option value="Dyeing Charges">Dyeing Charges</option>
                    <option value="Twisting Charges">Twisting Charges</option>
                    <option value="Weaving Wages">Weaving Wages</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" step="0.01" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Rate</Label>
                  <Input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} />
                </div>
                <Button onClick={addItem} type="button">Add</Button>
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell className="text-right">{item.qty} {item.units}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Total Cost</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totalCost)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="bg-primary/10 p-4 rounded-md flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Cost per Saree</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(costPerSaree)}</p>
              </div>
              <Button onClick={handleSave} disabled={items.length === 0 || !designSheet}>Save Cost Sheet</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Saved Cost Sheets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Design Sheet</TableHead>
                  <TableHead className="text-right">Net Qty</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Cost/Saree</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedCostings.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium">{cost.design_sheet}</TableCell>
                    <TableCell className="text-right">{cost.net_qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cost.total_cost)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(cost.cost_per_saree)}</TableCell>
                  </TableRow>
                ))}
                {savedCostings.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center">No cost sheets saved</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
