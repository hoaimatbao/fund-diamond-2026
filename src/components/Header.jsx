import React from 'react';
import { Gem, ShieldCheck, FileSpreadsheet, PlusCircle, ScanLine, RefreshCw, LayoutDashboard, QrCode } from 'lucide-react';

export default function Header({
  currentView = 'public',
  onToggleView,
  onOpenManualEntry,
  onOpenScanner,
  onOpenQRModal,
  onExportExcel,
  onRefresh,
  loading
}) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Brand Info */}
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
                <Gem className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-800 bg-clip-text text-transparent">
                  Smart Fund Team Diamond
                </h1>
                {currentView === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <ShieldCheck className="w-3 h-3 text-amber-700" />
                    Quản trị
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Bảng Quản Lý Quỹ Nội Bộ Minh Bạch & Tự Động Hóa
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              title="Làm mới dữ liệu"
              disabled={loading}
              className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Mã QR Chuyển Khoản Button */}
            <button
              onClick={onOpenQRModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-2xs transition hover:border-slate-400 cursor-pointer"
              title="Xem ảnh mã QR chuyển khoản ngân hàng của 6 thành viên"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Mã QR Chuyển Khoản</span>
            </button>

            {/* Export CSV / Excel */}
            <button
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-2xs transition hover:border-slate-400"
              title="Xuất bảng tính Excel và lưu vào thư mục Quỹ Team"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            {/* AI Scan Bill Button */}
            <button
              onClick={onOpenScanner}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg shadow-sm shadow-emerald-600/30 transition hover:shadow-md"
            >
              <ScanLine className="w-4 h-4" />
              <span>Quét Bill AI</span>
            </button>

            {/* Manual Entry Button */}
            <button
              onClick={onOpenManualEntry}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Nhập Thu - Chi</span>
            </button>

            {/* Chế độ Thủ Quỹ Button (Direct Toggle - No PIN required) */}
            {currentView === 'public' ? (
              <button
                onClick={() => onToggleView('admin')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-500 rounded-lg border border-amber-400 shadow-sm shadow-amber-500/20 transition hover:scale-102"
                title="Bấm để vào ngay trang Quản Trị Thủ Quỹ (không cần mật khẩu)"
              >
                <ShieldCheck className="w-4 h-4 text-amber-950" />
                <span>Chế độ Thủ Quỹ</span>
              </button>
            ) : (
              <button
                onClick={() => onToggleView('public')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-2xs transition hover:border-slate-400"
                title="Quay lại Bảng Quỹ Công Khai"
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                <span>Bảng Công Khai</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
