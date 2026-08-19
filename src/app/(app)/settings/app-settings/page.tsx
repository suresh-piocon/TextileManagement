'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { LedgerSearch } from '@/components/search/ledger-search';

export default function AppSettings() {
  const { company } = useApp();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (company?.frm_code) {
      loadSettings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.frm_code]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_setting')
      .select('*')
      .eq('frm_code', company!.frm_code)
      .single();
    
    if (data) {
      setSettings(data);
    } else {
      // Initialize defaults if not present
      setSettings({
        barcode: '',
        bill_type: 'Tax',
        round_off: 'Manual',
        zari_wt: 0,
        pur_slip_char: 'P',
        sal_slip_char: 'S',
        cash_ldg_no: 0,
        bank_ldg_no: 0,
        sale_tax_ldg_no: 0,
        pur_tax_ldg_no: 0
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { id, ...payload } = settings;
    
    if (id) {
      await supabase
        .from('app_setting')
        .update(payload)
        .eq('id', id);
    } else {
      await supabase
        .from('app_setting')
        .insert([{ ...payload, frm_code: company!.frm_code }]);
      await loadSettings();
    }
    setSaving(false);
    alert('Settings saved successfully');
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6">
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Configure global application settings for your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">General</h3>
                
                <div className="grid gap-2">
                  <Label>Barcode Prefix</Label>
                  <Input 
                    value={settings.barcode || ''} 
                    onChange={(e) => updateSetting('barcode', e.target.value)} 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Bill Type</Label>
                  <Select value={settings.bill_type || 'Tax'} onChange={(e) => updateSetting('bill_type', e.target.value)}>
                    <option value="Tax">Tax</option>
                    <option value="Retail">Retail</option>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Round Off Method</Label>
                  <Select value={settings.round_off || 'Manual'} onChange={(e) => updateSetting('round_off', e.target.value)}>
                    <option value="Auto">Auto</option>
                    <option value="Manual">Manual</option>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Zari Weight Deduction</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={settings.zari_wt || 0} 
                    onChange={(e) => updateSetting('zari_wt', parseFloat(e.target.value))} 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Voucher Prefix</h3>
                
                <div className="grid gap-2">
                  <Label>Purchase Slip Prefix</Label>
                  <Input 
                    value={settings.pur_slip_char || ''} 
                    onChange={(e) => updateSetting('pur_slip_char', e.target.value)} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Sales Slip Prefix</Label>
                  <Input 
                    value={settings.sal_slip_char || ''} 
                    onChange={(e) => updateSetting('sal_slip_char', e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <h3 className="font-semibold text-lg">Default Ledgers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Cash Account</Label>
                    <LedgerSearch 
                      onSelect={(l) => updateSetting('cash_ldg_no', l.ledg_code)}
                      value={settings.cash_ldg_no ? `[Code: ${settings.cash_ldg_no}]` : ''}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Account</Label>
                    <LedgerSearch 
                      onSelect={(l) => updateSetting('bank_ldg_no', l.ledg_code)}
                      value={settings.bank_ldg_no ? `[Code: ${settings.bank_ldg_no}]` : ''}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Purchase Tax Account</Label>
                    <LedgerSearch 
                      onSelect={(l) => updateSetting('pur_tax_ldg_no', l.ledg_code)}
                      value={settings.pur_tax_ldg_no ? `[Code: ${settings.pur_tax_ldg_no}]` : ''}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Sales Tax Account</Label>
                    <LedgerSearch 
                      onSelect={(l) => updateSetting('sale_tax_ldg_no', l.ledg_code)}
                      value={settings.sale_tax_ldg_no ? `[Code: ${settings.sale_tax_ldg_no}]` : ''}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
