import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';

export interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  variant?: 'rounded-full' | 'rounded-xl';
  align?: 'left' | 'right' | 'auto';
  searchable?: boolean;
}

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Pilih Opsi',
  className = '',
  buttonClassName = '',
  variant = 'rounded-full',
  align = 'auto',
  searchable
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search query when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const toggleOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Select all currently visible filtered options, preserving any already selected
    const merged = Array.from(new Set([...selected, ...filteredOptions]));
    onChange(merged);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleQuickClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const shouldShowSearch = searchable !== undefined ? searchable : options.length > 6;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const displayText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${selected.length} dipilih`;
  }, [selected, placeholder]);

  // Determine button base classes based on variant
  const baseButtonClasses = variant === 'rounded-xl'
    ? 'w-full flex items-center justify-between text-xs border border-slate-200 rounded-xl py-2 px-2.5 bg-slate-50 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-700 shadow-2xs transition-all'
    : 'w-full flex items-center justify-between text-xs border border-slate-200 rounded-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 shadow-sm transition-all';

  const isAllVisibleSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClassName || baseButtonClasses} ${selected.length > 0 ? 'border-blue-300 bg-blue-50/40 text-blue-900' : ''}`}
        title={selected.length > 0 ? selected.join(', ') : placeholder}
      >
        <div className="flex items-center gap-1.5 truncate pr-1">
          <span className={`truncate ${selected.length === 0 ? 'text-slate-500 font-normal' : 'font-bold'}`}>
            {displayText}
          </span>
          {selected.length > 1 && (
            <span className="shrink-0 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9.5px] font-black leading-none">
              {selected.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1 text-slate-400">
          {selected.length > 0 && (
            <span
              onClick={handleQuickClear}
              className="p-0.5 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              title="Hapus saringan"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div 
          className={`absolute top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl min-w-[210px] w-full max-w-[320px] overflow-hidden animate-in fade-in-50 zoom-in-95 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Quick Actions Header */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-[10px] font-bold">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`hover:text-blue-700 transition-colors ${isAllVisibleSelected ? 'text-blue-600 font-extrabold' : 'text-slate-600'}`}
            >
              Pilih Semua
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={selected.length === 0}
              className={`transition-colors ${selected.length > 0 ? 'text-rose-600 hover:text-rose-700 font-bold' : 'text-slate-400 cursor-not-allowed'}`}
            >
              Hapus Semua
            </button>
          </div>

          {/* Search filter if many options */}
          {shouldShowSearch && (
            <div className="p-2 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari opsi..."
                  className="w-full pl-8 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List with Checkboxes */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 font-medium">
                Tidak ada opsi yang cocok
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = selected.includes(option);
                return (
                  <div
                    key={option}
                    onClick={(e) => toggleOption(option, e)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-50/80 text-blue-900 font-bold' 
                        : 'hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    {/* Checkbox square */}
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' 
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <span className="text-xs leading-snug break-words">
                      {option}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info badge */}
          {selected.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
              <span>{selected.length} dari {options.length} dipilih</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-blue-600 hover:text-blue-800 font-bold"
              >
                Selesai
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
