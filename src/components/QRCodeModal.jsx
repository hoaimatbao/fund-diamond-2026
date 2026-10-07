import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Download, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

export const MEMBER_QR_LIST = [
  {
    id: 'hoai',
    name: 'Hoài',
    fullName: 'HOÀNG THỊ HOÀI',
    role: 'Thủ quỹ nhận đóng quỹ',
    isTreasurer: true,
    bankName: 'BIDV',
    bankFullName: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    accountNumber: '2151853576',
    qrUrl: 'https://img.vietqr.io/image/BIDV-2151853576-compact2.jpg?accountName=HOANG%20THI%20HOAI'
  },
  {
    id: 'phuong',
    name: 'Phương',
    fullName: 'ĐẶNG LAN PHƯƠNG',
    role: 'Thành viên',
    isTreasurer: false,
    bankName: 'VPBank',
    bankFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    accountNumber: '174277389',
    qrUrl: 'https://img.vietqr.io/image/VPBANK-174277389-compact2.jpg?accountName=DANG%20LAN%20PHUONG'
  },
  {
    id: 'hang',
    name: 'Hằng',
    fullName: 'NGUYỄN THỊ HẰNG',
    role: 'Thành viên',
    isTreasurer: false,
    bankName: 'VPBank',
    bankFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    accountNumber: '0346340004',
    qrUrl: 'https://img.vietqr.io/image/VPBANK-0346340004-compact2.jpg?accountName=NGUYEN%20THI%20HANG'
  },
  {
    id: 'thanh',
    name: 'Thanh',
    fullName: 'TRẦN THỊ THANH',
    role: 'Thành viên',
    isTreasurer: false,
    bankName: 'VPBank',
    bankFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    accountNumber: '2096289688',
    qrUrl: 'https://img.vietqr.io/image/VPBANK-2096289688-compact2.jpg?accountName=TRAN%20THI%20THANH'
  },
  {
    id: 'ha',
    name: 'Hà',
    fullName: 'PHAM THI HA',
    role: 'Thành viên',
    isTreasurer: false,
    bankName: 'VPBank',
    bankFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    accountNumber: '0967183375',
    qrUrl: 'https://img.vietqr.io/image/VPBANK-0967183375-compact2.jpg?accountName=PHAM%20THI%20HA'
  },
  {
    id: 'tuyen',
    name: 'Tuyển',
    fullName: 'NGUYEN THI HONG TUYEN',
    role: 'Thành viên',
    isTreasurer: false,
    bankName: 'VPBank',
    bankFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    accountNumber: '0946785672',
    qrUrl: 'https://img.vietqr.io/image/VPBANK-0946785672-compact2.jpg?accountName=NGUYEN%20THI%20HONG%20TUYEN'
  }
];

export default function QRCodeModal({ isOpen, onClose, initialMemberId = 'hoai' }) {
  const [selectedId, setSelectedId] = useState(initialMemberId);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentMember = MEMBER_QR_LIST.find(m => m.id === selectedId) || MEMBER_QR_LIST[0];

  const handleCopyAccountNumber = () => {
    navigator.clipboard.writeText(currentMember.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <QrCode className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>Mã QR Chuyển Khoản</span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  VietQR 24/7
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Quét mã trực tiếp bằng app ngân hàng để nộp quỹ hoặc hoàn ứng
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Tab Buttons */}
        <div className="px-4 pt-3.5 pb-2 bg-slate-50/50 border-b border-slate-100">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Chọn thành viên để xem mã QR:
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
            {MEMBER_QR_LIST.map((member) => {
              const isSelected = member.id === selectedId;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer border shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-md shadow-emerald-700/25 ring-2 ring-emerald-600/30 scale-102 font-black'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xs">{member.name}</span>
                  {member.isTreasurer && (
                    <span className={`text-[9.5px] px-1 rounded-sm leading-tight ${
                      isSelected ? 'bg-amber-300 text-amber-950 font-extrabold' : 'bg-amber-100 text-amber-900'
                    }`}>
                      Thủ quỹ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body - QR Display */}
        <div className="p-4 sm:p-6 flex flex-col items-center">
          
          {/* Member Highlight Info Header */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold mb-1 border border-slate-200">
              {currentMember.isTreasurer ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-900 font-bold">Tài khoản Thủ Quỹ (Thu / Đóng Quỹ)</span>
                </>
              ) : (
                <span>Tài khoản cá nhân: <strong>{currentMember.name}</strong></span>
              )}
            </div>
            <h4 className="text-base sm:text-lg font-black text-slate-900">
              {currentMember.fullName}
            </h4>
          </div>

          {/* QR Code Frame */}
          <div className="relative p-2.5 sm:p-3 bg-white rounded-2xl border-2 border-emerald-500/30 shadow-xl max-w-[320px] w-full flex flex-col items-center group">
            <img 
              src={currentMember.qrUrl} 
              alt={`Mã QR VietQR chuyển khoản ${currentMember.name}`}
              className="w-full h-auto object-contain rounded-xl transition duration-200 group-hover:scale-[1.01]"
              loading="eager"
            />
            
            <div className="w-full mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-emerald-800">
                {currentMember.bankName}
              </span>
              <span className="font-mono text-slate-700 font-bold">
                {currentMember.accountNumber}
              </span>
            </div>
          </div>

          {/* Bank Details & Copy Action */}
          <div className="w-full max-w-[340px] mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ngân hàng:</span>
              <span className="font-bold text-slate-800">{currentMember.bankName} ({currentMember.bankFullName})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Số tài khoản:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900 text-sm">{currentMember.accountNumber}</span>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                  title="Sao chép số tài khoản"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Chủ tài khoản:</span>
              <span className="font-bold text-slate-800 font-mono">{currentMember.fullName}</span>
            </div>
          </div>

          {/* Quick Notice */}
          <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">
            Mở ứng dụng ngân hàng bất kỳ (App Mobile Banking) trên điện thoại và chọn tính năng <strong>Quét QR</strong> để thanh toán tức thì.
          </p>

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <a
            href={currentMember.qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 font-medium transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở ảnh VietQR gốc</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
