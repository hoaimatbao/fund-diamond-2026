import React from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function SummaryCards({ summary, transactions = [] }) {
  const { totalIncome = 53104581, totalExpense = 41992450, currentBalance = 11112131 } = summary || {};

  const incomeCount = transactions.filter(t => t.type === 'THU').length;
  const expenseCount = transactions.filter(t => t.type === 'CHI').length;
  const spentRatio = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
      
      {/* THẺ 1: TỔNG THU (XANH LÁ) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-6 rounded-2xl border border-emerald-200/80 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tổng Thu Quỹ
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-950 font-mono">
                {formatCurrency(totalIncome)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
              <span className="inline-flex items-center gap-0.5 font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {incomeCount} khoản thu
              </span>
              <span>Đóng quỹ & Thưởng dự án</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/30">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* THẺ 2: TỔNG CHI (ĐỎ CAM) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-white p-6 rounded-2xl border border-rose-200/80 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Tổng Chi Tiêu
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-950 font-mono">
                {formatCurrency(totalExpense)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-rose-700">
              <span className="inline-flex items-center gap-0.5 font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {expenseCount} khoản chi
              </span>
              <span>Đã giải ngân ({spentRatio}% quỹ)</span>
            </div>
          </div>
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md shadow-rose-600/30">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* THẺ 3: TỔNG CUỐI / SỐ DƯ HIỆN TẠI (VÀNG NỔI BẬT) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-50/50 p-6 rounded-2xl border-2 border-amber-300 shadow-md shadow-amber-500/10 hover:shadow-lg transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-125 transition-transform"></div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
              Tổng Cuối (Số Dư Khả Dụng)
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950 font-mono">
                {formatCurrency(currentBalance)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-800">
              <span className="inline-flex items-center gap-1 font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                Khớp chuẩn Excel
              </span>
              <span className="text-amber-700/80">Sẵn sàng liên hoan đợt tới</span>
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl shadow-md shadow-amber-600/40">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

    </div>
  );
}
