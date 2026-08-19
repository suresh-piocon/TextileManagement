'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/hooks/use-app';

interface LedgerSearchProps {
  onSelect: (ledger: any) => void;
  filterGroupId?: number;
  placeholder?: string;
  value?: string;
}

export function LedgerSearch({ onSelect, filterGroupId, placeholder = "Search ledger...", value = '' }: LedgerSearchProps) {
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

      let query = supabase
        .from('ledger')
        .select('*')
        .eq('frm_code', company.frm_code)
        .ilike('ledg_name', `%${searchTerm}%`)
        .limit(20);
        
      if (filterGroupId) {
        query = query.eq('grp_id', filterGroupId);
      }

      const { data } = await query;
      if (data) {
        setResults(data);
      }
    };

    const debounce = setTimeout(() => {
      search();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm, company?.frm_code, filterGroupId, supabase]);

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
          {results.map((ledger) => (
            <div
              key={ledger.ledg_code}
              className="px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col"
              onClick={() => {
                onSelect(ledger);
                setSearchTerm(ledger.ledg_name);
                setIsOpen(false);
              }}
            >
              <div className="font-medium">{ledger.ledg_name}</div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Code: {ledger.ledg_code}</span>
                {ledger.city && <span>City: {ledger.city}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

