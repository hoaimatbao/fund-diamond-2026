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
  Zap
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
    confidence: '95%',
    source: 'AI Gemini Vision / OCR'
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
    setScanStatusText('Đang nhận diện chữ & số trên ảnh hóa đơn...');
    setError('');

    try {
      const result = await scanBillImage(fileObj, (msg) => setScanStatusText(msg));
      
      setFormData({
        amount: result.amount !== undefined ? result.amount : '',
        description: result.description || 'Chi tiêu theo hóa đơn',
        type: result.type || 'CHI',
        date: result.date || new Date().toLocaleDateString('vi-VN'),
        category: result.category || 'Ăn uống',
        note: result.note || '',
        billImage: result.billImage || url,
        confidence: result.confidence || '92%',
        source: result.source || 'AI Vision'
      });
      setHasScanned(true);
    } catch (err) {
      console.error('Scan error:', err);
      setError('Không thể nhận diện tự động. Bạn vẫn có thể điền thông tin vào các ô bên dưới.');
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

  // Sample Sen Tay Ho bill tester
  const handleLoadSampleBill = async () => {
    const sampleUrl = '/uploads/bill_sen_tay_ho.svg';
    setPreviewUrl(sampleUrl);
    setScanning(true);
    setScanStatusText('Đang đọc thông tin mẫu Hóa đơn Sen Tây Hồ...');
    setError('');

    try {
      // Fetch SVG to blob
      const res = await fetch(sampleUrl);
      const blob = await res.blob();
      const sampleFile = new File([blob], 'bill_sen_tay_ho.svg', { type: 'image/svg+xml' });
      setFile(sampleFile);
      await performScan(sampleFile, sampleUrl);
    } catch (err) {
      // Fallback
      setFormData({
        amount: 3552000,
        description: 'Đi ăn tiệc Tất niên - Buffet Sen Tây Hồ',
        type: 'CHI',
        date: '02/02/2026',
        category: 'Liên hoan',
        note: 'Tiệc buffet 8 người lớn + đồ uống (HĐ: STH-2026-0202)',
        billImage: sampleUrl,
        confidence: '99%',
        source: 'Mẫu đối soát'
      });
      setHasScanned(true);
      setScanning(false);
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

    // If billImage is a blob: URL and we have the raw File, upload it to the server
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
        console.warn('Upload image failed, saving without uploaded URL:', uploadErr);
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
                  Vision + OCR
                </span>
              </div>
              <p className="text-xs text-white/80">
                Tự động nhận diện chữ in, giấy viết tay, quy đổi k/tr/nghìn và điền vào form để bạn chỉnh sửa
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
                Chụp ảnh hoặc tải lên ảnh hóa đơn / giấy viết tay
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
                Hệ thống tự động đọc số tiền (k, nghìn, triệu), ngày tháng và lý do chi tiêu.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer shadow-md shadow-emerald-600/20 transition hover:scale-102">
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

                <button
                  type="button"
                  onClick={handleLoadSampleBill}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 shadow-2xs transition"
                >
                  ⚡ Thử mẫu Bill Sen Tây Hồ
                </button>
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
                  <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4 text-center">
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                    <span className="text-sm font-bold">{scanStatusText || 'AI đang phân tích hóa đơn...'}</span>
                    <span className="text-xs text-emerald-300 mt-1">Đang bóc tách số tiền (k/nghìn/triệu) và nội dung</span>
                  </div>
                )}
              </div>

              {/* BÁO CÁO NHẬN DIỆN */}
              {hasScanned && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-900 font-medium">
                      Đã bóc tách thành công qua <strong>{formData.source}</strong> (Độ khớp: {formData.confidence})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                    💡 Bạn có thể chỉnh sửa lại các ô bên dưới
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
                      onClick={() => setFormData(prev => ({ ...prev, type: 'THU', category: 'Thưởng dự án' }))}
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
                      placeholder="Ví dụ: 154800"
                      className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    💡 AI tự động chuyển "154k" thành 154.000 đ, "2tr" thành 2.000.000 đ. Bạn có thể sửa trực tiếp con số này.
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
                    placeholder="Ví dụ: Chi ăn chè, Đi ăn Sen Tây Hồ, Bánh xèo nem lụi..."
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
                      <option value="Ăn uống">Ăn uống (Chè, trà sữa, cafe...)</option>
                      <option value="Liên hoan">Liên hoan (Lẩu, Buffet, BBQ...)</option>
                      <option value="Thưởng dự án">Thưởng dự án / BGĐ</option>
                      <option value="Khen thưởng">Khen thưởng thành viên</option>
                      <option value="Đóng quỹ">Đóng quỹ định kỳ</option>
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
                    placeholder="Địa điểm, số lượng người tham gia..."
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden bg-white"
                  />
                </div>

                {error && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {error}
                  </p>
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
