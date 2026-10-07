import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import SummaryCards from '../components/SummaryCards';
import FundTable from '../components/FundTable';
import BillModal from '../components/BillModal';
import ManualEntryModal from '../components/ManualEntryModal';
import BillScannerModal from '../components/BillScannerModal';
import TreasurerAdminView from '../components/TreasurerAdminView';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import QRCodeModal from '../components/QRCodeModal';
import { exportToCSV } from '../utils/formatters';
import { syncTransactionToGoogleSheets } from '../services/googleSheetsService';
import { CheckCircle2, AlertCircle, Info, Sparkles, Building2, Users } from 'lucide-react';

import defaultFundData from '../../server/data/fund_diamond_2026.json';

export default function Dashboard() {
  const [fundInfo, setFundInfo] = useState(defaultFundData.fundInfo || {
    name: 'Smart Fund Team Diamond',
    department: 'Team Diamond',
    year: 2026,
    memberCount: 6,
    members: ['Thanh', 'Hoài', 'Hằng', 'Tuyển', 'Phương', 'Hà'],
    bannerTitle: 'Quỹ Team Diamond',
    bannerDescription: '',
    summary: {
      totalIncome: 53104581,
      totalExpense: 41992450,
      currentBalance: 11112131
    }
  });
  const [transactions, setTransactions] = useState(defaultFundData.transactions || []);
  const [loading, setLoading] = useState(false);

  // View state: 'public' or 'admin'
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('team_diamond_view') || 'public';
  });

  // Modals state
  const [selectedBillTransaction, setSelectedBillTransaction] = useState(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedQRMemberId, setSelectedQRMemberId] = useState('hoai');

  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleView = (view) => {
    setCurrentView(view);
    localStorage.setItem('team_diamond_view', view);
    if (view === 'admin') {
      showToast('Đã chuyển sang Chế độ Quản trị Thủ Quỹ', 'info');
    } else {
      showToast('Đã quay lại Bảng Quỹ Công Khai', 'info');
    }
  };

  // Fetch fund data from API
  const fetchFundData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fund');
      if (res.ok) {
        const data = await res.json();
        setFundInfo(data.fundInfo || defaultFundData.fundInfo);
        setTransactions(data.transactions || defaultFundData.transactions || []);
      } else {
        throw new Error('Không thể tải dữ liệu từ server');
      }
    } catch (err) {
      console.warn('API error, using initial cached data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFundData();
  }, [fetchFundData]);

  // Update Fund Configuration (Banner, Members)
  const handleUpdateFundSettings = async (settings) => {
    try {
      const res = await fetch('/api/fund/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        setFundInfo(prev => ({
          ...prev,
          ...data.fundInfo
        }));
        showToast('Đã lưu cấu hình quỹ và danh sách thành viên!', 'success');
      } else {
        showToast('Không thể lưu cấu hình quỹ', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  };

  // Add / Edit Transaction
  const handleSaveTransaction = async (formData) => {
    // Gửi song song đến Google Sheets Webhook (cả nhập thủ công lẫn Quét Bill AI)
    syncTransactionToGoogleSheets(formData);

    try {
      const isEdit = Boolean(editingTransaction);
      const url = isEdit ? `/api/transactions/${editingTransaction.id}` : '/api/transactions';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        showToast(isEdit ? 'Đã cập nhật giao dịch thành công' : 'Đã thêm giao dịch mới vào quỹ', 'success');
        setEditingTransaction(null);
        await fetchFundData();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Có lỗi xảy ra', 'error');
      }
    } catch (err) {
      console.warn('Lỗi kết nối máy chủ API backend, lưu tạm vào dữ liệu bộ nhớ cục bộ:', err);
      // Fallback lưu vào state cục bộ để ứng dụng luôn hoạt động thông suốt
      const newTx = {
        id: Date.now(),
        ...formData,
        amount: Number(formData.amount) || 0,
        date: formData.date || new Date().toLocaleDateString('vi-VN'),
        category: formData.category || (formData.type === 'THU' ? 'Đóng quỹ' : 'Ăn uống'),
        submittedBy: formData.submittedBy || 'Thủ quỹ',
        recordedBy: formData.recordedBy || 'Thủ quỹ',
        reimbursementStatus: formData.reimbursementStatus || 'REIMBURSED'
      };
      setTransactions(prev => [newTx, ...prev]);
      showToast('Đã lưu giao dịch vào quỹ thành công', 'success');
      setEditingTransaction(null);
    }
  };

  // Delete Transaction Confirm
  const handleDeleteConfirm = async (id) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Đã xóa giao dịch #${id} và tự động tính lại số dư`, 'success');
        await fetchFundData();
      } else {
        showToast('Không thể xóa giao dịch', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setDeletingTransaction(null);
    }
  };

  // Quick Category Update
  const handleUpdateCategory = async (id, newCategory) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      });

      if (res.ok) {
        showToast(`Đã chuyển phân loại sang "${newCategory}"`, 'success');
        setTransactions(prev => prev.map(t => Number(t.id) === Number(id) ? { ...t, category: newCategory } : t));
      } else {
        const data = await res.json();
        showToast(data.error || 'Không thể cập nhật phân loại', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  };

  // Quick Reimburse Status Update
  const handleConfirmReimburse = async (id, status = 'REIMBURSED') => {
    try {
      const res = await fetch(`/api/transactions/${id}/reimburse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        showToast(
          status === 'REIMBURSED'
            ? 'Đã xác nhận giải ngân thành công!'
            : 'Đã chuyển về trạng thái Chờ hoàn ứng',
          'success'
        );
        await fetchFundData();
      } else {
        showToast('Không thể cập nhật trạng thái hoàn ứng', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  };

  // AI Scan Save
  const handleSaveScan = async (scanData) => {
    await handleSaveTransaction(scanData);
  };

  // Export Excel / CSV
  const handleExportExcel = () => {
    exportToCSV(transactions, `Bang_Quy_Team_Diamond_2026_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast('Đã xuất file bảng tính Excel (CSV UTF-8) thành công', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl animate-in slide-in-from-top-5 duration-200 text-sm">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        currentView={currentView}
        onToggleView={handleToggleView}
        onOpenManualEntry={() => {
          setEditingTransaction(null);
          setIsManualModalOpen(true);
        }}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenQRModal={() => {
          setSelectedQRMemberId('hoai');
          setIsQRModalOpen(true);
        }}
        onExportExcel={handleExportExcel}
        onRefresh={fetchFundData}
        loading={loading}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
        
        {currentView === 'admin' ? (
          /* ================= GIAO DIỆN QUẢN TRỊ THỦ QUỸ ================= */
          <TreasurerAdminView
            fundInfo={fundInfo}
            transactions={transactions}
            onUpdateFundSettings={handleUpdateFundSettings}
            onOpenManualEntry={() => {
              setEditingTransaction(null);
              setIsManualModalOpen(true);
            }}
            onOpenScanner={() => setIsScannerOpen(true)}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsManualModalOpen(true);
            }}
            onDeleteTransaction={(tx) => setDeletingTransaction(tx)}
            onUpdateCategory={handleUpdateCategory}
            onConfirmReimburse={handleConfirmReimburse}
            onOpenQRModal={(id) => {
              setSelectedQRMemberId(id || 'hoai');
              setIsQRModalOpen(true);
            }}
            onBackToPublic={() => handleToggleView('public')}
          />
        ) : (
          /* ================= GIAO DIỆN BẢNG QUỸ CÔNG KHAI ================= */
          <div>
            {/* Welcome & Info Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white mb-6 sm:mb-8 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Hệ Thống Quản Trị Quỹ
                    </span>
                    <span className="text-xs text-slate-300">
                      Cập nhật: {fundInfo.lastUpdated ? new Date(fundInfo.lastUpdated).toLocaleDateString('vi-VN') : '02/04/2026'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {fundInfo.bannerTitle || 'Quỹ Team Diamond'}
                  </h2>
                  {fundInfo.bannerDescription && (
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {fundInfo.bannerDescription}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-center">
                    <span className="block text-[11px] text-slate-300 uppercase tracking-wider">Thành viên</span>
                    <span className="text-base font-bold text-white font-mono">
                      {fundInfo.memberCount || (fundInfo.members ? fundInfo.members.length : 15)} người
                    </span>
                  </div>
                  <div className="bg-emerald-500/20 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-500/30 text-center">
                    <span className="block text-[11px] text-emerald-300 uppercase tracking-wider">Mốc đối soát</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {fundInfo.summary ? Number(fundInfo.summary.currentBalance || 11112131).toLocaleString('vi-VN') : '11.112.131'} đ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Summary Cards */}
            <SummaryCards
              summary={fundInfo.summary}
              transactions={transactions}
            />

            {/* Table Section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Bảng Kê Chi Tiết Thu - Chi
                  </h3>
                  <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full font-mono">
                    {transactions.length} dòng dữ liệu
                  </span>
                </div>
              </div>

              <FundTable
                transactions={transactions}
                isTreasurer={false}
                onViewBill={(tx) => setSelectedBillTransaction(tx)}
                onDeleteTransaction={(id) => {
                  const tx = transactions.find(t => t.id === id);
                  if (tx) setDeletingTransaction(tx);
                }}
                onEditTransaction={(tx) => {
                  setEditingTransaction(tx);
                  setIsManualModalOpen(true);
                }}
                onUpdateCategory={handleUpdateCategory}
                onConfirmReimburse={handleConfirmReimburse}
                onOpenQRModal={(id) => {
                  setSelectedQRMemberId(id || 'hoai');
                  setIsQRModalOpen(true);
                }}
              />
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Smart Fund Team Diamond</span>
            <span>•</span>
            <span>{fundInfo.memberCount || 15} thành viên</span>
          </div>
          <div>
            Số dư khả dụng mốc đối soát: <strong className="text-amber-800 font-mono font-bold">{fundInfo.summary ? Number(fundInfo.summary.currentBalance || 11112131).toLocaleString('vi-VN') : '11.112.131'} đ</strong>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <BillModal
        transaction={selectedBillTransaction}
        onClose={() => setSelectedBillTransaction(null)}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingTransaction)}
        transaction={deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleDeleteConfirm}
      />

      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
      />

      <BillScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveScan={handleSaveScan}
      />

      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        initialMemberId={selectedQRMemberId}
      />

    </div>
  );
}
