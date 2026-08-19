"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/hooks/use-app";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerSearch } from "@/components/search/ledger-search";
import { formatCurrency, generateVoucherNo } from "@/lib/utils";
import { amountInWords } from "@/lib/amount-in-words";
import { useToast } from "@/components/ui/toast";
import { Trash2, Plus, Printer } from "lucide-react";

interface LineItem {
  id: string;
  ledgerId: string;
  ledgerName: string;
  amount: number;
  narration: string;
}

export default function PaymentVoucherPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [narration, setNarration] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ id: Date.now().toString(), ledgerId: "", ledgerName: "", amount: 0, narration: "" }]);
  const [pastVouchers, setPastVouchers] = useState<any[]>([]);

  useEffect(() => {
    if (company) {
      loadInitialData();
    }
  }, [company]);

  const loadInitialData = async () => {
    setVoucherNo(generateVoucherNo("PM"));
    fetchPastVouchers();
  };

  const fetchPastVouchers = async () => {
    if (!company) return;
    const { data, error } = await supabase
      .from("payment_master")
      .select("*")
      .eq("frm_code", company.frm_code)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data && !error) setPastVouchers(data);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), ledgerId: "", ledgerName: "", amount: 0, narration: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSave = async () => {
    if (!company || !accountId || items.some(i => !i.ledgerId || i.amount <= 0)) {
      alert("Please fill all required fields correctly.");
      return;
    }

    setLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from("payment_master")
        .insert({
          frm_code: company.frm_code,
          voucher_no: voucherNo,
          voucher_date: voucherDate,
          account_id: accountId,
          narration: narration,
          total_amount: totalAmount
        })
        .select()
        .single();

      if (masterError) throw masterError;

      const childItems = items.map(item => ({
        frm_code: company.frm_code,
        master_id: masterData.id,
        ledger_id: item.ledgerId,
        amount: item.amount,
        narration: item.narration
      }));

      const { error: childError } = await supabase.from("payment_child").insert(childItems);
      if (childError) throw childError;

      alert("Payment voucher saved successfully!");
      setVoucherNo(generateVoucherNo("PM"));
      setAccountId("");
      setAccountName("");
      setNarration("");
      setItems([{ id: Date.now().toString(), ledgerId: "", ledgerName: "", amount: 0, narration: "" }]);
      fetchPastVouchers();
    } catch (error: any) {
      alert(error.message || "Failed to save payment voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment Voucher</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>New Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Voucher No</Label>
              <Input value={voucherNo} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Cash/Bank Account</Label>
              <LedgerSearch 
                value={accountId}
                onSelect={(l: any) => { setAccountId(l.ledg_code.toString()); setAccountName(l.ledg_name); }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Header Narration</Label>
            <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Being cash paid to..." />
          </div>

          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account/Party</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Narration/Ref</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <LedgerSearch
                        value={item.ledgerId}
                        onSelect={(l: any) => { updateItem(item.id, "ledgerId", l.ledg_code.toString()); updateItem(item.id, "ledgerName", l.ledg_name); }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.amount || ""} 
                        onChange={e => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={item.narration} 
                        onChange={e => updateItem(item.id, "narration", e.target.value)} 
                        placeholder="Bill No etc."
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-2 flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" /> Add Line
              </Button>
              <div className="text-right">
                <div className="font-bold text-lg">Total: {formatCurrency(totalAmount)}</div>
                <div className="text-sm text-muted-foreground capitalize">{amountInWords(totalAmount)}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastVouchers.map(v => (
                <TableRow key={v.id}>
                  <TableCell>{v.voucher_no}</TableCell>
                  <TableCell>{v.voucher_date}</TableCell>
                  <TableCell>{formatCurrency(v.total_amount)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

