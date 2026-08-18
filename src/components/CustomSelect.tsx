import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

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
  searchable?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  style = {},
  disabled = false,
  searchable
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [overflowAmount, setOverflowAmount] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    placeAbove: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const labelOuterRef = useRef<HTMLSpanElement>(null);
  const labelInnerRef = useRef<HTMLSpanElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  // Compute text overflow
  const checkOverflow = () => {
    const outer = labelOuterRef.current;
    const inner = labelInnerRef.current;
    if (outer && inner) {
      const diff = inner.scrollWidth - outer.clientWidth;
      setOverflowAmount(diff > 4 ? diff + 12 : 0);
    }
  };

  useEffect(() => {
    checkOverflow();
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedOption?.label, options, value]);

  const updateMenuPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < menuHeight && rect.top > menuHeight;
      setMenuPos({
        top: placeAbove ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        placeAbove
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      const handleReposition = () => updateMenuPosition();
      window.addEventListener('scroll', handleReposition, true);
      window.addEventListener('resize', handleReposition);
      return () => {
        window.removeEventListener('scroll', handleReposition, true);
        window.removeEventListener('resize', handleReposition);
      };
    }
  }, [isOpen]);

  // Determine whether to show search bar (default: if >= 5 options or searchable prop explicitly set to true)
  const shouldShowSearch = searchable !== false && (searchable === true || options.length >= 5);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      if (shouldShowSearch) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen, shouldShowSearch]);

  const filteredOptions = options.filter(opt => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      String(opt.value).toLowerCase().includes(term)
    );
  });

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full ${className}`}
      style={{ userSelect: 'none', ...style }}
    >
      {/* Closed Button Header */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            updateMenuPosition();
            setIsOpen(!isOpen);
          }
        }}
        onMouseEnter={() => {
          checkOverflow();
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className={`custom-select-trigger w-full flex items-center justify-between rounded-xl bg-[#0e1626] border border-white/15 text-slate-100 text-sm font-medium transition-all hover:bg-[#131d32] focus:outline-none cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed${isOpen ? ' is-open' : ''}`}
        style={{
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
          minHeight: '46px',
          borderColor: isOpen ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        }}
      >
        <span 
          ref={labelOuterRef}
          className={`leading-normal ${!selectedOption ? 'text-slate-400' : 'text-slate-100'}`} 
          style={{ 
            paddingLeft: '0.25rem', 
            overflow: 'hidden', 
            whiteSpace: 'nowrap', 
            flex: 1,
            minWidth: 0,
            display: 'block',
            position: 'relative',
            maskImage: overflowAmount > 0 
              ? (isHovered 
                  ? 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)' 
                  : 'linear-gradient(to right, black 80%, transparent 100%)') 
              : 'none',
            WebkitMaskImage: overflowAmount > 0 
              ? (isHovered 
                  ? 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)' 
                  : 'linear-gradient(to right, black 80%, transparent 100%)') 
              : 'none'
          }}
        >
          <span 
            ref={labelInnerRef} 
            style={{ 
              display: 'inline-block',
              whiteSpace: 'nowrap',
              transform: isHovered && overflowAmount > 0 ? `translateX(-${overflowAmount}px)` : 'translateX(0)',
              transition: isHovered && overflowAmount > 0 
                ? `transform ${Math.max(2.5, overflowAmount / 32)}s cubic-bezier(0.25, 1, 0.5, 1)` 
                : 'transform 0.35s ease-out'
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown 
          size={16} 
          className={`text-slate-300 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Portal Floating Menu Popup */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="custom-select-menu fixed z-[999999] bg-[#0c1322] border border-white/20 rounded-2xl shadow-2xl p-2 max-h-72 overflow-y-auto backdrop-blur-md animate-fadeIn"
          style={{
            top: menuPos.placeAbove ? 'auto' : `${menuPos.top}px`,
            bottom: menuPos.placeAbove ? `${window.innerHeight - menuPos.top}px` : 'auto',
            left: `${menuPos.left}px`,
            width: `${Math.max(menuPos.width, 220)}px`,
            boxShadow: '0 16px 36px rgba(0,0,0,0.95)',
            boxSizing: 'border-box'
          }}
        >
          {/* Sticky Search Input */}
          {shouldShowSearch && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                backgroundColor: '#0c1322',
                paddingBottom: '0.5rem',
                marginBottom: '0.4rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search player, code, or team..."
                  style={{
                    width: '100%',
                    paddingLeft: '2.2rem',
                    paddingRight: '2rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    fontSize: '0.82rem',
                    borderRadius: '10px',
                    backgroundColor: '#162238',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchTerm('');
                    }
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.2rem'
                    }}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {options.length === 0 ? (
            <div className="px-5 py-3 text-xs text-slate-400 text-center font-medium">
              No options available
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-5 py-4 text-xs text-slate-400 text-center font-medium">
              No player found matching "{searchTerm}"
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOptions.map((opt) => {
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
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
