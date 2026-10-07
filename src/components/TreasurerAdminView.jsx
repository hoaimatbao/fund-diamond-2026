import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  X, 
  Receipt, 
  ScanLine, 
  CheckCircle2, 
  Check,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  QrCode
} from 'lucide-react';
import SummaryCards from './SummaryCards';
import CategoryBadge, { normalizeCategory } from './CategoryBadge';
import { formatCurrency } from '../utils/formatters';

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

export default function TreasurerAdminView({
  fundInfo,
  transactions = [],
  onUpdateFundSettings,
  onOpenManualEntry,
  onOpenScanner,
  onEditTransaction,
  onDeleteTransaction,
  onUpdateCategory,
  onConfirmReimburse,
  onOpenQRModal,
  onBackToPublic
}) {
  // Config form state
  const [bannerTitle, setBannerTitle] = useState(fundInfo.bannerTitle || 'Quỹ Team Diamond');
  const [bannerDesc, setBannerDesc] = useState(fundInfo.bannerDescription || '');
  const [memberCount, setMemberCount] = useState(fundInfo.memberCount || 15);
  const [members, setMembers] = useState(
    fundInfo.members && fundInfo.members.length > 0
      ? fundInfo.members
      : ['Thanh', 'Hoài', 'Hằng', 'Tuyển', 'Hải VT', 'Bác Ái', 'Trang', 'Minh', 'Hương', 'Đức', 'Linh', 'Quân', 'Phương', 'Dũng', 'Sếp']
  );
  const [newMemberName, setNewMemberName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Table search & filter inside admin
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
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

  useEffect(() => {
    if (fundInfo) {
      if (fundInfo.bannerTitle) setBannerTitle(fundInfo.bannerTitle);
      if (fundInfo.bannerDescription) setBannerDesc(fundInfo.bannerDescription);
      if (fundInfo.memberCount !== undefined) setMemberCount(fundInfo.memberCount);
      if (fundInfo.members) setMembers(fundInfo.members);
    }
  }, [fundInfo]);

  // Handle adding a member
  const handleAddMember = (e) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.includes(trimmed)) {
      alert('Thành viên này đã có trong danh sách!');
      return;
    }
    const updated = [...members, trimmed];
    setMembers(updated);
    setMemberCount(updated.length);
    setNewMemberName('');
  };

  // Handle removing a member
  const handleRemoveMember = (nameToRemove) => {
    const updated = members.filter(m => m !== nameToRemove);
    setMembers(updated);
    setMemberCount(updated.length);
  };

  // Save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    await onUpdateFundSettings({
      bannerTitle,
      bannerDescription: bannerDesc,
      memberCount: Number(memberCount),
      members
    });
    setSavingSettings(false);
  };

  // Filtered & sorted transactions in admin view
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchDesc = (t.description || '').toLowerCase().includes(term);
          const matchDate = (t.date || '').includes(term);
          const matchId = String(t.id).includes(term);
          const normCat = normalizeCategory(t.category || '');
          const matchCat = normCat.toLowerCase().includes(term);
          const matchAuthor = (t.submittedBy || t.recordedBy || '').toLowerCase().includes(term);
          if (!matchDesc && !matchDate && !matchId && !matchCat && !matchAuthor) return false;
        }

        // Reimbursement filter
        if (filterReimburse === 'PENDING') {
          const isPending = t.type === 'CHI' && t.submittedBy && t.submittedBy !== 'Thủ quỹ' && t.reimbursementStatus !== 'REIMBURSED';
          if (!isPending) return false;
        } else if (filterReimburse === 'REIMBURSED') {
          const isReimbursed = (t.type === 'CHI' && t.submittedBy && t.submittedBy !== 'Thủ quỹ' && t.reimbursementStatus === 'REIMBURSED');
          if (!isReimbursed) return false;
        }

        if (filterType !== 'ALL' && t.type !== filterType) return false;
        if (filterCategory !== 'ALL') {
          const normCat = normalizeCategory(t.category || '');
          if (normCat.toLowerCase() !== filterCategory.toLowerCase()) return false;
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
  }, [transactions, searchTerm, filterType, filterCategory, filterReimburse, sortOrder]);

  // Reset page on filter/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterCategory, filterReimburse, sortOrder, pageSize]);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner & Navigation */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-amber-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-amber-950 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                Không Gian Quản Trị Thủ Quỹ
              </span>
              <span className="text-xs text-amber-200/80">
                Toàn quyền thêm, sửa, xóa & chỉnh cấu hình
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Quản Trị Quỹ Team Diamond
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Mọi thay đổi về thông tin banner, số thành viên, danh sách tên thành viên và các khoản thu chi sẽ được tự động lưu thẳng vào hệ thống máy chủ.
            </p>
          </div>

          <button
            onClick={onBackToPublic}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold rounded-xl border border-white/20 shadow-xs transition hover:scale-102"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Xem Bảng Quỹ Công Khai</span>
          </button>
        </div>
      </div>

      {/* Real-time KPI Cards */}
      <SummaryCards
        summary={fundInfo.summary}
        transactions={transactions}
      />

      {/* PHẦN 1: CẤU HÌNH THÔNG TIN CHUNG CỦA QUỸ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                1. Quản Lý Cấu Hình Chung Của Quỹ & Thành Viên
              </h3>
              <p className="text-xs text-slate-500">
                Chỉnh sửa số lượng, danh sách tên thành viên Team Diamond và nội dung hiển thị trên Banner
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tiêu đề Banner */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tiêu đề Banner:
              </label>
              <input
                type="text"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="Ví dụ: Quỹ Team Diamond"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden font-medium"
              />
            </div>

            {/* Số lượng thành viên */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Số lượng thành viên:
                </label>
                <span className="text-xs text-slate-400">
                  (Khớp với {members.length} người trong danh sách)
                </span>
              </div>
              <input
                type="number"
                min="1"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                placeholder="15"
                className="w-full px-3.5 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              />
            </div>

            {/* Mô tả Banner */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mô tả quỹ hiển thị trên Banner:
              </label>
              <textarea
                rows={2}
                value={bannerDesc}
                onChange={(e) => setBannerDesc(e.target.value)}
                placeholder="Mô tả mục đích và cam kết minh bạch của quỹ..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden font-normal text-slate-700"
              />
            </div>
          </div>

          {/* Danh sách thành viên Team Diamond */}
          <div className="pt-2 border-t border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Danh Sách Tên Thành Viên Team Diamond ({members.length} người):
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dùng để hiển thị, điểm danh và phục vụ tick chọn nộp quỹ định kỳ từng thành viên.
                </p>
              </div>

              {/* Form thêm thành viên */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Nhập tên thành viên mới..."
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-500 w-48"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            {/* Member Chips */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[56px] items-center">
              {members.map((name, idx) => (
                <div
                  key={idx}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/30 transition"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-slate-800">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(name)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-rose-50 transition"
                    title={`Xóa ${name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>

      {/* PHẦN 2: QUẢN LÝ & CHỈNH SỬA CÁC KHOẢN GIAO DỊCH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span>2. Quản Trị Các Khoản Giao Dịch Thu - Chi</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-200 text-slate-700">
                {transactions.length} dòng
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thao tác trực tiếp nút <strong>Sửa</strong> và <strong>Xóa</strong>. Khi sửa/xóa, Tổng Thu, Tổng Chi và Mốc Đối Soát sẽ tự động tính lại ngay lập tức.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenScanner}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-xl border border-emerald-300 shadow-2xs transition"
            >
              <ScanLine className="w-4 h-4 text-emerald-700" />
              <span>Quét Bill AI</span>
            </button>

            <button
              onClick={onOpenManualEntry}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Giao Dịch Mới</span>
            </button>
          </div>
        </div>

        {/* Reimbursement Filter Tabs Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-2xs w-fit">
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
                <span>Cần thanh toán hoàn ứng:</span>
                <strong className="font-mono font-bold text-amber-950 text-sm">{formatCurrency(pendingTotalAmount)}</strong>
              </div>
            )}

            {onOpenQRModal && (
              <button
                type="button"
                onClick={() => onOpenQRModal('hoai')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 shadow-2xs transition cursor-pointer"
                title="Xem mã QR chuyển khoản nộp quỹ"
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
                  Thủ quỹ bấm nút <strong>"Xác nhận đã giải ngân"</strong> ở mỗi dòng sau khi đã chuyển khoản trả tiền cho thành viên.
                </p>
              </div>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-300 font-bold text-amber-950 shadow-2xs shrink-0">
              Tổng số tiền cần trả: <span className="text-rose-700 font-mono text-base font-extrabold">{formatCurrency(pendingTotalAmount)}</span>
            </div>
          </div>
        )}

        {/* Toolbar filter in Admin Table */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo nội dung, STT, ngày..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto flex-wrap">
            {/* Filter Type */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-1 rounded-md font-medium transition ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
              >
                Tất cả ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('THU')}
                className={`px-2 py-1 rounded-md font-medium transition ${filterType === 'THU' ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`}
              >
                Thu (+)
              </button>
              <button
                type="button"
                onClick={() => setFilterType('CHI')}
                className={`px-2 py-1 rounded-md font-medium transition ${filterType === 'CHI' ? 'bg-rose-600 text-white' : 'text-rose-700'}`}
              >
                Chi (-)
              </button>
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'NEWEST_FIRST' ? 'EXCEL_ASC' : 'NEWEST_FIRST')}
              className={`inline-flex items-center gap-1.5 font-bold py-1.5 px-3 rounded-lg text-xs border shadow-2xs transition ${
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
                  <span>Cũ nhất trước</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Admin Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse excel-table">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-3.5 w-24">Ngày</th>
                <th className="py-3 px-4 min-w-[240px]">Lý do / Nội dung</th>
                <th className="py-3 px-3 text-center w-28">Phân loại</th>
                <th className="py-3 px-3.5 text-right w-32 text-emerald-800 bg-emerald-50/50">Thu (+)</th>
                <th className="py-3 px-3.5 text-right w-32 text-rose-800 bg-rose-50/50">Chi (-)</th>
                <th className="py-3 px-3.5 text-right w-32 text-amber-900 bg-amber-50/40">Số Dư Quỹ</th>
                <th className="py-3 px-3 text-center w-28 text-slate-800 bg-amber-50/80">Thao Tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Không tìm thấy giao dịch nào phù hợp
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, idx) => {
                  const isIncome = tx.type === 'THU';
                  return (
                    <tr key={tx.id} className={`hover:bg-slate-50/90 transition ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                      {/* STT */}
                      <td className="py-2.5 px-3 text-center font-mono text-xs font-bold text-slate-500">
                        {tx.id}
                      </td>

                      {/* Ngày */}
                      <td className="py-2.5 px-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Lý do */}
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <div>{tx.description}</div>
                        {(tx.submittedBy || tx.recordedBy || tx.note) && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 flex-wrap">
                            {(tx.submittedBy || tx.recordedBy) && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                <span>{tx.submittedBy || tx.recordedBy}</span>
                              </span>
                            )}

                            {/* Badge trạng thái hoàn ứng */}
                            {tx.type === 'CHI' && tx.submittedBy && tx.submittedBy !== 'Thủ quỹ' && (
                              tx.reimbursementStatus === 'REIMBURSED' ? (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Đã giải ngân</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs">
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
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs transition cursor-pointer"
                                title={`Bấm để mở mã QR chuyển khoản của ${tx.submittedBy}`}
                              >
                                <QrCode className="w-3 h-3 text-emerald-600" />
                                <span>QR {tx.submittedBy}</span>
                              </button>
                            )}

                            {tx.note && <span className="italic">↳ {tx.note}</span>}
                          </div>
                        )}
                      </td>

                      {/* Phân loại badge (click to change) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <CategoryBadge
                          transaction={tx}
                          onUpdateCategory={onUpdateCategory}
                        />
                      </td>

                      {/* Thu */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap bg-emerald-50/20">
                        {isIncome ? `+${formatCurrency(tx.amount)}` : '-'}
                      </td>

                      {/* Chi */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-rose-600 whitespace-nowrap bg-rose-50/20">
                        {!isIncome ? `-${formatCurrency(tx.amount)}` : '-'}
                      </td>

                      {/* Số dư */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap bg-amber-50/20">
                        {tx.runningBalance !== undefined ? formatCurrency(tx.runningBalance) : '-'}
                      </td>

                      {/* THAO TÁC: SỬA & XÓA & GIẢI NGÂN */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap bg-amber-50/40">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Xác nhận đã giải ngân */}
                          {tx.type === 'CHI' && tx.submittedBy && tx.submittedBy !== 'Thủ quỹ' && tx.reimbursementStatus !== 'REIMBURSED' && onConfirmReimburse && (
                            <button
                              type="button"
                              onClick={() => onConfirmReimburse(tx.id, 'REIMBURSED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/30 transition cursor-pointer"
                              title="Bấm để xác nhận thủ quỹ đã chuyển khoản trả tiền cho người ứng"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Xác nhận đã giải ngân</span>
                            </button>
                          )}

                          {/* Nút Sửa */}
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition shadow-2xs cursor-pointer"
                            title="Sửa ngày, lý do, số tiền, phân loại"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>

                          {/* Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition shadow-2xs cursor-pointer"
                            title="Xóa giao dịch này"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Admin Pagination Controls */}
        {totalItems > 0 && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            {/* Left: Summary info & Page size selector */}
            <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
              <span className="text-slate-600 font-medium">
                Hiển thị <strong className="text-slate-900 font-mono font-bold">{totalItems === 0 ? 0 : startIndex + 1} - {endIndex}</strong> trong tổng số <strong className="text-slate-900 font-mono font-bold">{totalItems}</strong> giao dịch
              </span>

              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <label htmlFor="adminPageSizeSelect" className="text-slate-500 text-xs whitespace-nowrap">
                  Số dòng/trang:
                </label>
                <select
                  id="adminPageSizeSelect"
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
                      return <span key={`admin-ellipsis-${idx}`} className="px-1 text-slate-400">...</span>;
                    }
                    const isCurrent = p === safeCurrentPage;
                    return (
                      <button
                        key={`admin-p-${p}`}
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

    </div>
  );
}
