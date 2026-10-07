import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Receipt, 
  Eye, 
  Trash2, 
  Edit3, 
  X, 
  Tag, 
  Calendar, 
  FileText, 
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  QrCode
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import CategoryBadge, { normalizeCategory } from './CategoryBadge';

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function FundTable({
  transactions = [],
  isTreasurer = false,
  onViewBill,
  onDeleteTransaction,
  onEditTransaction,
  onUpdateCategory,
  onConfirmReimburse,
  onOpenQRModal
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, THU, CHI
  const [filterMonth, setFilterMonth] = useState('ALL'); // ALL, 01, 02...
  const [filterCategory, setFilterCategory] = useState('ALL'); // ALL or category name
  const [filterReimburse, setFilterReimburse] = useState('ALL'); // ALL, PENDING, REIMBURSED
  const [sortOrder, setSortOrder] = useState('NEWEST_FIRST'); // Mặc định: Mới nhất lên đầu
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // Mặc định 15 dòng/trang

  // Pending reimbursements count and total amount
  const pendingReimbursements = useMemo(() => {
    return transactions.filter(t => 
      t.type === 'CHI' && 
      t.submittedBy && 
      t.submittedBy !== 'Thủ quỹ' && 
      t.reimbursementStatus !== 'REIMBURSED'
    );
  }, [transactions]);

  const pendingCount = pendingReimbursements.length;
  const pendingTotalAmount = useMemo(() => {
    return pendingReimbursements.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [pendingReimbursements]);

  // Get distinct months from data
  const months = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.date) {
        const parts = t.date.split('/');
        if (parts.length >= 3) {
          set.add(`${parts[1]}/${parts[2]}`);
        }
      }
    });
    return Array.from(set).sort((a, b) => {
      const [m1, y1] = a.split('/').map(Number);
      const [m2, y2] = b.split('/').map(Number);
      return y1 !== y2 ? y1 - y2 : m1 - m2;
    });
  }, [transactions]);

  // Get distinct categories from data (normalized)
  const categories = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.category) {
        const cat = normalizeCategory(t.category);
        set.add(cat);
      }
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered & sorted transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        // Search filter
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchDesc = (t.description || '').toLowerCase().includes(term);
          const normCat = normalizeCategory(t.category || '');
          const matchCategory = normCat.toLowerCase().includes(term);
          const matchNote = (t.note || '').toLowerCase().includes(term);
          const matchDate = (t.date || '').includes(term);
          const matchId = String(t.id).includes(term);
          const matchAuthor = (t.submittedBy || t.recordedBy || '').toLowerCase().includes(term);
          if (!matchDesc && !matchCategory && !matchNote && !matchDate && !matchId && !matchAuthor) {
            return false;
          }
        }

        // Reimbursement filter
        if (filterReimburse === 'PENDING') {
          const isPending = t.type === 'CHI' && t.submittedBy && t.submittedBy !== 'Thủ quỹ' && t.reimbursementStatus !== 'REIMBURSED';
          if (!isPending) return false;
        } else if (filterReimburse === 'REIMBURSED') {
          const isReimbursed = (t.type === 'CHI' && t.submittedBy && t.submittedBy !== 'Thủ quỹ' && t.reimbursementStatus === 'REIMBURSED');
          if (!isReimbursed) return false;
        }

        // Type filter
        if (filterType !== 'ALL' && t.type !== filterType) {
          return false;
        }

        // Month filter
        if (filterMonth !== 'ALL') {
          const [m] = filterMonth.split('/');
          if (!t.date || !t.date.includes(`/${m}/`)) {
            return false;
          }
        }

        // Category filter
        if (filterCategory !== 'ALL') {
          const normCat = normalizeCategory(t.category || '');
          if (normCat.toLowerCase() !== filterCategory.toLowerCase()) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'NEWEST_FIRST') {
          return Number(b.id) - Number(a.id);
        } else {
          return Number(a.id) - Number(b.id);
        }
      });
  }, [transactions, searchTerm, filterType, filterMonth, filterCategory, filterReimburse, sortOrder]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterMonth, filterCategory, filterReimburse, sortOrder, pageSize]);

  // Pagination calculations
  const totalItems = filteredTransactions.length;
  const isShowAll = pageSize === -1;
  const effectivePageSize = isShowAll ? Math.max(totalItems, 1) : pageSize;
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = isShowAll ? 0 : (safeCurrentPage - 1) * effectivePageSize;
  const endIndex = isShowAll ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, startIndex, endIndex]);

  // Sums for current filtered list (all items in current filter)
  const filteredSummary = useMemo(() => {
    let thu = 0;
    let chi = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'THU') thu += Number(t.amount) || 0;
      if (t.type === 'CHI') chi += Number(t.amount) || 0;
    });
    return { thu, chi, balance: thu - chi };
  }, [filteredTransactions]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-12">
      
      {/* Thanh tab theo dõi hoàn ứng / giải ngân */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs w-fit">
          <button
            type="button"
            onClick={() => setFilterReimburse('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              filterReimburse === 'ALL'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Tất cả</span>
            <span className="text-[11px] opacity-75 font-mono">({transactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterReimburse('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              filterReimburse === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-900 hover:bg-amber-50'
            }`}
          >
            <span>⏳ Chờ hoàn ứng</span>
            {pendingCount > 0 && (
              <span className={`px-2 py-0.2 rounded-full text-[10.5px] font-black ${
                filterReimburse === 'PENDING' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-950 border border-amber-300'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterReimburse('REIMBURSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              filterReimburse === 'REIMBURSED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <span>✓ Đã giải ngân</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 shadow-2xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Cần hoàn ứng:</span>
              <strong className="font-mono font-bold text-amber-950 text-sm">{formatCurrency(pendingTotalAmount)}</strong>
            </div>
          )}

          {onOpenQRModal && (
            <button
              type="button"
              onClick={() => onOpenQRModal('hoai')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 shadow-2xs transition cursor-pointer"
              title="Xem ảnh mã QR chuyển khoản nộp quỹ cho Thủ quỹ"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>QR Nộp Quỹ</span>
            </button>
          )}
        </div>
      </div>

      {/* Thông báo chi tiết khi lọc Chờ hoàn ứng */}
      {filterReimburse === 'PENDING' && (
        <div className="p-4 bg-amber-50/90 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm">
                Danh sách {filteredTransactions.length} khoản chi thành viên tự ứng tiền túi đang chờ nhận lại
              </p>
              <p className="text-amber-800 text-xs mt-0.5">
                Thủ quỹ cần chuyển khoản thanh toán hoàn ứng cho các thành viên bên dưới.
              </p>
            </div>
          </div>
          <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-300 font-bold text-amber-950 shadow-2xs shrink-0">
            Tổng số tiền cần trả: <span className="text-rose-700 font-mono text-base font-extrabold">{formatCurrency(pendingTotalAmount)}</span>
          </div>
        </div>
      )}

      {/* Table Toolbar & Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo lý do ('ăn chè', 'Sen Tây Hồ', 'thưởng team'...)..."
              className="w-full pl-10 pr-9 py-2 bg-white text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters & Sort Controls */}
          <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm">
            
            {/* Filter by Type */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition ${filterType === 'ALL' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Tất cả ({transactions.length})
              </button>
              <button
                onClick={() => setFilterType('THU')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition ${filterType === 'THU' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
              >
                Thu (+)
              </button>
              <button
                onClick={() => setFilterType('CHI')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition ${filterType === 'CHI' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'}`}
              >
                Chi (-)
              </button>
            </div>

            {/* Filter by Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`bg-white border font-medium py-1.5 px-3 rounded-lg text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 shadow-2xs transition ${
                filterCategory !== 'ALL'
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold'
                  : 'border-slate-300 text-slate-700'
              }`}
            >
              <option value="ALL">🏷️ Tất cả phân loại</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Filter by Month */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 font-medium py-1.5 px-3 rounded-lg text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 shadow-2xs"
            >
              <option value="ALL">🗓️ Toàn bộ thời gian</option>
              {months.map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'NEWEST_FIRST' ? 'EXCEL_ASC' : 'NEWEST_FIRST')}
              className={`inline-flex items-center gap-1.5 font-bold py-1.5 px-3 rounded-lg text-xs sm:text-sm border shadow-2xs transition ${
                sortOrder === 'NEWEST_FIRST'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Bấm để chuyển đổi thứ tự sắp xếp (Mới nhất trước / Cũ nhất trước)"
            >
              {sortOrder === 'NEWEST_FIRST' ? (
                <>
                  <ArrowDownWideNarrow className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mới nhất trước</span>
                </>
              ) : (
                <>
                  <ArrowUpNarrowWide className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cũ nhất trước (Gốc Excel)</span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* Search & Active Filters indicator */}
        {(searchTerm || filterType !== 'ALL' || filterMonth !== 'ALL' || filterCategory !== 'ALL') && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Tìm thấy <strong className="text-slate-800">{filteredTransactions.length}</strong> / {transactions.length} giao dịch
              </span>
              {filterCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-amber-300">
                  <Tag className="w-3 h-3 text-amber-700" />
                  <span>Phân loại: <strong>{filterCategory}</strong></span>
                  <button
                    onClick={() => setFilterCategory('ALL')}
                    className="hover:text-amber-950 p-0.5"
                    title="Bỏ lọc danh mục này"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={() => { setSearchTerm(''); setFilterType('ALL'); setFilterMonth('ALL'); setFilterCategory('ALL'); }}
              className="text-emerald-600 hover:text-emerald-700 font-medium underline"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Main Excel-like Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse excel-table">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
              <th className="py-3.5 px-3.5 text-center w-14">STT</th>
              <th className="py-3.5 px-4 w-28 whitespace-nowrap">Ngày</th>
              <th className="py-3.5 px-4 min-w-[260px]">Lý do / Diễn giải nội dung</th>
              <th className="py-3.5 px-3 whitespace-nowrap text-center w-28">Phân loại</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap w-36 text-emerald-800 bg-emerald-50/50">
                Thu (+)
              </th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap w-36 text-rose-800 bg-rose-50/50">
                Chi (-)
              </th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap w-36 text-amber-900 bg-amber-50/40">
                Số Dư Lũy Kế
              </th>
              <th className="py-3.5 px-3 text-center whitespace-nowrap w-24">Chứng từ</th>
              {isTreasurer && (
                <th className="py-3.5 px-3 text-center whitespace-nowrap w-24 text-slate-600">Thao tác</th>
              )}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={isTreasurer ? 9 : 8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <FileText className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Không tìm thấy giao dịch nào</p>
                    <p className="text-xs text-slate-400 mt-0.5">Hãy thử tìm với từ khóa khác hoặc xóa bộ lọc</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx, idx) => {
                const isIncome = tx.type === 'THU';
                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                    } ${tx.id === 118 ? 'bg-amber-50/20' : ''}`}
                  >
                    {/* STT */}
                    <td className="py-3 px-3.5 text-center font-mono text-xs font-semibold text-slate-500">
                      {tx.id}
                    </td>

                    {/* Ngày */}
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Lý do / Diễn giải */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 leading-snug">
                        {tx.description}
                      </div>
                      {(tx.submittedBy || tx.recordedBy || tx.note) && (
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          {(tx.submittedBy || tx.recordedBy) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>{tx.submittedBy || tx.recordedBy}</span>
                            </span>
                          )}

                          {/* Trạng thái hoàn ứng nếu thành viên tự ứng tiền */}
                          {tx.type === 'CHI' && tx.submittedBy && tx.submittedBy !== 'Thủ quỹ' && (
                            tx.reimbursementStatus === 'REIMBURSED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Đã giải ngân</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Chờ hoàn ứng</span>
                              </span>
                            )
                          )}

                          {/* Nút xem QR người chi */}
                          {tx.type === 'CHI' && tx.submittedBy && tx.submittedBy !== 'Thủ quỹ' && onOpenQRModal && (
                            <button
                              type="button"
                              onClick={() => {
                                const name = (tx.submittedBy || '').toLowerCase();
                                const idMap = { 'hoài': 'hoai', 'phương': 'phuong', 'hằng': 'hang', 'thanh': 'thanh', 'hà': 'ha', 'tuyển': 'tuyen' };
                                onOpenQRModal(idMap[name] || 'hoai');
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs transition cursor-pointer"
                              title={`Bấm để mở mã QR chuyển khoản của ${tx.submittedBy}`}
                            >
                              <QrCode className="w-3 h-3 text-emerald-600" />
                              <span>QR {tx.submittedBy}</span>
                            </button>
                          )}

                          {tx.note && (
                            <span className="text-slate-400">↳ {tx.note}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Phân loại badge */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <CategoryBadge
                        transaction={tx}
                        onUpdateCategory={onUpdateCategory}
                        onFilterCategory={(cat) => setFilterCategory(cat)}
                        isFiltered={filterCategory.toLowerCase() === (tx.category || '').toLowerCase()}
                      />
                    </td>

                    {/* Thu (+) */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap bg-emerald-50/20">
                      {isIncome ? `+${formatCurrency(tx.amount)}` : '-'}
                    </td>

                    {/* Chi (-) */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-600 whitespace-nowrap bg-rose-50/20">
                      {!isIncome ? `-${formatCurrency(tx.amount)}` : '-'}
                    </td>

                    {/* Số Dư Lũy Kế */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap bg-amber-50/20">
                      {tx.runningBalance !== undefined ? formatCurrency(tx.runningBalance) : '-'}
                    </td>

                    {/* Chứng từ / Bill đính kèm */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {tx.billImage ? (
                        <button
                          onClick={() => onViewBill(tx)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md border border-emerald-300 transition shadow-2xs group"
                          title="Xem ảnh hóa đơn đính kèm"
                        >
                          <Receipt className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          <span>Xem bill</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Thao tác (khi là Thủ quỹ) */}
                    {isTreasurer && (
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.type === 'CHI' && tx.submittedBy && tx.submittedBy !== 'Thủ quỹ' && tx.reimbursementStatus !== 'REIMBURSED' && onConfirmReimburse && (
                            <button
                              type="button"
                              onClick={() => onConfirmReimburse(tx.id, 'REIMBURSED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/30 transition cursor-pointer"
                              title="Xác nhận thủ quỹ đã chuyển tiền trả lại cho người ứng"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Xác nhận đã giải ngân</span>
                            </button>
                          )}
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Chỉnh sửa giao dịch"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Xóa giao dịch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Table Summary Footer (Excel Style) */}
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs uppercase tracking-wide">
              <td colSpan={4} className="py-4 px-4 text-right text-slate-700">
                TỔNG CỘNG ({filteredTransactions.length} GIAO DỊCH):
              </td>
              <td className="py-4 px-4 text-right font-mono text-sm font-extrabold text-emerald-700 bg-emerald-100/70 border-x border-slate-200">
                +{formatCurrency(filteredSummary.thu)}
              </td>
              <td className="py-4 px-4 text-right font-mono text-sm font-extrabold text-rose-700 bg-rose-100/70 border-r border-slate-200">
                -{formatCurrency(filteredSummary.chi)}
              </td>
              <td className="py-4 px-4 text-right font-mono text-sm font-black text-amber-950 bg-amber-200/70">
                {formatCurrency(filteredSummary.balance)}
              </td>
              <td colSpan={isTreasurer ? 2 : 1} className="py-4 px-3 bg-slate-100"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Left: Summary info & Page size selector */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <span className="text-slate-600 font-medium">
              Hiển thị <strong className="text-slate-900 font-mono font-bold">{totalItems === 0 ? 0 : startIndex + 1} - {endIndex}</strong> trong tổng số <strong className="text-slate-900 font-mono font-bold">{totalItems}</strong> giao dịch
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
              <label htmlFor="pageSizeSelect" className="text-slate-500 text-xs whitespace-nowrap">
                Số dòng/trang:
              </label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-hidden focus:border-emerald-500"
              >
                <option value={10}>10 dòng</option>
                <option value={15}>15 dòng (Mặc định)</option>
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={-1}>Tất cả ({totalItems})</option>
              </select>
            </div>
          </div>

          {/* Right: Page navigation buttons */}
          {!isShowAll && totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Previous page */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={safeCurrentPage === 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition text-xs font-medium shadow-2xs"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trước</span>
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 px-1">
                {getPageNumbers(safeCurrentPage, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">...</span>;
                  }
                  const isCurrent = p === safeCurrentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs font-mono'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-mono'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Next page */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition text-xs font-medium shadow-2xs"
                title="Trang sau"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
