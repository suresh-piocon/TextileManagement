'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { INDIAN_STATES } from '@/lib/constants';

export default function LedgerPage() {
  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({ acc_type: 'Dr', op_bal_type: 'Dr', reg_no: '50' });
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const [ledgersRes, groupsRes] = await Promise.all([
        supabase.from('ledger').select('*, group_master(grp_name)').eq('frm_code', company.frm_code).order('ledg_code', { ascending: false }),
        supabase.from('group_master').select('*').order('grp_name')
      ]);
        
      if (ledgersRes.error) throw ledgersRes.error;
      if (groupsRes.error) throw groupsRes.error;
      
      setRecords(ledgersRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (e: any) {
      toast({ title: 'Error fetching ledgers', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, supabase, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleStateChange = (selectedStateName: string) => {
    const stateObj = INDIAN_STATES.find(s => s.name === selectedStateName);
    const stateCode = stateObj ? stateObj.code : '';
    
    // Determine company state code
    const compStCode = company?.st_code || INDIAN_STATES.find(s => s.name.toLowerCase() === company?.state?.toLowerCase())?.code || '';
    
    // Auto-select registration type: 50 (IntraState) if state matches company state, else 51 (InterState)
    const regNo = (stateCode && compStCode && stateCode === compStCode) ? '50' : (stateCode ? '51' : (formData.reg_no || '50'));

    setFormData((prev: any) => ({
      ...prev,
      state: selectedStateName,
      state_code: stateCode,
      reg_no: regNo
    }));
  };

  const selectedGroup = groups.find(g => String(g.grp_id) === String(formData.grp_id));
  const isSundryCreditors = selectedGroup?.grp_name?.toLowerCase().includes('sundry creditors') || Number(formData.grp_id) === 65;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.frm_code) return;
    try {
      const payload = { ...formData, frm_code: company.frm_code };
      delete payload.group_master; // Remove joined data

      let error;
      if (formData.ledg_code) {
        const { error: updateError } = await supabase
          .from('ledger')
          .update(payload)
          .eq('ledg_code', formData.ledg_code);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('ledger')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      toast({ title: 'Ledger saved successfully', variant: 'success' });
      setShowForm(false);
      setFormData({ acc_type: 'Dr', op_bal_type: 'Dr', reg_no: '50' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error saving ledger', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ledger?')) return;
    try {
      const { error } = await supabase.from('ledger').delete().eq('ledg_code', id);
      if (error) throw error;
      toast({ title: 'Ledger deleted', variant: 'success' });
      fetchRecords();
    } catch (e: any) {
      toast({ title: 'Error deleting ledger', variant: 'destructive' });
    }
  };

  const filteredRecords = records.filter(r => 
    r.ledg_name?.toLowerCase().includes(search.toLowerCase()) || 
    r.city?.toLowerCase().includes(search.toLowerCase()) ||
    r.gstin?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ledger Master</h1>
        <Button onClick={() => { setFormData({ acc_type: 'Dr', op_bal_type: 'Dr', reg_no: '50' }); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Ledger'}
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border rounded-md bg-card">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Basic Info */}
            <div className="col-span-3 font-semibold border-b pb-2 mt-2">Basic Info</div>
            <div>
              <Label>Ledger Name</Label>
              <Input value={formData.ledg_name || ''} onChange={e => setFormData({...formData, ledg_name: e.target.value})} required />
            </div>
            <div>
              <Label>Print Name</Label>
              <Input value={formData.print_name || ''} onChange={e => setFormData({...formData, print_name: e.target.value})} />
            </div>
            <div>
              <Label>Group</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.grp_id || ''} onChange={e => setFormData({...formData, grp_id: e.target.value})} required>
                <option value="">Select Group</option>
                {groups.map(g => <option key={g.grp_id} value={g.grp_id}>{g.grp_name}</option>)}
              </select>
            </div>

            {/* Address */}
            <div className="col-span-3 font-semibold border-b pb-2 mt-2">Address</div>
            <div>
              <Label>Address 1</Label>
              <Input value={formData.add1 || ''} onChange={e => setFormData({...formData, add1: e.target.value})} />
            </div>
            <div>
              <Label>Address 2</Label>
              <Input value={formData.add2 || ''} onChange={e => setFormData({...formData, add2: e.target.value})} />
            </div>
            <div>
              <Label>Address 3</Label>
              <Input value={formData.add3 || ''} onChange={e => setFormData({...formData, add3: e.target.value})} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input value={formData.pin_code || ''} onChange={e => setFormData({...formData, pin_code: e.target.value})} />
            </div>
            <div>
              <Label>State</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                value={formData.state || ''} 
                onChange={e => handleStateChange(e.target.value)}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>State Code (GST)</Label>
              <Input value={formData.state_code || ''} readOnly className="bg-muted font-mono" placeholder="Auto-filled" />
            </div>

            {/* Tax Info */}
            <div className="col-span-3 font-semibold border-b pb-2 mt-2">Tax Info</div>
            <div>
              <Label>GSTIN</Label>
              <Input value={formData.gstin || ''} onChange={e => setFormData({...formData, gstin: e.target.value})} />
            </div>
            <div>
              <Label>Registration Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={String(formData.reg_no || '50')} onChange={e => setFormData({...formData, reg_no: e.target.value})}>
                <option value="50">50 - IntraState</option>
                <option value="51">51 - InterState</option>
              </select>
            </div>
            <div>
              <Label>PAN No</Label>
              <Input value={formData.pan_no || ''} onChange={e => setFormData({...formData, pan_no: e.target.value})} />
            </div>

            {/* Contact */}
            <div className="col-span-3 font-semibold border-b pb-2 mt-2">Contact & Account</div>
            <div>
              <Label>Cell No 1</Label>
              <Input value={formData.cell_no1 || ''} onChange={e => setFormData({...formData, cell_no1: e.target.value})} />
            </div>
            <div>
              <Label>Cell No 2</Label>
              <Input value={formData.cell_no2 || ''} onChange={e => setFormData({...formData, cell_no2: e.target.value})} />
            </div>
            <div>
              <Label>Phone No</Label>
              <Input value={formData.ph_no || ''} onChange={e => setFormData({...formData, ph_no: e.target.value})} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} type="email" />
            </div>
            <div>
              <Label>Opening Balance</Label>
              <div className="flex gap-2">
                <Input type="number" value={formData.op_bal || 0} onChange={e => setFormData({...formData, op_bal: parseFloat(e.target.value)})} className="flex-1" />
                <select className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.op_bal_type || 'Dr'} onChange={e => setFormData({...formData, op_bal_type: e.target.value})}>
                  <option value="Dr">Dr</option>
                  <option value="Cr">Cr</option>
                </select>
              </div>
            </div>

            {/* Bank Details for Sundry Creditors */}
            {isSundryCreditors && (
              <>
                <div className="col-span-3 font-semibold border-b pb-2 mt-2 text-primary">Bank Account Details (Sundry Creditors)</div>
                <div>
                  <Label>A/C No</Label>
                  <Input value={formData.bank_acc_no || ''} onChange={e => setFormData({...formData, bank_acc_no: e.target.value})} placeholder="Account Number" />
                </div>
                <div>
                  <Label>A/C Name</Label>
                  <Input value={formData.bank_acc_name || ''} onChange={e => setFormData({...formData, bank_acc_name: e.target.value})} placeholder="Account Holder Name" />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input value={formData.bank_ifsc || ''} onChange={e => setFormData({...formData, bank_ifsc: e.target.value})} placeholder="IFSC Code" />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input value={formData.bank_name || ''} onChange={e => setFormData({...formData, bank_name: e.target.value})} placeholder="Bank Name" />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input value={formData.bank_branch || ''} onChange={e => setFormData({...formData, bank_branch: e.target.value})} placeholder="Branch Name" />
                </div>
              </>
            )}
            
            <div className="col-span-3 pt-4">
              <Button type="submit">Save Ledger</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Search by name, city, GSTIN..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>State</TableHead>
              <TableHead>State Code</TableHead>
              <TableHead>Cell No 1</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Op. Bal</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => (
                <TableRow key={record.ledg_code}>
                  <TableCell>{record.ledg_code}</TableCell>
                  <TableCell>{record.ledg_name}</TableCell>
                  <TableCell>{record.group_master?.grp_name}</TableCell>
                  <TableCell>{record.state}</TableCell>
                  <TableCell>{record.state_code}</TableCell>
                  <TableCell>{record.cell_no1 || record.cell_no}</TableCell>
                  <TableCell>{record.gstin}</TableCell>
                  <TableCell>{record.op_bal} {record.op_bal_type}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setFormData(record); setShowForm(true); }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(record.ledg_code)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
