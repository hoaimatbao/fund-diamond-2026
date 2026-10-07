import React from 'react';
import { AlertTriangle, Trash2, X, Calendar, DollarSign, Tag } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, transaction }) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-rose-950 text-base">
                Xác Nhận Xóa Giao Dịch
              </h3>
              <p className="text-xs text-rose-700/80">Thao tác dành cho Thủ Quỹ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-rose-100/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa giao dịch <strong className="text-slate-900 font-mono">#{transaction.id}</strong> sau đây khỏi quỹ không?
          </p>

          {/* Transaction Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Lý do:</span>
              <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{transaction.description}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ngày:</span>
              <span className="font-mono text-slate-700">{transaction.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Phân loại:</span>
              <span className={`font-semibold ${transaction.type === 'THU' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {transaction.type === 'THU' ? 'Thu (+)' : 'Chi (-)'} ({transaction.category})
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-semibold">Số tiền:</span>
              <span className="text-sm font-extrabold font-mono text-rose-600">
                {formatCurrency(transaction.amount)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            ⚠️ <strong>Lưu ý:</strong> Khi xóa dòng này, hệ thống sẽ tự động cập nhật lại <strong>Tổng Thu, Tổng Chi</strong> và <strong>Số Dư Quỹ Cuối</strong> ngay lập tức.
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition border border-slate-200"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(transaction.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
