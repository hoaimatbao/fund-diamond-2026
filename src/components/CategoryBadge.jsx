import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Check, 
  Plus, 
  Filter, 
  UtensilsCrossed, 
  Trophy, 
  Landmark, 
  History, 
  PartyPopper, 
  Award, 
  Cake, 
  Tag, 
  Compass, 
  Sparkles 
} from 'lucide-react';

export const STANDARD_CATEGORIES = [
  { name: 'Ăn uống (Chè, trà sữa, cafe...)', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', icon: UtensilsCrossed },
  { name: 'Đóng quỹ & Thưởng dự án', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', icon: Landmark },
  { name: 'Chi tiêu khác', color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200', icon: Tag },
  { name: 'Ăn uống', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', icon: UtensilsCrossed },
  { name: 'Thưởng dự án', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', icon: Trophy },
  { name: 'Đóng quỹ', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', icon: Landmark },
  { name: 'Quỹ ban đầu', color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100', icon: History },
  { name: 'Liên hoan', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', icon: PartyPopper },
  { name: 'Khen thưởng', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', icon: Award },
  { name: 'Sinh nhật', color: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100', icon: Cake },
  { name: 'Teambuilding', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', icon: Compass },
  { name: 'Khác', color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200', icon: Tag },
];

export function normalizeCategory(categoryName) {
  if (!categoryName) return '';
  const trimmed = categoryName.trim();
  if (trimmed === 'An u?ng' || trimmed === 'An uong' || trimmed.toLowerCase() === 'an u?ng') {
    return 'Ăn uống';
  }
  return trimmed;
}

export function getCategoryStyle(categoryName) {
  const normalized = normalizeCategory(categoryName);
  const match = STANDARD_CATEGORIES.find(c => c.name.toLowerCase() === normalized.toLowerCase());
  if (match) return match.color;
  return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
}

export default function CategoryBadge({
  transaction,
  onUpdateCategory,
  onFilterCategory,
  isFiltered = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef(null);

  const rawCategory = transaction.category || (transaction.type === 'THU' ? 'Thu khác' : 'Chi khác');
  const currentCategory = normalizeCategory(rawCategory);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomInput('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (categoryName) => {
    if (categoryName !== currentCategory) {
      onUpdateCategory(transaction.id, categoryName);
    }
    setIsOpen(false);
    setShowCustomInput(false);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customInput.trim()) {
      handleSelect(customInput.trim());
      setCustomInput('');
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (onFilterCategory) {
      onFilterCategory(currentCategory);
    }
  };

  const styleClass = getCategoryStyle(currentCategory);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onDoubleClick={handleDoubleClick}
        title="Bấm để đổi phân loại • Click đúp để lọc theo danh mục này"
        className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer shadow-2xs select-none ${styleClass} ${
          isFiltered ? 'ring-2 ring-emerald-500 font-bold' : ''
        }`}
      >
        <span>{currentCategory}</span>
        <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute z-50 left-1/2 -translate-x-1/2 mt-1.5 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Chọn phân loại:</span>
            {onFilterCategory && (
              <button
                type="button"
                onClick={() => {
                  onFilterCategory(currentCategory);
                  setIsOpen(false);
                }}
                className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
                title="Lọc bảng theo danh mục này"
              >
                <Filter className="w-3 h-3" />
                Lọc mục này
              </button>
            )}
          </div>

          {/* Categories List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {STANDARD_CATEGORIES.map((cat) => {
              const isSelected = cat.name.toLowerCase() === currentCategory.toLowerCase();
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleSelect(cat.name)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <IconComp className="w-3.5 h-3.5 text-slate-500" />
                    <span>{cat.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                </button>
              );
            })}
          </div>

          {/* Custom Input Option */}
          <div className="pt-1.5 mt-1 border-t border-slate-100 px-2">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm danh mục khác...</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="flex gap-1 py-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Nhập tên mới..."
                  autoFocus
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!customInput.trim()}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold disabled:opacity-50"
                >
                  Lưu
                </button>
              </form>
            )}
          </div>

          <div className="px-2.5 py-1 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100 text-center mt-1">
            💡 Click đúp vào nhãn để lọc nhanh
          </div>
        </div>
      )}
    </div>
  );
}
