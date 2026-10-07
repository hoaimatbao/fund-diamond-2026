import React, { useState } from 'react';
import { 
  X, 
  ScanLine, 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  DollarSign, 
  FileText, 
  Tag, 
  RefreshCw,
  Zap,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { scanBillImage } from '../utils/ocrScanner';

export default function BillScannerModal({ isOpen, onClose, onSaveScan }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');

  // Editable form state after scan
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'CHI',
    date: new Date().toLocaleDateString('vi-VN'),
    category: 'Ăn uống',
    note: '',
    billImage: '',
    confidence: '99%',
    source: 'Gemini 1.5 Flash'
  });

  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      setHasScanned(false);
      setError('');
      // Auto start scan on file select
      await performScan(selected, url);
    }
  };

  const performScan = async (fileObj, url) => {
    setScanning(true);
    setScanStatusText('Đang gửi ảnh sang Gemini 1.5 Flash bóc tách thông tin...');
    setError('');

    try {
      const result = await scanBillImage(fileObj, (msg) => setScanStatusText(msg));
      
      setFormData({
        amount: result.amount !== undefined ? result.amount : '',
        description: result.description || 'Giao dịch theo biên lai',
        type: result.type || 'CHI',
        date: result.date || new Date().toLocaleDateString('vi-VN'),
        category: result.category || 'Đóng quỹ',
        note: result.note || (result.payerOrReceiver ? `Người nhận: ${result.payerOrReceiver}` : ''),
        billImage: result.billImage || url,
        confidence: result.confidence || '99%',
        source: result.source || 'Gemini 1.5 Flash'
      });
      setHasScanned(true);
    } catch (err) {
      console.error('Scan error from Gemini:', err);
      const detailedMessage = err.message || 'Lỗi không xác định khi gọi Google Gemini API';
      setError(detailedMessage);
      setFormData(prev => ({
        ...prev,
        billImage: url
      }));
      setHasScanned(true);
    } finally {
      setScanning(false);
      setScanStatusText('');
    }
  };

  const handleConfirmAndSave = async (e) => {
    e.preventDefault();
    const num = Number(formData.amount);
    if (!num || num <= 0) {
      setError('Vui lòng kiểm tra và nhập số tiền hợp lệ (> 0)');
      return;
    }
    if (!formData.description.trim()) {
      setError('Vui lòng nhập lý do / nội dung khoản chi');
      return;
    }

    let finalBillImage = formData.billImage || previewUrl || null;

    // If billImage is a blob: URL and we have the raw File, try upload to server if backend is active
    if (file && finalBillImage && finalBillImage.startsWith('blob:')) {
      try {
        const uploadData = new FormData();
        uploadData.append('bill', file);
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadData
        });
        if (upRes.ok) {
          const upJson = await upRes.json();
          if (upJson.url) {
            finalBillImage = upJson.url;
          }
        }
      } catch (uploadErr) {
        console.warn('Upload image failed, saving with local preview:', uploadErr);
      }
    }

    onSaveScan({
      amount: num,
      description: formData.description.trim(),
      type: formData.type,
      date: formData.date || new Date().toLocaleDateString('vi-VN'),
      category: formData.category,
      note: formData.note,
      billImage: finalBillImage
    });

    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl('');
    setHasScanned(false);
    setScanning(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs shadow-inner">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  AI Quét Bill & Hóa Đơn Thông Minh
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 uppercase tracking-wider">
                  Gemini 1.5 Flash
                </span>
              </div>
              <p className="text-xs text-white/80">
                Tự động bóc tách số tiền, ngày giờ, nội dung giao dịch ngân hàng & hóa đơn ăn uống
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* UPLOAD / CAMERA ZONE */}
          {!previewUrl ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/60 hover:bg-emerald-50/20 transition group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs border border-slate-200 group-hover:scale-105 transition-transform text-emerald-600">
                <Camera className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                Chụp ảnh hoặc tải lên ảnh biên lai / hóa đơn
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                Hệ thống tự động sử dụng AI Gemini 1.5 Flash để nhận diện biên lai chuyển khoản ngân hàng, hóa đơn ăn uống, bóc tách chính xác số tiền và nội dung.
              </p>

              {/* Nút Chọn ảnh duy nhất, căn giữa tuyệt đối */}
              <div className="flex items-center justify-center">
                <label className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-600/25 transition-all hover:scale-105 active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>Chọn ảnh từ máy / Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* IMAGE PREVIEW & SCAN STATUS */}
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900/5 max-h-44 flex items-center justify-center p-2 group">
                <img
                  src={previewUrl}
                  alt="Bill Preview"
                  className="max-h-40 w-auto object-contain rounded shadow-xs"
                />

                {/* Change photo button */}
                <label className="absolute top-2 right-2 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold shadow-md cursor-pointer border border-slate-200 flex items-center gap-1 transition">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đổi ảnh khác</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Scanning Overlay */}
                {scanning && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4 text-center">
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                    <span className="text-sm font-bold">{scanStatusText || 'Gemini AI đang phân tích ảnh...'}</span>
                    <span className="text-xs text-emerald-300 mt-1">Đang bóc tách số tiền chuyển khoản, ngày và người nhận</span>
                  </div>
                )}
              </div>

              {/* BÁO CÁO NHẬN DIỆN */}
              {hasScanned && !error && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-900 font-medium">
                      Đã bóc tách thành công qua <strong>{formData.source}</strong> (Độ khớp: {formData.confidence})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                    💡 Bạn có thể kiểm tra lại các ô bên dưới nếu cần
                  </span>
                </div>
              )}

              {/* FORM CHỈNH SỬA THÔNG TIN BÓC TÁCH (INPUT FIELDS) */}
              <form onSubmit={handleConfirmAndSave} className="space-y-4 pt-1">
                
                {/* 1. Toggle THU / CHI */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Phân loại giao dịch (Bấm để đổi):
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: 'THU', category: 'Đóng quỹ' }))}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition ${
                        formData.type === 'THU'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-101'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>KHOẢN THU (+)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: 'CHI', category: 'Ăn uống' }))}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition ${
                        formData.type === 'CHI'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 scale-101'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" />
                      <span>KHOẢN CHI (-)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Số tiền & Preview */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Số tiền bóc tách (VNĐ) * :
                    </label>
                    {formData.amount && (
                      <span className="text-xs font-bold text-emerald-600 font-mono">
                        {formatCurrency(formData.amount)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₫</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Ví dụ: 430000"
                      className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    💡 Gemini AI Vision nhận diện chính xác số tiền lớn sau chữ "Thành công" hoặc trước ký hiệu "đ".
                  </p>
                </div>

                {/* 3. Lý do / Nội dung */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nội dung / Lý do * :
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ví dụ: Team Diamond ck quy NB T102026, Chi ăn chè..."
                    className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white shadow-2xs text-slate-800"
                  />
                </div>

                {/* 4. Ngày & Danh mục */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Ngày giao dịch (DD/MM/YYYY):
                    </label>
                    <input
                      type="text"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Phân loại danh mục:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white shadow-2xs font-medium text-slate-800"
                    >
                      <option value="Đóng quỹ">Đóng quỹ định kỳ</option>
                      <option value="Ăn uống">Ăn uống (Chè, trà sữa, cafe...)</option>
                      <option value="Liên hoan">Liên hoan (Lẩu, Buffet, BBQ...)</option>
                      <option value="Thưởng dự án">Thưởng dự án / BGĐ</option>
                      <option value="Khen thưởng">Khen thưởng thành viên</option>
                      <option value="Quỹ ban đầu">Quỹ ban đầu</option>
                      <option value="Sinh nhật">Sinh nhật</option>
                      <option value="Teambuilding">Teambuilding</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                {/* 5. Ghi chú */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ghi chú chi tiết:
                  </label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Người nhận, ngân hàng hoặc ghi chú thêm..."
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white"
                  />
                </div>

                {/* Thông báo lỗi nếu có */}
                {error && (
                  <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-start gap-2.5 text-rose-900">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <strong className="block font-bold text-rose-900 text-sm">
                          Thông báo lỗi từ Google Gemini:
                        </strong>
                        <p className="font-mono text-[11px] text-rose-700 bg-white/90 p-2.5 rounded-lg border border-rose-200 mt-1 break-words leading-relaxed select-all">
                          {error}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-rose-200/70">
                      <span className="text-[11px] text-rose-700 font-medium">
                        💡 Nếu gặp lỗi API Key, vui lòng liên hệ Thủ quỹ cập nhật key vào hệ thống.
                      </span>
                      {file && (
                        <button
                          type="button"
                          onClick={() => performScan(file, previewUrl)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Thử quét lại</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/30 transition hover:scale-102"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác Nhận & Lưu Vào Quỹ</span>
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
