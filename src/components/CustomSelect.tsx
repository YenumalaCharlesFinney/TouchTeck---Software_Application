import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string | number | undefined | null;
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  style = {},
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full ${className}`}
      style={{ userSelect: 'none', zIndex: isOpen ? 9999 : 'auto', ...style }}
    >
      {/* Closed Button Header */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`custom-select-trigger w-full flex items-center justify-between rounded-xl bg-[#0e1626] border border-white/15 text-slate-100 text-sm font-medium transition-all hover:bg-[#131d32] focus:outline-none cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed${isOpen ? ' is-open' : ''}`}
        style={{
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
          minHeight: '46px',
          borderColor: isOpen ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        }}
      >
        <span className={`truncate leading-normal ${!selectedOption ? 'text-slate-400' : 'text-slate-100'}`} style={{ paddingLeft: '0.25rem' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-slate-300 shrink-0 ml-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Custom Rounded Floating Menu Popup */}
      {isOpen && (
        <div
          className="custom-select-menu absolute left-0 right-0 top-full mt-2 z-[99999] bg-[#0c1322] border border-white/20 rounded-2xl shadow-2xl p-2 max-h-64 overflow-y-auto space-y-1.5 backdrop-blur-md animate-fadeIn"
          style={{
            boxShadow: '0 16px 36px rgba(0,0,0,0.95)',
            boxSizing: 'border-box'
          }}
        >
          {options.length === 0 ? (
            <div className="px-5 py-3 text-xs text-slate-400 text-center font-medium">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`custom-select-option w-full flex items-center justify-between rounded-xl text-xs sm:text-sm font-medium transition-all text-left cursor-pointer leading-relaxed ${
                    isSelected
                      ? 'is-selected bg-slate-800 text-white font-bold border border-slate-600'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  style={{
                    paddingLeft: '1.25rem',
                    paddingRight: '1.25rem',
                    paddingTop: '0.65rem',
                    paddingBottom: '0.65rem'
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-[#fff500] shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
