"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/hooks/use-app";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerSearch } from "@/components/search/ledger-search";
import { formatCurrency, generateVoucherNo } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function ContraVoucherPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");
  
  const [fromAccount, setFromAccount] = useState("");
  const [fromBalance, setFromBalance] = useState(0);
  
  const [toAccount, setToAccount] = useState("");
  const [toBalance, setToBalance] = useState(0);

  const [amount, setAmount] = useState<number | "">("");
  const [transferMode, setTransferMode] = useState("Bank Transfer");

  useEffect(() => {
    if (company) {
      setVoucherNo(generateVoucherNo("CV"));
    }
  }, [company]);

  const fetchBalance = async (accountId: string, setBalance: (val: number) => void) => {
    if (!company || !accountId) return;
    const { data } = await supabase
      .from("ledger")
      .select("closing_balance")
      .eq("frm_code", company.frm_code)
      .eq("id", accountId)
      .single();
    if (data) setBalance(data.closing_balance || 0);
  };

  useEffect(() => {
    if (fromAccount) fetchBalance(fromAccount, setFromBalance);
  }, [fromAccount]);

  useEffect(() => {
    if (toAccount) fetchBalance(toAccount, setToBalance);
  }, [toAccount]);

  const handleSave = async () => {
    if (!company || !fromAccount || !toAccount || !amount || amount <= 0) {
      alert("Please fill all required fields correctly.");
      return;
    }
    if (fromAccount === toAccount) {
      alert("Transfer From and To accounts cannot be the same.");
      return;
    }

    setLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from("contra_master")
        .insert({
          frm_code: company.frm_code,
          voucher_no: voucherNo,
          voucher_date: voucherDate,
          narration: narration,
          transfer_mode: transferMode,
          amount: amount
        })
        .select()
        .single();

      if (masterError) throw masterError;

      const childItems = [
        {
          frm_code: company.frm_code,
          master_id: masterData.id,
          ledger_id: fromAccount,
          amount: amount,
          type: "cr"
        },
        {
          frm_code: company.frm_code,
          master_id: masterData.id,
          ledger_id: toAccount,
          amount: amount,
          type: "dr"
        }
      ];

      const { error: childError } = await supabase.from("contra_child").insert(childItems);
      if (childError) throw childError;

      alert("Contra voucher saved successfully!");
      setVoucherNo(generateVoucherNo("CV"));
      setFromAccount("");
      setToAccount("");
      setAmount("");
      setNarration("");
      setFromBalance(0);
      setToBalance(0);
    } catch (error: any) {
      alert(error.message || "Failed to save contra voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contra Voucher</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Fund Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Voucher No</Label>
              <Input value={voucherNo} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Transfer Mode</Label>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={transferMode} 
                onChange={e => setTransferMode(e.target.value)}
              >
                <option value="Cash Deposit">Cash Deposit</option>
                <option value="Cash Withdrawal">Cash Withdrawal</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
              <h3 className="font-semibold text-lg">Transfer From (Credit)</h3>
              <div className="space-y-2">
                <Label>Account</Label>
                <LedgerSearch value={fromAccount} onSelect={(val) => setFromAccount(val)} />
              </div>
              <div className="text-sm">
                Current Balance: <span className="font-semibold">{formatCurrency(fromBalance)}</span>
              </div>
            </div>
            
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
              <h3 className="font-semibold text-lg">Transfer To (Debit)</h3>
              <div className="space-y-2">
                <Label>Account</Label>
                <LedgerSearch value={toAccount} onSelect={(val) => setToAccount(val)} />
              </div>
              <div className="text-sm">
                Current Balance: <span className="font-semibold">{formatCurrency(toBalance)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(parseFloat(e.target.value) || "")} 
                placeholder="Enter amount..."
              />
            </div>
            <div className="space-y-2">
              <Label>Narration</Label>
              <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Transfer details..." />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={loading || !amount || amount <= 0 || !fromAccount || !toAccount}>
              {loading ? "Saving..." : "Save Contra Transfer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

