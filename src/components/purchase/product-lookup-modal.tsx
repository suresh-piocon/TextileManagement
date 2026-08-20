'use client';

import { useState, useEffect, useCallback } from 'react';
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
    }
  }, [isOpen, fetchGroups, searchProducts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-4xl rounded-lg shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Title Bar */}
        <div className="bg-amber-500 text-white font-bold px-4 py-2 flex justify-between items-center text-sm">
          <span>Add New Mode - Product Selection</span>
          <button onClick={onClose} className="hover:bg-amber-600 px-2 py-0.5 rounded">✕</button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-muted/30 border-b space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="col-span-2">
              <Label className="text-xs">Prod. Name [F3]</Label>
              <Input
                value={prodNameSearch}
                onChange={e => setProdNameSearch(e.target.value)}
                placeholder="Search Product Name (e.g. saree)..."
                className="h-8 text-xs bg-background"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Group Name [F3]</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
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
              <Label className="text-xs">Brand</Label>
              <Input
                value={brandSearch}
                onChange={e => setBrandSearch(e.target.value)}
                placeholder="Brand..."
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4">
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
              <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={() => {
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
            <TableHeader className="bg-muted text-xs">
              <TableRow>
                <TableHead className="py-2 text-xs">Product Name</TableHead>
                <TableHead className="py-2 text-xs">Product Code</TableHead>
                <TableHead className="py-2 text-xs">Unit</TableHead>
                <TableHead className="py-2 text-xs text-center">GST%</TableHead>
                <TableHead className="py-2 text-xs">HSN Code</TableHead>
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
                        isSelected ? 'bg-amber-500 text-white hover:bg-amber-500 font-semibold' : 'hover:bg-muted/50'
                      }`}
                    >
                      <TableCell className="py-1.5 font-medium">{p.prd_name}</TableCell>
                      <TableCell className="py-1.5 font-mono">{p.prd_code || '-'}</TableCell>
                      <TableCell className="py-1.5">{p.units || 'NOS'}</TableCell>
                      <TableCell className="py-1.5 text-center font-mono">{p.gst_perc || 0}%</TableCell>
                      <TableCell className="py-1.5 font-mono">{p.hsn_code || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Bar */}
        <div className="bg-muted/40 p-2 border-t text-xs flex justify-between items-center text-muted-foreground">
          <div>
            Double click or press <kbd className="px-1 border rounded bg-background font-mono">Select [F5]</kbd> to enter stock item details.
          </div>
          <div>Total Products: {products.length}</div>
        </div>
      </div>
    </div>
  );
}
