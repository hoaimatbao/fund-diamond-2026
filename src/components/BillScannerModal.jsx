import React, { useState, useRef } from 'react';
import { 
  X, 
  ScanLine, 
  UploadCloud, 
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
  AlertCircle,
  Check,
  ImageIcon,
  RotateCcw,
  Key
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { scanBillImage, getGeminiApiKey, saveGeminiApiKey } from '../utils/ocrScanner';

const FUND_MEMBERS = ['Hoài', 'Thanh', 'Hằng', 'Tuyển', 'Phương', 'Hà'];

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Tự động nhận diện tên thành viên từ nội dung biên lai hoặc tên người gửi/nhận
 */
function detectMemberFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const memberKeywords = [
    { name: 'Hoài', patterns: ['hoang thi hoai', 'hoangthihoai', 'huyen hoai', 'huyenhoai', 'hoai ht', 'hoaiht', 'hoai'] },
    { name: 'Thanh', patterns: ['tran thi thanh', 'tranthithanh', 'thanh'] },
    { name: 'Hằng', patterns: ['nguyen thi hang', 'nguyenthihang', 'hang'] },
    { name: 'Tuyển', patterns: ['nguyen thi hong tuyen', 'nguyenthihongtuyen', 'hong tuyen', 'hongtuyen', 'tuyen'] },
    { name: 'Phương', patterns: ['dang lan phuong', 'danglanphuong', 'lan phuong', 'lanphuong', 'phuong'] },
    { name: 'Hà', patterns: ['pham thi ha', 'phamthiha', 'thi ha', 'thiha', 'ha'] }
  ];

  for (const m of memberKeywords) {
    for (const pat of m.patterns) {
      const regex = new RegExp(`(^|[^a-z0-9])${pat}([^a-z0-9]|$)`, 'i');
      if (regex.test(normalized)) {
        return m.name;
      }
    }
  }
  return null;
}

export default function BillScannerModal({ isOpen, onClose, onSaveScan }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Gemini API Key quick config state
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey() || '');
  const [keyNotice, setKeyNotice] = useState('');

  // Editable form state after scan
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'CHI',
    date: new Date().toLocaleDateString('vi-VN'),
    category: 'Ăn uống (Chè, trà sữa, cafe...)',
    submittedBy: 'Thủ quỹ',
    note: '',
    billImage: '',
    confidence: '99%',
    source: 'Gemini 1.5 Flash',
    compressionStats: null
  });

  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSaveApiKey = (keyToSave) => {
    saveGeminiApiKey(keyToSave);
    setKeyNotice('Đã lưu API Key thành công!');
    setTimeout(() => setKeyNotice(''), 3000);
    setError('');
    if (file && previewUrl) {
      performScan(file, previewUrl);
    }
  };

  const handleToggleMember = (member) => {
    setFormData(prev => ({
      ...prev,
      submittedBy: prev.submittedBy === member ? 'Thủ quỹ' : member
    }));
  };

  const handleProcessFile = async (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type || !selectedFile.type.startsWith('image/')) {
      setError('Vui lòng chỉ tải lên file ảnh hợp lệ (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setHasScanned(false);
    setError('');
    await performScan(selectedFile, url);
  };

  const handleFileInputChange = async (e) => {
    const selected = e.target?.files?.[0];
    if (selected) {
      await handleProcessFile(selected);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await handleProcessFile(droppedFiles[0]);
    }
  };

  const performScan = async (fileObj, url) => {
    if (!fileObj) {
      setError('Vui lòng chọn file ảnh hóa đơn hợp lệ.');
      return;
    }
    setScanning(true);
    setScanStatusText('Đang nén ảnh bằng HTML5 Canvas và gửi sang Gemini 1.5 Flash...');
    setError('');

    try {
      const result = await scanBillImage(fileObj, (msg) => setScanStatusText(msg));
      
      // 1. Phân loại loại giao dịch: 'thu' -> 'THU', 'chi' -> 'CHI'
      const isThu = String(result.type || '').trim().toLowerCase() === 'thu';
      const resolvedType = isThu ? 'THU' : 'CHI';

      // 2. Người thực hiện: map chính xác với danh sách 6 thành viên quỹ [Hoài, Thanh, Hằng, Tuyển, Phương, Hà]
      let chosenMember = 'Thủ quỹ';
      if (result.member && FUND_MEMBERS.includes(result.member)) {
        chosenMember = result.member;
      } else if (result.member && result.member !== 'Thủ quỹ') {
        const detected = detectMemberFromText(`${result.member} ${result.note || ''}`);
        chosenMember = detected || 'Thủ quỹ';
      } else {
        const detected = detectMemberFromText(result.note || '');
        chosenMember = detected || 'Thủ quỹ';
      }

      // 3. Danh mục
      let matchedCategory = result.category;
      if (!matchedCategory) {
        matchedCategory = isThu ? 'Đóng quỹ & Thưởng dự án' : 'Ăn uống (Chè, trà sữa, cafe...)';
      }

      // 4. Nội dung / Ghi chú (Lấy nguyên văn phần note từ AI)
      const transactionNote = result.note || result.description || 'Giao dịch theo biên lai';

      // Tự động điền dữ liệu JSON vào các ô input trên modal form
      setFormData({
        amount: result.amount !== undefined ? result.amount : '',
        description: transactionNote,
        type: resolvedType,
        date: result.date || new Date().toLocaleDateString('vi-VN'),
        category: matchedCategory,
        submittedBy: chosenMember,
        note: transactionNote,
        billImage: result.billImage || url,
        compressedBlob: result.compressedBlob || null,
        confidence: result.confidence || '99%',
        source: result.source || 'Gemini 1.5 Flash',
        compressionStats: result.compressionStats || null
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

    // If billImage is a blob: URL and we have the File or compressed blob, upload to server
    const fileToUpload = formData.compressedBlob || file;
    if (fileToUpload && finalBillImage && finalBillImage.startsWith('blob:')) {
      try {
        const uploadData = new FormData();
        uploadData.append('bill', fileToUpload, file?.name || 'bill.jpg');
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

    const author = formData.submittedBy || 'Thủ quỹ';
    const isMemberExpense = formData.type === 'CHI' && author !== 'Thủ quỹ';

    onSaveScan({
      amount: num,
      description: formData.description.trim(),
      type: formData.type,
      date: formData.date || new Date().toLocaleDateString('vi-VN'),
      category: formData.category,
      submittedBy: author,
      recordedBy: author,
      reimbursementStatus: isMemberExpense ? 'PENDING' : 'REIMBURSED',
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
    setIsDragging(false);
    setError('');
    setFormData({
      amount: '',
      description: '',
      type: 'CHI',
      date: new Date().toLocaleDateString('vi-VN'),
      category: 'Ăn uống',
      submittedBy: 'Thủ quỹ',
      note: '',
      billImage: '',
      confidence: '99%',
      source: 'Gemini 1.5 Flash',
      compressionStats: null
    });
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
                Tự động nén Canvas 1200px - 1400px & bóc tách JSON mode: Số tiền, Ngày tháng, Nội dung, Thu - Chi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)} 
              className={`text-xs px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                showKeyConfig 
                  ? 'bg-white text-emerald-800 border-white shadow-xs font-bold' 
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
              }`}
              title="Cấu hình Google Gemini API Key"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cấu hình Key</span>
            </button>
            <button 
              onClick={handleClose} 
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Key Configuration Collapsible Panel */}
          {showKeyConfig && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5 border border-slate-800 shadow-md animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                  <Key className="w-3.5 h-3.5" /> Cấu hình Google Gemini API Key:
                </span>
                <span className="text-[10px] text-slate-400">Lưu trực tiếp trên LocalStorage</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Nhập Google Gemini API Key (AIzaSy...)"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveApiKey(apiKeyInput.trim())}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Lưu Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput('');
                    handleSaveApiKey('');
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700"
                  title="Dùng key mặc định từ file .env"
                >
                  Mặc định
                </button>
              </div>
              {keyNotice && (
                <p className="text-[11px] text-emerald-400 font-medium">{keyNotice}</p>
              )}
            </div>
          )}

          {/* Top Error Alert if !previewUrl */}
          {!previewUrl && error && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5 text-rose-900">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <strong className="block font-bold text-rose-900 text-sm">
                    Thông báo lỗi:
                  </strong>
                  <p className="font-mono text-[11px] text-rose-700 bg-white/90 p-2.5 rounded-lg border border-rose-200 mt-1 break-words leading-relaxed select-all">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD ZONE (DRAG & DROP + FILE PICKER - NO CAMERA) */}
          {!previewUrl ? (
            <div 
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 sm:p-10 text-center transition-all duration-200 cursor-pointer group ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01] shadow-lg shadow-emerald-500/10' 
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/25'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3.5 transition-transform shadow-xs border ${
                isDragging
                  ? 'bg-emerald-600 text-white scale-110 border-emerald-600'
                  : 'bg-white text-emerald-600 border-slate-200 group-hover:scale-105'
              }`}>
                <UploadCloud className="w-8 h-8" />
              </div>

              <h4 className="text-base sm:text-lg font-bold text-slate-800 mb-1.5">
                {isDragging ? 'Thả file ảnh vào đây để quét ngay' : 'Tải lên ảnh hóa đơn / biên lai thanh toán'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                Kéo & thả file ảnh vào đây hoặc bấm để chọn tệp từ thiết bị.
                <br />
                <span className="text-[11px] text-slate-400">
                  Hỗ trợ PNG, JPG, JPEG. Tự động nén Canvas (1200px - 1400px, 80%) giảm còn ~150KB - 300KB siêu nét.
                </span>
              </p>

              <div className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/25 transition-all group-hover:scale-102">
                <Upload className="w-4 h-4" />
                <span>Bấm chọn tệp ảnh</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* IMAGE PREVIEW & COMPRESSION STATS */}
              <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/5 p-3 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0 flex items-center justify-center bg-white rounded-xl border border-slate-200 p-1 shadow-xs max-h-44 max-w-xs overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Bill Preview"
                    className="max-h-40 w-auto object-contain rounded-lg"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-2 text-left w-full">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                      {file?.name || 'Hóa đơn / Biên lai đã tải'}
                    </p>
                    {formData.compressionStats && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ⚡ Đã nén Canvas: {formatFileSize(formData.compressionStats.compressedSize)} (-{formData.compressionStats.compressionRatio}%)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Gốc: {formatFileSize(formData.compressionStats.originalSize)} • Kích thước: {formData.compressionStats.width}×{formData.compressionStats.height}px
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 shadow-2xs transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đổi ảnh khác</span>
                    </button>

                    <button
                      type="button"
                      disabled={scanning}
                      onClick={() => performScan(file, previewUrl)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                      <span>Quét lại AI</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {/* Scanning Overlay */}
                {scanning && (
                  <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4 text-center z-10">
                    <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin mb-2" />
                    <span className="text-sm font-bold">{scanStatusText || 'Gemini 1.5 Flash đang bóc tách...'}</span>
                    <span className="text-xs text-emerald-300 mt-1">Đang trích xuất số tiền, ngày giao dịch và nội dung theo JSON mode</span>
                  </div>
                )}
              </div>

              {/* BÁO CÁO NHẬN DIỆN */}
              {hasScanned && !error && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-900 font-medium">
                      Đã bóc tách thành công qua <strong>{formData.source} (JSON Mode)</strong> (Độ khớp: {formData.confidence})
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
                      onClick={() => setFormData(prev => ({ ...prev, type: 'THU', category: 'Đóng quỹ & Thưởng dự án' }))}
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
                      onClick={() => setFormData(prev => ({ ...prev, type: 'CHI', category: 'Ăn uống (Chè, trà sữa, cafe...)' }))}
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

                {/* 2. Người thực hiện / Thành viên nhập quỹ (Ngay trên ô Số tiền) */}
                <div className="space-y-1.5 pt-1 pb-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                  
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {/* Nút Mặc định: Thủ quỹ */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, submittedBy: 'Thủ quỹ' }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs ${
                        formData.submittedBy === 'Thủ quỹ'
                          ? 'bg-slate-800 text-white shadow-md shadow-slate-800/25 ring-2 ring-slate-700/30 font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200/90 hover:text-slate-900 border border-slate-200'
                      }`}
                      title="Quỹ chung do Thủ quỹ trực tiếp chi/thu"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Mặc định: Thủ quỹ</span>
                    </button>

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
                  <p className="text-[11px] text-slate-400">
                    💡 AI tự động nhận diện tên thành viên từ nội dung ck hoặc bấm chọn nhanh để ghi nhận hoàn tiền.
                  </p>
                </div>

                {/* 3. Số tiền & Preview */}
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
                    💡 Gemini 1.5 Flash nhận diện chính xác số tiền thanh toán thực tế, bóc tách JSON mode siêu nhanh.
                  </p>
                </div>

                {/* 4. Lý do / Nội dung */}
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

                {/* 5. Ngày & Danh mục */}
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
                      <option value="Ăn uống (Chè, trà sữa, cafe...)">Ăn uống (Chè, trà sữa, cafe...)</option>
                      <option value="Đóng quỹ & Thưởng dự án">Đóng quỹ & Thưởng dự án</option>
                      <option value="Chi tiêu khác">Chi tiêu khác</option>
                      <option value="Đóng quỹ">Đóng quỹ định kỳ</option>
                      <option value="Ăn uống">Ăn uống</option>
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

                {/* 6. Ghi chú */}
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
                  <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-2.5 animate-in fade-in">
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

                    {/* Quick API Key Input if key error */}
                    {(error.toLowerCase().includes('key') || error.toLowerCase().includes('quota') || error.toLowerCase().includes('kết nối')) && (
                      <div className="pt-2 pb-1 border-t border-rose-200/80">
                        <label className="block text-[11px] font-bold text-rose-900 mb-1">
                          🔑 Cập nhật Gemini API Key nhanh:
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="Dán Gemini API Key mới vào đây..."
                            className="flex-1 px-2.5 py-1 text-xs border border-rose-300 rounded-lg bg-white text-slate-800 font-mono outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveApiKey(apiKeyInput.trim())}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap"
                          >
                            Lưu & Quét Lại
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-rose-200/70">
                      <span className="text-[11px] text-rose-700 font-medium">
                        💡 Bạn có thể kiểm tra API Key hoặc tự điền số tiền ở các ô trên.
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
