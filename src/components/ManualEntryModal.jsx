import React, { useState, useEffect } from 'react';
import { X, PlusCircle, ArrowUpRight, ArrowDownRight, Upload, Calendar, DollarSign, FileText, CheckCircle2, Check } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const FUND_MEMBERS = ['Thanh', 'Hằng', 'Tuyển', 'Phương', 'Hà'];

export default function ManualEntryModal({ isOpen, onClose, onSave, editingTransaction }) {
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('vi-VN'),
    type: 'CHI',
    amount: '',
    description: '',
    category: 'Ăn uống',
    submittedBy: 'Thủ quỹ',
    note: '',
    billImage: ''
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        date: editingTransaction.date || new Date().toLocaleDateString('vi-VN'),
        type: editingTransaction.type || 'CHI',
        amount: editingTransaction.amount || '',
        description: editingTransaction.description || '',
        category: editingTransaction.category || 'Ăn uống',
        submittedBy: editingTransaction.submittedBy || editingTransaction.recordedBy || 'Thủ quỹ',
        note: editingTransaction.note || '',
        billImage: editingTransaction.billImage || ''
      });
    } else {
      setFormData({
        date: new Date().toLocaleDateString('vi-VN'),
        type: 'CHI',
        amount: '',
        description: '',
        category: 'Ăn uống',
        submittedBy: 'Thủ quỹ',
        note: '',
        billImage: ''
      });
    }
    setError('');
  }, [editingTransaction, isOpen]);

  if (!isOpen) return null;

  const handleToggleMember = (member) => {
    setFormData(prev => ({
      ...prev,
      submittedBy: prev.submittedBy === member ? 'Thủ quỹ' : member
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const body = new FormData();
    body.append('bill', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFormData(prev => ({ ...prev, billImage: data.url }));
      }
    } catch (err) {
      console.error('Lỗi upload file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setError('Vui lòng nhập lý do / diễn giải');
      return;
    }
    const num = Number(formData.amount);
    if (!num || num <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ lớn hơn 0');
      return;
    }

    const author = formData.submittedBy || 'Thủ quỹ';
    const isMemberExpense = formData.type === 'CHI' && author !== 'Thủ quỹ';

    onSave({
      ...formData,
      amount: num,
      submittedBy: author,
      recordedBy: author,
      reimbursementStatus: isMemberExpense 
        ? (editingTransaction?.reimbursementStatus || 'PENDING')
        : 'REIMBURSED'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${formData.type === 'THU' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {editingTransaction ? `Sửa Giao Dịch #${editingTransaction.id}` : 'Nhập Khoản Thu / Chi Mới'}
              </h3>
              <p className="text-xs text-slate-500">Cập nhật trực tiếp vào số dư quỹ Team Diamond</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
          {/* Loại giao dịch (Thu / Chi Toggle) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: 'THU', category: 'Đóng quỹ' }))}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition ${
                formData.type === 'THU'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>KHOẢN THU (+)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: 'CHI', category: 'Ăn uống' }))}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition ${
                formData.type === 'CHI'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>KHOẢN CHI (-)</span>
            </button>
          </div>

          {/* Số tiền */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Số tiền (VNĐ) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₫</span>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Ví dụ: 3500000 hoặc 154800"
                className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              />
            </div>
            {formData.amount && (
              <p className="text-xs text-emerald-600 font-medium">
                {formatCurrency(formData.amount)}
              </p>
            )}
          </div>

          {/* Lý do / Diễn giải */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Lý do / Diễn giải nội dung *</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ví dụ: Chi ăn chè, Thưởng các giải team, Sen Tây Hồ..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
            />
          </div>

          {/* Ngày & Phân loại */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Ngày nhập quỹ (DD/MM/YYYY)</label>
              <input
                type="text"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                placeholder="DD/MM/YYYY"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Danh mục</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white"
              >
                {formData.type === 'THU' ? (
                  <>
                    <option value="Đóng quỹ">Đóng quỹ</option>
                    <option value="Thưởng dự án">Thưởng dự án</option>
                    <option value="Quỹ ban đầu">Quỹ ban đầu</option>
                    <option value="Thưởng giải">Thưởng giải thể thao / Minigame</option>
                    <option value="Hoàn ứng">Hoàn tạm ứng</option>
                    <option value="Khác">Khác</option>
                  </>
                ) : (
                  <>
                    <option value="Ăn uống">Ăn uống</option>
                    <option value="Liên hoan">Liên hoan</option>
                    <option value="Khen thưởng">Khen thưởng</option>
                    <option value="Quỹ ban đầu">Quỹ ban đầu</option>
                    <option value="Sinh nhật">Sinh nhật</option>
                    <option value="Teambuilding">Teambuilding</option>
                    <option value="Khác">Khác</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Người thực hiện / Thành viên nhập quỹ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Người thực hiện / Thành viên nhập quỹ:
              </label>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition ${
                formData.submittedBy !== 'Thủ quỹ'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-300 shadow-2xs'
                  : 'text-slate-600 bg-slate-100 border-slate-200'
              }`}>
                {formData.submittedBy !== 'Thủ quỹ' ? `👤 Đã chọn: ${formData.submittedBy}` : '🏛️ Mặc định: Thủ quỹ'}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 pt-0.5">
              {FUND_MEMBERS.map((member) => {
                const isSelected = formData.submittedBy === member;
                return (
                  <button
                    key={member}
                    type="button"
                    onClick={() => handleToggleMember(member)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30 ring-2 ring-emerald-600/30 scale-102 font-extrabold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/90 hover:text-slate-900 border border-slate-200'
                    }`}
                    title={isSelected ? `Bấm lại để hủy chọn và quay về 'Thủ quỹ'` : `Chọn ${member}`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                    <span>{member}</span>
                  </button>
                );
              })}
            </div>

            {formData.type === 'CHI' && formData.submittedBy !== 'Thủ quỹ' ? (
              <p className="text-[11px] text-amber-800 font-medium bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                ⏳ Thành viên <strong>{formData.submittedBy}</strong> ứng tiền túi trước — Khoản chi sẽ tự động ghi nhận trạng thái <strong>Chờ hoàn ứng</strong> để thủ quỹ trả tiền.
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                (Thủ quỹ chi trực tiếp từ quỹ. Bấm chọn 1 thành viên nếu có người tự ứng tiền túi, bấm lại lần nữa để hủy chọn)
              </p>
            )}
          </div>

          {/* Upload ảnh bill */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-slate-700">Đính kèm ảnh bill / hóa đơn</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer text-xs text-slate-600 transition">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>{uploading ? 'Đang tải ảnh...' : 'Chọn ảnh bill từ máy'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {formData.billImage && (
                <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã có bill</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-600/30"
            >
              {editingTransaction ? 'Lưu Thay Đổi' : 'Xác Nhận & Lưu Vào Quỹ'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
