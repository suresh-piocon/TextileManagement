'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LedgerSearch } from '@/components/search/ledger-search';


type Loom = {
  id: string;
  frm_code: string;
  loom_no: string;
  weaver_id: string | null;
  sub_weaver_name: string | null;
  design_sheet_id: string | null;
  remarks: string | null;
  created_at: string;
};

type WarpStatus = {
  id: string;
  loom_id: string;
  loom_no: string;
  weaver_name: string;
  warp_date: string;
  warp_qty: number;
  status: 'New' | 'Running' | 'Completed';
};

export default function LoomPage() {
  const { company } = useApp();
  const supabase = createClient();

  const [looms, setLooms] = useState<Loom[]>([]);
  const [warpStatuses, setWarpStatuses] = useState<WarpStatus[]>([]);
  
  const [loomNo, setLoomNo] = useState('');
  const [weaverId, setWeaverId] = useState('');
  const [subWeaverName, setSubWeaverName] = useState('');
  const [designSheetId, setDesignSheetId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [warpQty, setWarpQty] = useState(0);

  const loadData = async () => {
    if (!company?.frm_code) return;
    
    const { data: loomData } = await supabase
      .from('loom')
      .select('*')
      .eq('frm_code', company.frm_code);
      
    if (loomData) {
      setLooms(loomData);
    }
  };

  useEffect(() => {
    loadData();
  }, [company]);

  const handleSaveLoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.frm_code) return;

    try {
      const { data, error } = await supabase.from('loom').insert({
        frm_code: company.frm_code,
        loom_no: loomNo,
        weaver_id: weaverId || null,
        sub_weaver_name: subWeaverName,
        design_sheet_id: designSheetId,
        remarks: remarks
      }).select();

      if (error) throw error;
      
      alert('Loom created successfully');
      
      setLoomNo('');
      setWeaverId('');
      setSubWeaverName('');
      setDesignSheetId('');
      setRemarks('');
      
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create loom');
    }
  };

  const handleCompleteWarp = async (id: string) => {
      alert('Warp marked as completed');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Loom & Warp Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Define Loom & Assign Warp</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveLoom} className="space-y-4">
              <div className="space-y-2">
                <Label>Loom No</Label>
                <Input value={loomNo} onChange={(e) => setLoomNo(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Master Weaver</Label>
                <LedgerSearch value={weaverId} onSelect={(l: any) => setWeaverId(l.ledg_code.toString())} />
              </div>
              <div className="space-y-2">
                <Label>Sub-Weaver Name</Label>
                <Input value={subWeaverName} onChange={(e) => setSubWeaverName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Design Sheet Ref</Label>
                <Input value={designSheetId} onChange={(e) => setDesignSheetId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Warp Quantity (Mtrs)</Label>
                <Input type="number" value={warpQty} onChange={(e) => setWarpQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              
              <Button type="submit">Save & Assign Warp</Button>
            </form>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Warp Status Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loom No</TableHead>
                  <TableHead>Weaver</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warpStatuses.map(status => (
                  <TableRow key={status.id}>
                    <TableCell>{status.loom_no}</TableCell>
                    <TableCell>{status.weaver_name}</TableCell>
                    <TableCell>{status.warp_qty}</TableCell>
                    <TableCell>
                      <Badge variant={status.status === 'Completed' ? 'default' : 'secondary'}>
                        {status.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status.status !== 'Completed' && (
                        <Button size="sm" variant="outline" onClick={() => handleCompleteWarp(status.id)}>
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {warpStatuses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No active warps</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
