import React, { useState } from 'react';
import { Lock, KeyRound, X, AlertCircle, CheckCircle } from 'lucide-react';

export default function TreasurerAuthModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin) {
      setError('Vui lòng nhập mã PIN');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
        onClose();
        setPin('');
      } else {
        setError(data.message || 'Mã PIN không đúng (Mặc định: 123456)');
      }
    } catch (err) {
      // Offline fallback check for PIN 123456
      if (pin === '123456') {
        onSuccess();
        onClose();
        setPin('');
      } else {
        setError('Mã PIN không đúng (Mặc định: 123456)');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Xác Thực Thủ Quỹ
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Nhập mã PIN thủ quỹ để kích hoạt quyền nhập quỹ, sửa hoặc xóa giao dịch.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Mã PIN bảo vệ:</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Nhập 6 số PIN (123456)"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Mã PIN mặc định: <span className="font-mono font-semibold text-emerald-600">123456</span>
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Đang kiểm tra...' : 'Mở khóa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
