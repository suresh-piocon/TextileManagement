'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface ProductLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: any) => void;
}

export function ProductLookupModal({ isOpen, onClose, onSelectProduct }: ProductLookupModalProps) {
  const { company } = useApp();
  const supabase = createClient();

  const [prodNameSearch, setProdNameSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [searchWildcard, setSearchWildcard] = useState(true);
  const [searchByAlias, setSearchByAlias] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!company?.frm_code) return;
    const { data } = await supabase
      .from('product_group')
      .select('*')
      .eq('frm_code', company.frm_code)
      .order('grp_name');
    setGroups(data || []);
  }, [company?.frm_code, supabase]);

  const searchProducts = useCallback(async () => {
    if (!company?.frm_code) return;
    setLoading(true);
    try {
      let query = supabase
        .from('product')
        .select('*, product_group(grp_name)')
        .eq('frm_code', company.frm_code);

      if (prodNameSearch.trim()) {
        if (searchWildcard) {
          query = query.ilike('prd_name', `%${prodNameSearch.trim()}%`);
        } else {
          query = query.ilike('prd_name', `${prodNameSearch.trim()}%`);
        }
      }

      if (selectedGroup) {
        query = query.eq('grp_code', selectedGroup);
      }

      query = query.limit(50);
      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
      setSelectedIndex(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [company?.frm_code, prodNameSearch, selectedGroup, searchWildcard, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      searchProducts();
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, fetchGroups, searchProducts]);

  // Up/Down Arrow & Enter Key Navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < products.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (products.length > 0 && products[selectedIndex]) {
          onSelectProduct(products[selectedIndex]);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products, selectedIndex, onSelectProduct, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-4xl rounded-lg shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Title Bar */}
        <div className="bg-amber-500 text-white font-bold px-4 py-2 flex justify-between items-center text-sm">
          <span>Add New Mode - Product Selection</span>
          <button onClick={onClose} className="hover:bg-amber-600 px-2 py-0.5 rounded font-bold">✕</button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-muted/30 border-b space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="col-span-2">
              <Label className="text-xs font-bold">Prod. Name [F3]</Label>
              <Input
                ref={searchInputRef}
                value={prodNameSearch}
                onChange={e => setProdNameSearch(e.target.value)}
                placeholder="Search Product Name (e.g. saree)..."
                className="h-8 text-xs bg-background font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Group Name [F3]</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map(g => (
                  <option key={g.ref_no} value={g.ref_no}>{g.grp_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold">Brand</Label>
              <Input
                value={brandSearch}
                onChange={e => setBrandSearch(e.target.value)}
                placeholder="Brand..."
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4 font-medium">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchWildcard}
                  onChange={e => setSearchWildcard(e.target.checked)}
                />
                Search Wild Card [F7]
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchByAlias}
                  onChange={e => setSearchByAlias(e.target.checked)}
                />
                Search By Alias [F8]
              </label>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 font-bold" onClick={() => {
                if (products[selectedIndex]) {
                  onSelectProduct(products[selectedIndex]);
                  onClose();
                }
              }}>
                Select [F5]
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className="flex-1 overflow-auto p-2 min-h-[300px]">
          <Table>
            <TableHeader className="bg-slate-200 dark:bg-slate-800 text-xs font-bold">
              <TableRow>
                <TableHead className="py-2 text-xs font-bold">Product Name</TableHead>
                <TableHead className="py-2 text-xs font-bold">Product Code</TableHead>
                <TableHead className="py-2 text-xs font-bold">Unit</TableHead>
                <TableHead className="py-2 text-xs text-center font-bold">GST%</TableHead>
                <TableHead className="py-2 text-xs font-bold">HSN Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading products...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No matching products found</TableCell></TableRow>
              ) : (
                products.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <TableRow
                      key={p.ref_no}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => {
                        onSelectProduct(p);
                        onClose();
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-amber-500 text-white font-bold hover:bg-amber-600' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <TableCell className="py-1.5 font-medium">{p.prd_name}</TableCell>
                      <TableCell className="py-1.5 font-mono">{p.prd_code || '-'}</TableCell>
                      <TableCell className="py-1.5">{p.units || 'NOS'}</TableCell>
                      <TableCell className="py-1.5 text-center font-bold">{p.gst_perc || 0}%</TableCell>
                      <TableCell className="py-1.5 font-mono">{p.hsn_code || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="bg-muted/30 px-4 py-2 border-t text-[11px] text-muted-foreground flex justify-between items-center">
          <span>Use <b>↑ / ↓ Arrow Keys</b> to highlight item, press <b>Enter</b> or <b>Select [F5]</b> to choose.</span>
          <span>Total Products: {products.length}</span>
        </div>
      </div>
    </div>
  );
}
