'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ProductLookupModal } from '@/components/purchase/product-lookup-modal';
import { StockItemModal, StockDetailRow } from '@/components/purchase/stock-item-modal';
import { INDIAN_STATES } from '@/lib/constants';

interface PurchaseItemRow {
  sno: number;
  prd_code?: number;
  prd_name: string;
  qty: number;
  unit: string;
  rate: number;
  sale_rate?: number;
  amount: number;
  disc_perc: number;
  disc_amt: number;
  expenses: number;
  gst_perc: number;
  txbl_rate: number;
  net_rate: number;
  hsn_code: string;
}

interface ExpenseRow {
  ledg_code?: number;
  exp_name: string;
  amount: number;
}

function PurchaseTransactionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramInvNo = searchParams.get('inv_no') || '';

  const { company } = useApp();
  const supabase = createClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('add');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Master lists
  const [vendors, setVendors] = useState<any[]>([]);
  const [expenseLedgers, setExpenseLedgers] = useState<any[]>([]);

  // 2-Step Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<any | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // Generated Barcodes View Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<any[]>([]);

  // Form Header State
  const [refNo, setRefNo] = useState<number>(1);
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [billType, setBillType] = useState<string>('CREDIT');

  // Vendor & Tax State
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [taxCode, setTaxCode] = useState<string>('LOCAL'); // LOCAL | INTERSTATE | Bill of Supply
  const [taxOnExpenses, setTaxOnExpenses] = useState<boolean>(false);
  const [salesPerson, setSalesPerson] = useState<string>('Direct');
  const [remarks, setRemarks] = useState<string>('');

  // Discount & TDS State
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [splDisc, setSplDisc] = useState<number>(0);
  const [tdsAmt, setTdsAmt] = useState<number>(0);
  const [roundOff, setRoundOff] = useState<number>(0);

  // Items Grid State
  const [items, setItems] = useState<PurchaseItemRow[]>([
    { sno: 1, prd_name: '', qty: 0, unit: 'NOS', rate: 0, amount: 0, disc_perc: 0, disc_amt: 0, expenses: 0, gst_perc: 0, txbl_rate: 0, net_rate: 0, hsn_code: '' }
  ]);

  // Expenses Table State
  const [otherExpenses, setOtherExpenses] = useState<ExpenseRow[]>([
    { exp_name: 'Expenses A/c', amount: 0 },
    { exp_name: 'Freight Charges', amount: 0 }
  ]);

  // Load existing invoice into form
  const loadInvoiceIntoForm = useCallback(async (inv: any) => {
    if (!inv) return;
    setLoading(true);
    try {
      setRefNo(inv.pm_rec_no || inv.pm_ref_no);
      setInvoiceNo(inv.pm_bill_ref_no || '');
      setBillType(inv.pm_bill_type || 'CREDIT');
      setEntryDate(inv.pm_entry_date ? new Date(inv.pm_entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setInvoiceDate(inv.pm_bill_date ? new Date(inv.pm_bill_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setSelectedVendorId(String(inv.pm_cr_code || ''));
      setTaxCode(inv.pm_tax_model || 'LOCAL');
      setTaxOnExpenses(inv.pm_tax_on_exp || false);
      setSalesPerson(inv.pm_sales_person || 'Direct');
      setRemarks(inv.pm_remarks || '');

      setCashDisc(inv.pm_cash_disc || 0);
      setSplDisc(inv.pm_spl_disc || 0);
      setTdsAmt(inv.pm_tds_amt || 0);
      setRoundOff(inv.pm_rnd_off || 0);

      // Fetch children
      const { data: childData } = await supabase.from('pur_child').select('*').eq('pm_ref_no', inv.pm_ref_no).order('pc_sno');
      if (childData && childData.length > 0) {
        setItems(childData.map((c: any) => ({
          sno: c.pc_sno || 1,
          prd_code: c.pc_prcode,
          prd_name: c.pc_prname || '',
          qty: c.pc_qty || 0,
          unit: c.pc_unit || 'NOS',
          rate: c.pc_pur_rate || 0,
          amount: c.pc_amount || 0,
          disc_perc: c.pc_dis_perc || 0,
          disc_amt: c.pc_disc_amt || 0,
          expenses: c.pc_expenses || 0,
          gst_perc: c.pc_gst_perc || 0,
          txbl_rate: c.pc_txbl_rate || 0,
          net_rate: c.pc_net_rate || 0,
          hsn_code: c.pc_hsn_code || ''
        })));
      }

      // Fetch expenses and map cleanly to default categories
      const { data: expData } = await supabase.from('pur_expenses').select('*').eq('pm_ref_no', inv.pm_ref_no);
      const defaultExp = [
        { exp_name: 'Expenses A/c', amount: 0 },
        { exp_name: 'Freight Charges', amount: 0 }
      ];
      if (expData && expData.length > 0) {
        expData.forEach((e: any) => {
          const match = defaultExp.find(d => d.exp_name.toLowerCase() === e.exp_name?.toLowerCase());
          if (match) {
            match.amount = e.exp_amount || 0;
          } else {
            defaultExp.push({ exp_name: e.exp_name, amount: e.exp_amount || 0 });
          }
        });
      } else if (inv.pm_other_charges > 0) {
        defaultExp[1].amount = inv.pm_other_charges;
      }
      setOtherExpenses(defaultExp);
    } catch (e) {
      toast({ title: 'Error loading invoice details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  // Reset form to Add New Mode
  const handleResetForm = () => {
    setMode('add');
    setCurrentIndex(-1);
    setInvoiceNo('');
    setSelectedVendorId('');
    setTaxCode('LOCAL');
    setTaxOnExpenses(false);
    setSalesPerson('Direct');
    setRemarks('');
    setCashDisc(0);
    setSplDisc(0);
    setTdsAmt(0);
    setRoundOff(0);
    setItems([{ sno: 1, prd_name: '', qty: 0, unit: 'NOS', rate: 0, amount: 0, disc_perc: 0, disc_amt: 0, expenses: 0, gst_perc: 0, txbl_rate: 0, net_rate: 0, hsn_code: '' }]);
    setOtherExpenses([{ exp_name: 'Expenses A/c', amount: 0 }, { exp_name: 'Freight Charges', amount: 0 }]);
    setGeneratedBarcodes([]);
    setShowBarcodeModal(false);
    
    if (invoices.length > 0) {
      setRefNo(invoices[0].pm_ref_no + 1);
    }
  };

  // Delete Purchase Invoice and all generated barcodes for this invoice
  const handleDeleteInvoice = async () => {
    if (currentIndex < 0 || !invoices[currentIndex]) {
      toast({ title: 'Please select an existing invoice to delete', variant: 'destructive' });
      return;
    }

    const targetInv = invoices[currentIndex];
    const targetInvNo = targetInv.pm_bill_ref_no || String(targetInv.pm_ref_no);

    if (!confirm(`Are you sure you want to DELETE Purchase Invoice #${targetInvNo}?\nThis will permanently delete the transaction entry and all associated generated barcodes.`)) {
      return;
    }

    try {
      setLoading(true);

      // 1. Delete barcodes from bar_temp
      if (company?.frm_code) {
        await supabase
          .from('bar_temp')
          .delete()
          .eq('frm_code', company.frm_code)
          .eq('inv_no', targetInvNo);
      }

      // 2. Delete pur_mast (cascades to pur_child & pur_expenses)
      const { error } = await supabase.from('pur_mast').delete().eq('pm_ref_no', targetInv.pm_ref_no);
      if (error) throw error;

      toast({ 
        title: `Purchase Invoice #${targetInvNo} Deleted Successfully`, 
        description: 'Transaction entry and barcodes deleted.',
        variant: 'success' 
      });

      fetchData();
      handleResetForm();
    } catch (e: any) {
      toast({ title: 'Error deleting invoice', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Global Keyboard Shortcuts Listener (F3, F4, F8, F10, F11)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setIsProductModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleDeleteInvoice();
      } else if (e.key === 'F11') {
        e.preventDefault();
        router.push(`/inventory/barcode?inv_no=${encodeURIComponent(invoiceNo || String(refNo))}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, invoiceNo, refNo, currentIndex, invoices]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      const [vendorsRes, expensesRes, invoicesRes] = await Promise.all([
        supabase.from('ledger').select('*').eq('frm_code', company.frm_code).order('ledg_name'),
        supabase.from('ledger').select('*').eq('frm_code', company.frm_code).order('ledg_name'),
        supabase.from('pur_mast').select('*, ledger:pm_cr_code(ledg_name, city, cell_no1, gstin, state)').eq('pm_frm_code', company.frm_code).order('pm_ref_no', { ascending: false })
      ]);

      setVendors(vendorsRes.data || []);
      setExpenseLedgers(expensesRes.data || []);
      
      const invList = invoicesRes.data || [];
      setInvoices(invList);

      if (invList.length > 0) {
        setRefNo(invList[0].pm_ref_no + 1);

        // Check if returning with specific invoice number parameter
        if (paramInvNo) {
          const targetIndex = invList.findIndex(i => String(i.pm_bill_ref_no) === String(paramInvNo) || String(i.pm_ref_no) === String(paramInvNo));
          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex);
            setMode('view');
            loadInvoiceIntoForm(invList[targetIndex]);
          }
        }
      }
    } catch (e) {
      toast({ title: 'Error loading purchase data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, loadInvoiceIntoForm, paramInvNo, supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Vendor Details
  const selectedVendor = vendors.find(v => String(v.ledg_code) === String(selectedVendorId));

  // Vendor selection handler with Accurate State Code GST Tax Code logic
  const handleVendorSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    const vendor = vendors.find(v => String(v.ledg_code) === String(vendorId));
    if (vendor) {
      // 1. Company State Code Extraction
      let compStateCode = company?.st_code || '';
      if (!compStateCode && company?.gstin) {
        compStateCode = company.gstin.substring(0, 2);
      }
      if (!compStateCode && company?.state) {
        compStateCode = INDIAN_STATES.find(s => s.name.toLowerCase() === (company.state || '').toLowerCase())?.code || '';
      }

      // 2. Vendor State Code Extraction
      let vendorStateCode = vendor.state_code || vendor.st_code || '';
      if (!vendorStateCode && vendor.gstin) {
        vendorStateCode = vendor.gstin.substring(0, 2);
      }
      if (!vendorStateCode && vendor.state) {
        vendorStateCode = INDIAN_STATES.find(s => s.name.toLowerCase() === (vendor.state || '').toLowerCase())?.code || '';
      }

      // 3. Compare State Codes: if different -> INTERSTATE (IGST), if same -> LOCAL (CGST+SGST)
      if (vendorStateCode && compStateCode && String(vendorStateCode) !== String(compStateCode)) {
        setTaxCode('INTERSTATE');
      } else {
        setTaxCode('LOCAL');
      }
    }
  };

  // Bi-directional Row-wise Discount & Tax calculations
  const updateRow = (index: number, field: keyof PurchaseItemRow, value: any) => {
    const updated = [...items];
    const row = { ...updated[index] };

    if (field === 'prd_name') {
      row.prd_name = String(value);
    } else {
      (row as any)[field] = value;
    }

    const qty = parseFloat(String(row.qty)) || 0;
    const rate = parseFloat(String(row.rate)) || 0;
    const baseAmount = qty * rate;

    // Handle bi-directional Row Discount (disc_perc <-> disc_amt)
    if (field === 'disc_perc') {
      const discPerc = parseFloat(String(value)) || 0;
      row.disc_perc = discPerc;
      row.disc_amt = Number(((baseAmount * discPerc) / 100).toFixed(2));
    } else if (field === 'disc_amt') {
      const discAmt = parseFloat(String(value)) || 0;
      row.disc_amt = discAmt;
      row.disc_perc = baseAmount > 0 ? Number(((discAmt / baseAmount) * 100).toFixed(2)) : 0;
    } else {
      const discPerc = parseFloat(String(row.disc_perc)) || 0;
      row.disc_amt = Number(((baseAmount * discPerc) / 100).toFixed(2));
    }

    const discAmt = row.disc_amt || 0;
    const gstPerc = parseFloat(String(row.gst_perc)) || 0;
    const netBaseAmount = baseAmount - discAmt;
    const txblRate = qty > 0 ? netBaseAmount / qty : 0;

    // Calculate tax per unit
    const taxPerUnit = (txblRate * gstPerc) / 100;
    const netRate = txblRate + taxPerUnit;

    row.amount = Number(baseAmount.toFixed(2));
    row.txbl_rate = Number(txblRate.toFixed(2));
    row.net_rate = Number(netRate.toFixed(2));

    updated[index] = row;
    setItems(updated);
  };

  // Enter Key Focus Movement Helper across Grid Inputs (behaves like Tab)
  const handleGridInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.grid-input')) as HTMLInputElement[];
      const currentIndex = inputs.indexOf(e.currentTarget);
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
        inputs[currentIndex + 1].select();
      }
    }
  };

  // Add new empty row
  const addRow = () => {
    setItems(prev => [
      ...prev,
      { sno: prev.length + 1, prd_name: '', qty: 0, unit: 'NOS', rate: 0, amount: 0, disc_perc: 0, disc_amt: 0, expenses: 0, gst_perc: 0, txbl_rate: 0, net_rate: 0, hsn_code: '' }
    ]);
  };

  // Delete row
  const deleteRow = (index: number) => {
    if (items.length === 1) return;
    const updated = items.filter((_, i) => i !== index).map((r, i) => ({ ...r, sno: i + 1 }));
    setItems(updated);
  };

  // Step 1: Product selected from Product Lookup Modal -> Open Stock Item Details Modal
  const handleSelectProductFromLookup = (product: any) => {
    setSelectedProductForStock(product);
    setIsProductModalOpen(false);
    setIsStockModalOpen(true);
  };

  // Step 2: Proceed from Stock Item Details Modal -> Populate transaction grid
  const handleProceedStockItems = (product: any, stockRows: StockDetailRow[]) => {
    if (stockRows.length === 0 || activeRowIndex === null) return;

    let updated = [...items];
    const startIndex = activeRowIndex;

    stockRows.forEach((sRow, idx) => {
      const targetIndex = startIndex + idx;
      const qty = sRow.qty || 1;
      const pRate = sRow.p_rate || product.rate || 0;
      const saleRate = sRow.sale_rate && sRow.sale_rate > 0 
        ? sRow.sale_rate 
        : product.sales_price && product.sales_price > 0 
          ? product.sales_price 
          : Number((pRate * 1.25).toFixed(2));
      const discPerc = sRow.disc_perc || 0;
      const gstPerc = product.gst_perc || 0;

      const baseAmount = qty * pRate;
      const discAmt = (baseAmount * discPerc) / 100;
      const netBaseAmount = baseAmount - discAmt;
      const txblRate = qty > 0 ? netBaseAmount / qty : 0;
      const taxPerUnit = (txblRate * gstPerc) / 100;
      const netRate = txblRate + taxPerUnit;

      const newRow: PurchaseItemRow = {
        sno: targetIndex + 1,
        prd_code: product.ref_no,
        prd_name: product.prd_name,
        qty: qty,
        unit: product.units || 'NOS',
        rate: pRate,
        sale_rate: saleRate,
        amount: Number(baseAmount.toFixed(2)),
        disc_perc: discPerc,
        disc_amt: Number(discAmt.toFixed(2)),
        expenses: 0,
        gst_perc: gstPerc,
        txbl_rate: Number(txblRate.toFixed(2)),
        net_rate: Number(netRate.toFixed(2)),
        hsn_code: product.hsn_code || ''
      };

      if (targetIndex < updated.length) {
        updated[targetIndex] = newRow;
      } else {
        updated.push(newRow);
      }
    });

    // Re-index serial numbers
    updated = updated.map((r, i) => ({ ...r, sno: i + 1 }));

    // Append an empty row at the end if the last row is filled
    if (updated[updated.length - 1].prd_name) {
      updated.push({
        sno: updated.length + 1, prd_name: '', qty: 0, unit: 'NOS', rate: 0, amount: 0, disc_perc: 0, disc_amt: 0, expenses: 0, gst_perc: 0, txbl_rate: 0, net_rate: 0, hsn_code: ''
      });
    }

    setItems(updated);
  };

  // Summaries & Tax Calculations
  const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalItemDisc = items.reduce((sum, item) => sum + (item.disc_amt || 0), 0);
  const totalDisc = totalItemDisc + (cashDisc || 0) + (splDisc || 0);

  const totalOtherExpenses = otherExpenses.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // Taxable Amount calculation:
  // If Tax On Expenses is checked, total other charges are included in the taxable total before tax calculation
  const baseTaxable = Math.max(0, subTotal - totalDisc);
  const taxableAmt = taxOnExpenses ? baseTaxable + totalOtherExpenses : baseTaxable;

  // Total Taxes Calculation based on Tax Code (LOCAL, INTERSTATE, or Bill of Supply)
  const totalTaxes = items.reduce((sum, item) => {
    if (taxCode === 'Bill of Supply') return sum;

    const itemNetBase = (item.amount || 0) - (item.disc_amt || 0);
    const itemShare = subTotal > 0 ? (item.amount || 0) / subTotal : 0;
    
    // Proportionate header discounts & expenses share
    const itemHeaderDisc = (cashDisc + splDisc) * itemShare;
    const itemExtraExp = taxOnExpenses ? totalOtherExpenses * itemShare : 0;

    const itemTaxable = Math.max(0, itemNetBase - itemHeaderDisc + itemExtraExp);
    const itemTax = (itemTaxable * (item.gst_perc || 0)) / 100;
    return sum + itemTax;
  }, 0);

  // Grand Total Payable Calculation
  const rawTotalValue = taxOnExpenses 
    ? taxableAmt + totalTaxes - tdsAmt 
    : taxableAmt + totalTaxes + totalOtherExpenses - tdsAmt;

  const netTotalValue = Math.round(rawTotalValue + roundOff);
  const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);

  // Save Purchase Invoice with Duplicate Protection & Clean Re-Insertion
  const handleSaveInvoice = async () => {
    if (!company?.frm_code) return;
    if (!selectedVendorId) {
      toast({ title: 'Please select an Account Name (Vendor)', variant: 'destructive' });
      return;
    }
    const validItems = items.filter(i => i.prd_name && i.qty > 0);
    if (validItems.length === 0) {
      toast({ title: 'Please add at least one item with Quantity > 0', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);

      // 1. AVOID DUPLICATE INVOICE ENTRY IN ADD MODE (Same Invoice No + Date + Vendor + Financial Year)
      if (mode === 'add') {
        const { data: dupCheck } = await supabase
          .from('pur_mast')
          .select('pm_ref_no')
          .eq('pm_frm_code', company.frm_code)
          .eq('pm_cr_code', parseInt(selectedVendorId))
          .eq('pm_bill_ref_no', invoiceNo)
          .eq('pm_bill_date', invoiceDate);

        if (dupCheck && dupCheck.length > 0) {
          toast({
            title: 'Duplicate Invoice Entry Blocked!',
            description: `Invoice No #${invoiceNo} dated ${invoiceDate} for this vendor already exists in this financial year.`,
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }
      }

      const mastPayload = {
        pm_rec_no: refNo,
        pm_bill_ref_no: invoiceNo,
        pm_bill_type: billType,
        pm_entry_date: entryDate,
        pm_bill_date: invoiceDate,
        pm_cr_code: parseInt(selectedVendorId),
        pm_tax_model: taxCode,
        pm_reg_code: taxCode === 'LOCAL' ? 50 : taxCode === 'INTERSTATE' ? 51 : 0,
        pm_tax_on_exp: taxOnExpenses,
        pm_sales_person: salesPerson,
        pm_sub_total: subTotal,
        pm_item_disc_amt: totalItemDisc,
        pm_cash_disc: cashDisc,
        pm_spl_disc: splDisc,
        pm_tot_disc: totalDisc,
        pm_taxable_amt: taxableAmt,
        pm_cgst_amt: taxCode === 'LOCAL' ? totalTaxes / 2 : 0,
        pm_sgst_amt: taxCode === 'LOCAL' ? totalTaxes / 2 : 0,
        pm_igst_amt: taxCode === 'INTERSTATE' ? totalTaxes : 0,
        pm_tot_tax: totalTaxes,
        pm_tds_amt: tdsAmt,
        pm_other_charges: totalOtherExpenses,
        pm_tot_qty: totalQty,
        pm_grd_tot: rawTotalValue,
        pm_rnd_off: roundOff,
        pm_net_total: netTotalValue,
        pm_remarks: remarks,
        pm_frm_code: company.frm_code
      };

      // 2. Insert/Update pur_mast cleanly
      let pmRefNo = null;
      if (mode === 'edit' && currentIndex >= 0 && invoices[currentIndex]) {
        pmRefNo = invoices[currentIndex].pm_ref_no;
        const { error } = await supabase.from('pur_mast').update(mastPayload).eq('pm_ref_no', pmRefNo);
        if (error) throw error;

        // Delete old child records, expenses, and barcodes on modification to prevent duplicate insertion
        await supabase.from('pur_child').delete().eq('pm_ref_no', pmRefNo);
        await supabase.from('pur_expenses').delete().eq('pm_ref_no', pmRefNo);
        await supabase.from('bar_temp').delete().eq('frm_code', company.frm_code).eq('inv_no', invoiceNo);
      } else {
        const { data: newMast, error } = await supabase.from('pur_mast').insert([mastPayload]).select('pm_ref_no').single();
        if (error) throw error;
        pmRefNo = newMast.pm_ref_no;
      }

      // 3. Insert pur_child items
      const childPayload = validItems.map((item, idx) => ({
        pm_ref_no: pmRefNo,
        pc_sno: idx + 1,
        pc_prcode: item.prd_code || null,
        pc_prname: item.prd_name,
        pc_qty: item.qty,
        pc_unit: item.unit,
        pc_pur_rate: item.rate,
        pc_amount: item.amount,
        pc_dis_perc: item.disc_perc,
        pc_disc_amt: item.disc_amt,
        pc_expenses: item.expenses,
        pc_gst_perc: item.gst_perc,
        pc_txbl_rate: item.txbl_rate,
        pc_net_rate: item.net_rate,
        pc_hsn_code: item.hsn_code,
        pc_total: item.amount - item.disc_amt,
        pc_net_tot: item.qty * item.net_rate,
        frm_code: company.frm_code
      }));

      const { error: childError } = await supabase.from('pur_child').insert(childPayload);
      if (childError) throw childError;

      // 4. Insert pur_expenses if any
      const validExpenses = otherExpenses.filter(e => e.exp_name && e.amount > 0);
      if (validExpenses.length > 0) {
        const expPayload = validExpenses.map(e => ({
          pm_ref_no: pmRefNo,
          exp_name: e.exp_name,
          exp_amount: e.amount
        }));
        await supabase.from('pur_expenses').insert(expPayload);
      }

      // 5. Auto Barcode Generation based on Barcode Setting Master & Product Barcode Generation Type
      let createdBarcodesCount = 0;
      try {
        const prdCodes = validItems.map(i => i.prd_code).filter(Boolean);
        const [settingRes, prdRes, barRes] = await Promise.all([
          supabase.from('barcode_setting').select('*').or(`frm_code.eq.${company.frm_code},frm_code.is.null`).order('ref_no', { ascending: true }),
          prdCodes.length > 0 
            ? supabase.from('product').select('ref_no, prd_code, barcode_gen_type, sales_price, rate, product_group(grp_name)').in('ref_no', prdCodes)
            : { data: [] },
          supabase.from('bar_temp').select('bar_no').eq('frm_code', company.frm_code).order('bar_ref_id', { ascending: false })
        ]);

        const settingsList = settingRes.data || [];
        const barRule = settingsList.length > 0 ? settingsList[0] : { prefix: 'KS', seed: 2304, seed_len: 5, suffix: '' };
        const prdMap = new Map((prdRes.data || []).map((p: any) => [p.ref_no, p]));

        // Safe Seed Recovery: find highest numerical seed in DB to guarantee uniqueness
        let maxSeedInDb = (barRule.seed || 2304) - 1;
        if (barRes.data && barRes.data.length > 0) {
          barRes.data.forEach((b: any) => {
            const match = (b.bar_no || '').match(/\d+/);
            if (match) {
              const num = parseInt(match[0]);
              if (num > maxSeedInDb) maxSeedInDb = num;
            }
          });
        }

        let currentSeed = Math.max(barRule.seed || 2304, maxSeedInDb + 1);
        const prefix = barRule.prefix || 'KS';
        const suffix = barRule.suffix || '';
        const seedLen = barRule.seed_len || 5;

        const barEntries: any[] = [];

        validItems.forEach((item, idx) => {
          const prdInfo = prdMap.get(item.prd_code);
          const genType = prdInfo?.barcode_gen_type || 'Auto Tracking Unique No';
          const saleRate = item.sale_rate && item.sale_rate > 0 
            ? item.sale_rate 
            : prdInfo?.sales_price && prdInfo.sales_price > 0 
              ? prdInfo.sales_price 
              : Number(((item.rate || 0) * 1.25).toFixed(2));

          const costRate = item.txbl_rate || item.rate;
          const markup = costRate > 0 && saleRate > costRate ? Number((((saleRate - costRate) / costRate) * 100).toFixed(1)) : 0;
          const margin = saleRate > 0 ? Number((((saleRate - costRate) / saleRate) * 100).toFixed(2)) : 0;

          if (genType === 'Auto Tracking Unique No') {
            const unitQty = Math.max(1, Math.floor(item.qty));
            for (let u = 0; u < unitQty; u++) {
              const barNo = `${prefix}${String(currentSeed).padStart(seedLen, '0')}${suffix}`;
              barEntries.push({
                bar_no: barNo,
                prcode: item.prd_code || null,
                grp_code: null,
                pc_pur_rate: item.rate,
                pc_sale_rate: saleRate,
                qty: 1,
                cr_code: parseInt(selectedVendorId),
                sold_status: 'A',
                frm_code: company.frm_code,
                inv_no: invoiceNo || String(refNo),
                inv_date: invoiceDate,
                entry_sno: idx + 1,
                cost_rate: costRate,
                markup: markup,
                margin: margin,
                print_count: 1,
                grp_name: prdInfo?.product_group?.grp_name || 'PURE SILK',
                unit_name: item.unit
              });
              currentSeed++;
            }
          } else if (genType === 'Auto Tracking Batch No' || !genType) {
            const barNo = `${prefix}${String(currentSeed).padStart(seedLen, '0')}${suffix}`;
            barEntries.push({
              bar_no: barNo,
              prcode: item.prd_code || null,
              grp_code: null,
              pc_pur_rate: item.rate,
              pc_sale_rate: saleRate,
              qty: item.qty,
              cr_code: parseInt(selectedVendorId),
              sold_status: 'A',
              frm_code: company.frm_code,
              inv_no: invoiceNo || String(refNo),
              inv_date: invoiceDate,
              entry_sno: idx + 1,
              cost_rate: costRate,
              markup: markup,
              margin: margin,
              print_count: 1,
              grp_name: prdInfo?.product_group?.grp_name || 'PURE SILK',
              unit_name: item.unit
            });
            currentSeed++;
          }
        });

        if (barEntries.length > 0) {
          const { data: insertedBars } = await supabase.from('bar_temp').insert(barEntries).select('*');
          try {
            if (barRule.ref_no) {
              await supabase.from('barcode_setting').update({ seed: currentSeed }).eq('ref_no', barRule.ref_no);
            }
          } catch (e) {
            console.log("barcode_setting update skipped");
          }
          if (insertedBars && insertedBars.length > 0) {
            createdBarcodesCount = insertedBars.length;
            setGeneratedBarcodes(insertedBars);
            setShowBarcodeModal(true);
          }
        }
      } catch (barErr) {
        console.error('Error generating barcodes:', barErr);
      }

      toast({ 
        title: 'Purchase Invoice Saved Successfully!', 
        description: createdBarcodesCount > 0 ? `${createdBarcodesCount} Barcodes Generated.` : '',
        variant: 'success' 
      });

      fetchData();
    } catch (e: any) {
      toast({ title: 'Error saving purchase invoice', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    if (invoices.length === 0) return;
    let nextIdx = currentIndex === -1 ? 0 : currentIndex + 1;
    if (nextIdx >= invoices.length) nextIdx = invoices.length - 1;
    setCurrentIndex(nextIdx);
    setMode('view');
    loadInvoiceIntoForm(invoices[nextIdx]);
  };

  const handleNext = () => {
    if (invoices.length === 0) return;
    let nextIdx = currentIndex <= 0 ? 0 : currentIndex - 1;
    setCurrentIndex(nextIdx);
    setMode('view');
    loadInvoiceIntoForm(invoices[nextIdx]);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-3 space-y-3 font-sans text-xs">
      {/* Top Banner Header */}
      <div className="bg-amber-500 text-white font-bold px-4 py-2 flex justify-between items-center rounded shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-white text-amber-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">➜</div>
          <span className="text-xl">Purchase</span>
          <span className="bg-amber-600/60 px-2 py-0.5 text-xs rounded font-normal capitalize">
            {mode === 'view' ? 'View Mode' : mode === 'edit' ? 'Edit Mode' : 'Add New Mode'}
          </span>
        </div>
        <div className="text-sm cursor-pointer hover:bg-amber-600 px-2 py-0.5 rounded font-bold" onClick={() => router.push('/dashboard')}>✕</div>
      </div>

      {/* Main Top Header Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Top Left Card (Invoice Details) */}
        <div className="md:col-span-3 bg-amber-500/10 border border-amber-300 dark:border-amber-700/50 rounded p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="bg-amber-600 text-white px-2 py-0.5 font-bold rounded">Reference No</span>
            <span className="font-bold text-sm">{refNo}</span>
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="bg-amber-600 text-white px-2 py-0.5 font-bold rounded">Invoice No</span>
            <input 
              type="text"
              value={invoiceNo} 
              onChange={e => setInvoiceNo(e.target.value)} 
              onKeyDown={handleGridInputKeyDown}
              className="grid-input h-6 text-xs bg-background border border-input rounded px-2 max-w-[120px] font-mono text-right font-bold focus:outline-none"
              placeholder="Inv No"
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Date (Entry)</span>
            <span className="font-mono">{entryDate}</span>
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">Invoice Date</span>
            <input 
              type="date"
              value={invoiceDate} 
              onChange={e => setInvoiceDate(e.target.value)} 
              onKeyDown={handleGridInputKeyDown}
              className="grid-input h-6 text-xs bg-background border border-input rounded px-2 max-w-[130px] font-mono focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">Bill Type</span>
            <select 
              className="grid-input flex h-6 rounded border border-input bg-background px-2 text-xs font-bold focus:outline-none"
              value={billType}
              onChange={e => setBillType(e.target.value)}
            >
              <option value="CREDIT">CREDIT</option>
              <option value="CASH">CASH</option>
            </select>
          </div>

          <div className="flex items-center justify-between bg-amber-600 text-white px-2 py-1 rounded font-bold mt-2">
            <span>Invoice Amount</span>
            <span className="text-sm font-mono">₹{netTotalValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Top Center Card (Vendor & Tax Details) */}
        <div className="md:col-span-9 bg-card border rounded p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <div className="md:col-span-8 space-y-1">
              <div className="flex items-center gap-2">
                <Label className="w-24 text-xs font-bold">Account Name</Label>
                <select 
                  className="grid-input flex-1 h-7 rounded border border-input bg-background px-2 text-xs font-bold focus:outline-none"
                  value={selectedVendorId}
                  onChange={e => handleVendorSelect(e.target.value)}
                >
                  <option value="">Select Account / Vendor Ledger</option>
                  {vendors.map(v => (
                    <option key={v.ledg_code} value={v.ledg_code}>{v.ledg_name}</option>
                  ))}
                </select>
                {selectedVendor && (
                  <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-1 rounded text-xs">
                    ₹{(selectedVendor.op_bal || 0).toLocaleString()} {selectedVendor.op_bal_type || 'Cr'}
                  </span>
                )}
              </div>

              {selectedVendor && (
                <div className="pl-26 text-[11px] text-muted-foreground font-mono">
                  {selectedVendor.city && <span>{selectedVendor.city}, </span>}
                  {selectedVendor.ph_no && <span>PH:{selectedVendor.ph_no} </span>}
                  {selectedVendor.cell_no1 && <span>{selectedVendor.cell_no1} </span>}
                  {selectedVendor.gstin && <span className="font-bold text-foreground">GST:{selectedVendor.gstin}</span>}
                </div>
              )}
            </div>

            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="w-24 text-xs font-bold">Tax Code [F6]</Label>
                <select 
                  className="grid-input flex-1 h-7 rounded border border-input bg-background px-2 text-xs font-bold focus:outline-none"
                  value={taxCode}
                  onChange={e => setTaxCode(e.target.value)}
                >
                  <option value="LOCAL">LOCAL (IntraState CGST+SGST)</option>
                  <option value="INTERSTATE">INTERSTATE (IGST)</option>
                  <option value="Bill of Supply">Bill of Supply (No Tax)</option>
                </select>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-700 dark:text-amber-400">
                  <input 
                    type="checkbox"
                    checked={taxOnExpenses}
                    onChange={e => setTaxOnExpenses(e.target.checked)}
                    className="rounded border-amber-500"
                  />
                  Tax On Expenses
                </label>

                <div className="flex items-center gap-1.5 flex-1">
                  <Label className="text-xs">Sales Person</Label>
                  <select 
                    className="flex-1 h-6 rounded border border-input bg-background px-2 text-xs"
                    value={salesPerson}
                    onChange={e => setSalesPerson(e.target.value)}
                  >
                    <option value="Direct">Direct</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid & Summary Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        {/* Left Column: Items Grid Table */}
        <div className="md:col-span-9 bg-card border rounded overflow-hidden flex flex-col">
          <div className="overflow-x-auto min-h-[320px] max-h-[450px]">
            <Table className="w-full border-collapse text-xs">
              <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold sticky top-0">
                <TableRow>
                  <TableHead className="w-8 text-center p-1">Del</TableHead>
                  <TableHead className="w-10 text-center p-1">SNo</TableHead>
                  <TableHead className="p-1 min-w-[180px]">Product Name</TableHead>
                  <TableHead className="w-20 min-w-[75px] text-right p-1">Qty</TableHead>
                  <TableHead className="w-16 min-w-[65px] p-1">Unit/Per</TableHead>
                  <TableHead className="w-24 min-w-[90px] text-right p-1">Rate/Unit</TableHead>
                  <TableHead className="w-24 text-right p-1">Amount</TableHead>
                  <TableHead className="w-16 text-right p-1">Disc%</TableHead>
                  <TableHead className="w-20 text-right p-1">DiscAmt</TableHead>
                  <TableHead className="w-20 text-right p-1">Expenses</TableHead>
                  <TableHead className="w-16 min-w-[65px] text-center p-1">{taxCode === 'INTERSTATE' ? 'IGST %' : 'GST %'}</TableHead>
                  <TableHead className="w-28 min-w-[100px] text-right p-1">Txbl.Rate</TableHead>
                  <TableHead className="w-28 min-w-[100px] text-right p-1">Net Rate</TableHead>
                  <TableHead className="w-24 min-w-[90px] p-1">HSN_Code</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/40">
                    <TableCell className="text-center p-1">
                      <button 
                        onClick={() => deleteRow(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm"
                        title="Delete Row"
                      >
                        ✕
                      </button>
                    </TableCell>
                    <TableCell className="text-center font-mono p-1">{row.sno}</TableCell>
                    <TableCell className="p-1">
                      <div className="flex gap-1 items-center">
                        <input
                          type="text"
                          value={row.prd_name}
                          onChange={e => updateRow(idx, 'prd_name', e.target.value)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                          }}
                          onKeyDown={handleGridInputKeyDown}
                          placeholder="Select Product (F3)..."
                          className="grid-input h-7 w-full text-xs bg-background border border-input rounded px-2 font-medium focus:outline-none"
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          className="h-7 px-1.5 text-[10px] bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                          onClick={() => {
                            setActiveRowIndex(idx);
                            setIsProductModalOpen(true);
                          }}
                        >
                          F3
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 min-w-[75px]">
                      <input
                        type="text"
                        value={row.qty || ''}
                        onChange={e => updateRow(idx, 'qty', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-right font-mono font-bold bg-background border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="p-1 min-w-[65px]">
                      <input
                        type="text"
                        value={row.unit || 'NOS'}
                        onChange={e => updateRow(idx, 'unit', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs bg-background border border-input rounded px-1.5 focus:outline-none"
                      />
                    </TableCell>
                    <TableCell className="p-1 min-w-[90px]">
                      <input
                        type="text"
                        value={row.rate || ''}
                        onChange={e => updateRow(idx, 'rate', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-right font-mono bg-background border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold p-1">
                      ₹{(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="p-1">
                      <input
                        type="text"
                        value={row.disc_perc || ''}
                        onChange={e => updateRow(idx, 'disc_perc', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-right font-mono border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <input
                        type="text"
                        value={row.disc_amt || ''}
                        onChange={e => updateRow(idx, 'disc_amt', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-right font-mono border border-input rounded px-1.5 font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <input
                        type="text"
                        value={row.expenses || ''}
                        onChange={e => updateRow(idx, 'expenses', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-right font-mono border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="p-1 min-w-[65px]">
                      <input
                        type="text"
                        value={row.gst_perc || ''}
                        onChange={e => updateRow(idx, 'gst_perc', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs text-center font-mono font-bold border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium p-1 min-w-[100px] px-2">
                      ₹{(row.txbl_rate || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 p-1 min-w-[100px] px-2">
                      ₹{(row.net_rate || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="p-1 min-w-[90px]">
                      <input
                        type="text"
                        value={row.hsn_code || ''}
                        onChange={e => updateRow(idx, 'hsn_code', e.target.value)}
                        onKeyDown={handleGridInputKeyDown}
                        className="grid-input h-7 w-full text-xs font-mono bg-background border border-input rounded px-1.5 focus:outline-none"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Grid Summary Footer Bar */}
          <div className="bg-slate-200 dark:bg-slate-800 p-2 border-t flex flex-wrap items-center justify-between font-bold text-xs">
            <div className="flex gap-4 items-center">
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={addRow}>+ Add Row</Button>
              <span>Items: {items.filter(i => i.prd_name).length}</span>
            </div>
            <div className="flex gap-6 items-center font-mono">
              <span>Total Qty: {totalQty.toFixed(2)}</span>
              <span>Total Amount: ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>Total Disc: ₹{totalItemDisc.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Calculations & Extra Expenses */}
        <div className="md:col-span-3 bg-card border rounded p-3 space-y-2 text-xs">
          <div className="space-y-1.5 border-b pb-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Sub Total</span>
              <span className="font-mono font-bold">₹{subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Disc. Amount</span>
              <span className="font-mono">₹{totalItemDisc.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cash Disc.</span>
              <input
                type="text"
                value={cashDisc || ''}
                onChange={e => setCashDisc(parseFloat(e.target.value) || 0)}
                className="h-6 w-24 text-xs text-right font-mono border border-input rounded px-1.5 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Special Disc.</span>
              <input
                type="text"
                value={splDisc || ''}
                onChange={e => setSplDisc(parseFloat(e.target.value) || 0)}
                className="h-6 w-24 text-xs text-right font-mono border border-input rounded px-1.5 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex justify-between items-center border-t pt-1 font-bold">
              <span>Total Disc.</span>
              <span className="font-mono text-red-600">₹{totalDisc.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span>Taxable Amt {taxOnExpenses && <span className="text-[10px] text-amber-600">(Inc. Exp)</span>}</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">₹{taxableAmt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span>Total Taxes</span>
              <span className="font-mono text-emerald-600">₹{totalTaxes.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>TDS (194Q)</span>
              <input
                type="text"
                value={tdsAmt || ''}
                onChange={e => setTdsAmt(parseFloat(e.target.value) || 0)}
                className="h-6 w-24 text-xs text-right font-mono border border-input rounded px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Other Charges / Expenses Sub-table */}
          <div className="space-y-1 border-b pb-2">
            <div className="flex justify-between items-center font-semibold text-muted-foreground">
              <span>Other Charges</span>
              <span>Amount</span>
            </div>
            {otherExpenses.map((exp, eIdx) => (
              <div key={eIdx} className="flex justify-between items-center gap-2">
                <span className="text-xs truncate font-medium">{exp.exp_name}</span>
                <input
                  type="text"
                  value={exp.amount || ''}
                  onChange={e => {
                    const copy = [...otherExpenses];
                    copy[eIdx].amount = parseFloat(e.target.value) || 0;
                    setOtherExpenses(copy);
                  }}
                  className="h-6 w-24 text-xs text-right font-mono border border-input rounded px-1.5 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center font-medium text-xs">
              <span>Total Value</span>
              <span className="font-mono font-bold">₹{rawTotalValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span>Round Off</span>
              <input
                type="text"
                value={roundOff || ''}
                onChange={e => setRoundOff(parseFloat(e.target.value) || 0)}
                className="h-6 w-20 text-xs text-right font-mono border border-input rounded px-1.5 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Final Highlight Total Box */}
            <div className="bg-amber-500 text-white rounded p-3 mt-2 text-center shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-90">Total Payable Amount</div>
              <div className="text-2xl font-black font-mono">₹{netTotalValue.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Remarks & Action Toolbar Bar */}
      <div className="bg-card border rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <Label className="text-xs font-bold">Remarks</Label>
          <Input
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Enter bill remarks or reference comments..."
            className="h-8 text-xs bg-background flex-1"
          />
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs" 
            onClick={handlePrev}
            disabled={invoices.length === 0}
          >
            Previous [Pg Up]
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs" 
            onClick={handleNext}
            disabled={invoices.length === 0}
          >
            Next [Pg Down]
          </Button>

          <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={handleResetForm}>
            New [F4]
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => setMode('edit')}>
            Edit [F9]
          </Button>
          <Button 
            size="sm" 
            variant="destructive" 
            className="h-8 text-xs font-bold"
            onClick={handleDeleteInvoice}
            disabled={mode === 'add' || invoices.length === 0}
          >
            Delete [F8]
          </Button>
          <Button 
            size="sm" 
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
            onClick={handleSaveInvoice}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save [F10]'}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-bold" 
            onClick={() => router.push(`/inventory/barcode?inv_no=${encodeURIComponent(invoiceNo || String(refNo))}`)}
          >
            Print Barcodes [F11]
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs text-red-600" onClick={handleResetForm}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Step 1: Product Search Lookup Modal */}
      <ProductLookupModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelectProduct={handleSelectProductFromLookup}
      />

      {/* Step 2: Stock Item Details Entry Modal */}
      <StockItemModal
        isOpen={isStockModalOpen}
        product={selectedProductForStock}
        onClose={() => setIsStockModalOpen(false)}
        onProceed={handleProceedStockItems}
      />

      {/* Generated Barcodes Modal Dialog */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-4xl rounded-lg shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-emerald-600 text-white font-bold px-4 py-2 flex justify-between items-center text-sm">
              <span>Barcodes Generated for Invoice #{invoiceNo || refNo}</span>
              <button onClick={() => setShowBarcodeModal(false)} className="hover:bg-emerald-700 px-2 py-0.5 rounded font-bold">✕</button>
            </div>
            
            <div className="p-4 space-y-3 flex-1 overflow-auto">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Total Barcode Stickers Generated: {generatedBarcodes.length}
                </span>
                <Button 
                  size="sm" 
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  onClick={() => {
                    setShowBarcodeModal(false);
                    router.push(`/inventory/barcode?inv_no=${encodeURIComponent(invoiceNo || String(refNo))}`);
                  }}
                >
                  Open Barcode Printing Screen →
                </Button>
              </div>

              <Table className="border rounded">
                <TableHeader className="bg-muted text-xs">
                  <TableRow>
                    <TableHead>SNo</TableHead>
                    <TableHead>Barcode No (Batch)</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Purchase Rate</TableHead>
                    <TableHead className="text-right">Sales Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {generatedBarcodes.map((b, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{idx + 1}</TableCell>
                      <TableCell className="font-mono font-bold text-amber-600 dark:text-amber-400">{b.bar_no}</TableCell>
                      <TableCell className="font-medium">{b.product?.prd_name || 'Stock Item'}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-emerald-600">{b.qty}</TableCell>
                      <TableCell className="text-right font-mono">₹{(b.pc_pur_rate || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700">₹{(b.pc_sale_rate || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/40 p-2 border-t flex justify-end gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={() => setShowBarcodeModal(false)}>
                Close
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold" 
                onClick={() => {
                  setShowBarcodeModal(false);
                  router.push(`/inventory/barcode?inv_no=${encodeURIComponent(invoiceNo || String(refNo))}`);
                }}
              >
                Go to Barcode Printing Screen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseTransactionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs">Loading Purchase Entry...</div>}>
      <PurchaseTransactionContent />
    </Suspense>
  );
}
