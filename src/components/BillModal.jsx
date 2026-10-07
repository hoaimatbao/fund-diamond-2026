import React from 'react';
import { X, Receipt, Download, Calendar, Tag, CheckCircle, ExternalLink } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function BillModal({ transaction, onClose }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">
                Chứng Từ Giao Dịch #{transaction.id}
              </h3>
              <p className="text-xs text-slate-500">
                Đối soát hóa đơn & chứng từ chi tiêu Team Diamond
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Transaction Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400 block text-[11px]">Ngày giao dịch</span>
              <span className="font-semibold text-slate-700 font-mono">{transaction.date}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Loại khoản</span>
              <span className={`font-bold ${transaction.type === 'THU' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {transaction.type === 'THU' ? 'THU (+)' : 'CHI (-)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Số tiền</span>
              <span className="font-extrabold text-slate-900 font-mono">
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Người lập</span>
              <span className="font-medium text-slate-700">{transaction.recordedBy || 'Thủ quỹ'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Diễn giải nội dung:
            </span>
            <p className="text-slate-800 font-medium bg-emerald-50/40 p-3 rounded-lg border border-emerald-100 text-sm">
              {transaction.description}
            </p>
            {transaction.note && (
              <p className="text-xs text-slate-500 mt-1 italic">
                Ghi chú: {transaction.note}
              </p>
            )}
          </div>

          {/* Bill Receipt Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Hình ảnh hóa đơn / Biên lai:
              </span>
              {transaction.billImage && (
                <a
                  href={transaction.billImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở ảnh gốc
                </a>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center p-2 min-h-[300px] max-h-[480px]">
              {transaction.billImage ? (
                <img
                  src={transaction.billImage}
                  alt="Hóa đơn thanh toán"
                  className="max-h-[460px] w-auto object-contain rounded-lg shadow-sm"
                />
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Khoản này không có ảnh hóa đơn đính kèm</p>
                  <p className="text-xs text-slate-400 mt-0.5">(Chi tiêu vãng lai hoặc chuyển khoản trực tiếp)</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
