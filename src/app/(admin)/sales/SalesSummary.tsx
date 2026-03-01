'use client';

import { useState, useMemo } from 'react';
import type { SalesRecord, Staff } from '@/types';

interface Props {
  salesRecords: SalesRecord[];
  staff: Staff[];
}

function toYearMonth(dateStr: string | undefined): string {
  if (!dateStr) return '';
  // "2025/03/15 10:00" → "2025-03"  or  "2025-03-15" → "2025-03"
  const normalized = dateStr.replace(/\//g, '-');
  return normalized.slice(0, 7);
}

function formatYen(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}

export default function SalesSummary({ salesRecords, staff }: Props) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const staffById = useMemo(() => {
    const map: Record<string, Staff> = {};
    for (const s of staff) map[s.id] = s;
    return map;
  }, [staff]);

  // 選択月でフィルタ
  const filtered = useMemo(
    () => salesRecords.filter((r) => toYearMonth(r.paymentDateTime) === selectedMonth),
    [salesRecords, selectedMonth]
  );

  // 担当者ごとに集計
  const byStaff = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number; categories: Record<string, number> }> = {};

    for (const r of filtered) {
      const key = r.staffId || '(未設定)';
      const name = r.staffId ? (staffById[r.staffId]?.name ?? r.staffId) : '未設定';
      if (!map[key]) map[key] = { name, count: 0, total: 0, categories: {} };
      map[key].count += 1;
      map[key].total += r.amount;
      const cat = r.category || '—';
      map[key].categories[cat] = (map[key].categories[cat] ?? 0) + r.amount;
    }

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered, staffById]);

  const grandTotal = useMemo(() => byStaff.reduce((s, r) => s + r.total, 0), [byStaff]);
  const grandCount = useMemo(() => byStaff.reduce((s, r) => s + r.count, 0), [byStaff]);

  // カテゴリ一覧（全件）
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of filtered) cats.add(r.category || '—');
    return Array.from(cats).sort();
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* 月選択 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
        <label className="text-sm text-gray-600 font-medium">対象月</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">総売上</p>
          <p className="text-2xl font-bold text-gray-900">{formatYen(grandTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">総件数</p>
          <p className="text-2xl font-bold text-gray-900">{grandCount} 件</p>
        </div>
      </div>

      {/* 担当者別テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">担当者別 合計金額</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">担当者</th>
                {allCategories.map((cat) => (
                  <th key={cat} className="px-4 py-3 text-right">{cat}</th>
                ))}
                <th className="px-4 py-3 text-right">件数</th>
                <th className="px-5 py-3 text-right">合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byStaff.length === 0 ? (
                <tr>
                  <td colSpan={allCategories.length + 3} className="px-5 py-10 text-center text-gray-400">
                    {selectedMonth} の売上データがありません
                  </td>
                </tr>
              ) : (
                byStaff.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                    {allCategories.map((cat) => (
                      <td key={cat} className="px-4 py-3 text-right text-gray-600">
                        {row.categories[cat] ? formatYen(row.categories[cat]) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-gray-500">{row.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatYen(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {byStaff.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-5 py-3 font-semibold text-gray-700">合計</td>
                  {allCategories.map((cat) => {
                    const catTotal = byStaff.reduce((s, r) => s + (r.categories[cat] ?? 0), 0);
                    return (
                      <td key={cat} className="px-4 py-3 text-right font-semibold text-gray-700">
                        {catTotal ? formatYen(catTotal) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-semibold text-gray-700">{grandCount}</td>
                  <td className="px-5 py-3 text-right font-bold text-brand text-base">
                    {formatYen(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
