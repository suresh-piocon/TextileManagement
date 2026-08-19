'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';

interface ProductSearchProps {
  onSelect: (product: any) => void;
  placeholder?: string;
  value?: string;
}

export function ProductSearch({ onSelect, placeholder = "Search product...", value = '' }: ProductSearchProps) {
  const { company } = useApp();
  const supabase = createClient();
  
  const [searchTerm, setSearchTerm] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!searchTerm || !company?.frm_code) {
        setResults([]);
        return;
      }

      const { data } = await supabase
        .from('product')
        .select('*')
        .eq('frm_code', company.frm_code)
        .or(`prd_name.ilike.%${searchTerm}%,prd_code.ilike.%${searchTerm}%`)
        .limit(20);

      if (data) {
        setResults(data);
      }
    };

    const debounce = setTimeout(() => {
      search();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm, company?.frm_code, supabase]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-auto">
          {results.map((product) => (
            <div
              key={product.ref_no}
              className="px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col"
              onClick={() => {
                onSelect(product);
                setSearchTerm(product.prd_name);
                setIsOpen(false);
              }}
            >
              <div className="font-medium">{product.prd_name}</div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Code: {product.prd_code}</span>
                <span>Price: ₹{product.sales_price}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

