"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/hooks/use-app";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LedgerSearch } from "@/components/search/ledger-search";
import { formatCurrency, generateVoucherNo } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Trash2, Plus } from "lucide-react";

interface LineItem {
  id: string;
  ledgerId: string;
  ledgerName: string;
  debit: number;
  credit: number;
  narration: string;
}

export default function JournalVoucherPage() {
  const { company } = useApp();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: Date.now().toString(), ledgerId: "", ledgerName: "", debit: 0, credit: 0, narration: "" },
    { id: (Date.now() + 1).toString(), ledgerId: "", ledgerName: "", debit: 0, credit: 0, narration: "" }
  ]);

  useEffect(() => {
    if (company) {
      setVoucherNo(generateVoucherNo("JV"));
    }
  }, [company]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), ledgerId: "", ledgerName: "", debit: 0, credit: 0, narration: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 2) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        if (field === "debit" && value > 0) newItem.credit = 0;
        if (field === "credit" && value > 0) newItem.debit = 0;
        return newItem;
      }
      return item;
    }));
  };

  const totalDebit = items.reduce((sum, item) => sum + (item.debit || 0), 0);
  const totalCredit = items.reduce((sum, item) => sum + (item.credit || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const handleSave = async () => {
    if (!company || items.some(i => !i.ledgerId) || !isBalanced) {
      alert("Ensure all fields are filled and total debit equals total credit.");
      return;
    }

    setLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from("journal_master")
        .insert({
          frm_code: company.frm_code,
          voucher_no: voucherNo,
          voucher_date: voucherDate,
          narration: narration,
          total_amount: totalDebit
        })
        .select()
        .single();

      if (masterError) throw masterError;

      const childItems = items.map(item => ({
        frm_code: company.frm_code,
        master_id: masterData.id,
        ledger_id: item.ledgerId,
        debit_amount: item.debit,
        credit_amount: item.credit,
        narration: item.narration
      }));

      const { error: childError } = await supabase.from("journal_child").insert(childItems);
      if (childError) throw childError;

      alert("Journal voucher saved successfully!");
      setVoucherNo(generateVoucherNo("JV"));
      setNarration("");
      setItems([
        { id: Date.now().toString(), ledgerId: "", ledgerName: "", debit: 0, credit: 0, narration: "" },
        { id: (Date.now() + 1).toString(), ledgerId: "", ledgerName: "", debit: 0, credit: 0, narration: "" }
      ]);
    } catch (error: any) {
      alert(error.message || "Failed to save journal voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Journal Voucher</h1>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>New Journal</CardTitle>
            <Badge variant={isBalanced ? "default" : "destructive"}>
              {isBalanced ? "Balanced" : "Imbalanced"}
            </Badge>
          </div>
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
              <Label>General Narration</Label>
              <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Being..." />
            </div>
          </div>

          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Account/Ledger</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Line Narration</TableHead>
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
                        value={item.debit || ""} 
                        onChange={e => updateItem(item.id, "debit", parseFloat(e.target.value) || 0)} 
                        disabled={item.credit > 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.credit || ""} 
                        onChange={e => updateItem(item.id, "credit", parseFloat(e.target.value) || 0)} 
                        disabled={item.debit > 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={item.narration} 
                        onChange={e => updateItem(item.id, "narration", e.target.value)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} disabled={items.length <= 2}>
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
              <div className="text-right flex gap-4">
                <div className="font-bold">Total Debit: {formatCurrency(totalDebit)}</div>
                <div className="font-bold">Total Credit: {formatCurrency(totalCredit)}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={loading || !isBalanced}>
              {loading ? "Saving..." : "Save Journal"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

