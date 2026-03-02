'use client';

import { useState, useMemo } from 'react';
import type { Reservation, Staff, Order, OrderItem } from '@/types';
import { PLAN_STAFF_BREAKDOWN, SCENE_PLAN_MAP } from '@/lib/constants';

interface EnrichedOrderItem extends OrderItem { productPrice: number; }
interface EnrichedOrder extends Omit<Order, 'items'> { items: EnrichedOrderItem[]; }

interface Props {
  reservations: Reservation[];
  staff: Staff[];
  orders: EnrichedOrder[];
}

const ROLES = ['photo', 'assistant', 'hair', 'makeup'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  photo: 'フォト',
  assistant: 'アシスタント',
  hair: 'ヘア',
  makeup: 'メイク',
};

function parseAssignment(json?: string): Partial<Record<Role, string>> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

function formatYen(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}

export default function SalesSummary({ reservations, staff, orders }: Props) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const staffById = useMemo(() => {
    const map: Record<string, Staff> = {};
    for (const s of staff) map[s.id] = s;
    return map;
  }, [staff]);

  // 選択月の予約をステータスで分類
  const monthReservations = useMemo(
    () => reservations.filter((r) => r.date.slice(0, 7) === selectedMonth),
    [reservations, selectedMonth]
  );
  const completedReservations = useMemo(
    () => monthReservations.filter((r) => r.status === '完了'),
    [monthReservations]
  );
  const pendingReservations = useMemo(
    () => monthReservations.filter((r) => r.status === '予約済' || r.status === '予約確定'),
    [monthReservations]
  );

  // 選択月の注文明細を分類（注文日で月絞り込み）
  const monthOrders = useMemo(
    () => orders.filter((o) => o.orderDate.slice(0, 7) === selectedMonth),
    [orders, selectedMonth]
  );
  const shippedOrderTotal = useMemo(
    () => monthOrders.reduce((sum, o) =>
      sum + o.items.filter((i) => i.status === '発送済').reduce((s, i) => s + i.productPrice * i.quantity, 0), 0),
    [monthOrders]
  );
  const pendingOrderTotal = useMemo(
    () => monthOrders.reduce((sum, o) =>
      sum + o.items.filter((i) => i.status !== '発送済').reduce((s, i) => s + i.productPrice * i.quantity, 0), 0),
    [monthOrders]
  );
  const shippedItemCount = useMemo(
    () => monthOrders.reduce((sum, o) => sum + o.items.filter((i) => i.status === '発送済').length, 0),
    [monthOrders]
  );
  const pendingItemCount = useMemo(
    () => monthOrders.reduce((sum, o) => sum + o.items.filter((i) => i.status !== '発送済').length, 0),
    [monthOrders]
  );

  // 予約リストから担当者別金額を集計する共通関数
  function calcByStaff(
    targets: Reservation[],
    nameMap: Record<string, Staff>
  ) {
    const map: Record<
      string,
      { name: string; counts: Record<Role, number>; amounts: Record<Role, number>; total: number }
    > = {};
    for (const r of targets) {
      const assignment = parseAssignment(r.staffAssignmentJson);
      const planType = SCENE_PLAN_MAP[r.scene ?? ''] ?? 'Discovery';
      const breakdown = PLAN_STAFF_BREAKDOWN[planType];
      for (const role of ROLES) {
        const staffId = assignment[role];
        if (!staffId) continue;
        if (!map[staffId]) {
          map[staffId] = {
            name: nameMap[staffId]?.name ?? staffId,
            counts: { photo: 0, assistant: 0, hair: 0, makeup: 0 },
            amounts: { photo: 0, assistant: 0, hair: 0, makeup: 0 },
            total: 0,
          };
        }
        map[staffId].counts[role] += 1;
        map[staffId].amounts[role] += breakdown[role];
        map[staffId].total += breakdown[role];
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  // 完了の担当者別集計
  const byStaff = useMemo(
    () => calcByStaff(completedReservations, staffById),
    [completedReservations, staffById]
  );
  // サマリーカード用：担当割当の有無に関係なく全予約の r.total を合計
  const grandTotal = useMemo(
    () => completedReservations.reduce((s, r) => s + (r.total ?? 0), 0),
    [completedReservations]
  );
  const pendingTotal = useMemo(
    () => pendingReservations.reduce((s, r) => s + (r.total ?? 0), 0),
    [pendingReservations]
  );
  // テーブルフッター用：担当別集計の合計
  const staffGrandTotal = useMemo(() => byStaff.reduce((s, r) => s + r.total, 0), [byStaff]);

  // 役割ごとの列合計（完了のみ）
  const roleTotals = useMemo(() => {
    const totals: Record<Role, number> = { photo: 0, assistant: 0, hair: 0, makeup: 0 };
    for (const row of byStaff) {
      for (const role of ROLES) totals[role] += row.amounts[role];
    }
    return totals;
  }, [byStaff]);

  const hasStaffRows = byStaff.length > 0 || shippedOrderTotal > 0;

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
        <span className="text-xs text-gray-400">完了・予約済・予約確定から集計</span>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">確定売上</p>
          <p className="text-xs text-gray-400 mb-2">
            完了 {completedReservations.length} 件
            {shippedItemCount > 0 && <span className="ml-2">＋ 発送済商品 {shippedItemCount} 点</span>}
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatYen(grandTotal + shippedOrderTotal)}</p>
          {shippedOrderTotal > 0 && (
            <p className="text-xs text-gray-400 mt-1">うち商品 {formatYen(shippedOrderTotal)}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">見込み売上</p>
          <p className="text-xs text-gray-400 mb-2">
            予約済・確定 {pendingReservations.length} 件
            {pendingItemCount > 0 && <span className="ml-2">＋ 商品 {pendingItemCount} 点</span>}
          </p>
          <p className="text-2xl font-bold text-blue-600">{formatYen(pendingTotal + pendingOrderTotal)}</p>
          {pendingOrderTotal > 0 && (
            <p className="text-xs text-gray-400 mt-1">うち商品 {formatYen(pendingOrderTotal)}</p>
          )}
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
                {ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-right">{ROLE_LABEL[role]}</th>
                ))}
                <th className="px-5 py-3 text-right">合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!hasStaffRows ? (
                <tr>
                  <td colSpan={ROLES.length + 2} className="px-5 py-10 text-center text-gray-400">
                    {selectedMonth} に「完了」の予約・発送済商品がありません
                  </td>
                </tr>
              ) : (
                <>
                  {byStaff.map((row) => (
                    <tr key={row.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-right text-gray-600">
                          {row.counts[role] > 0 ? (
                            <span>
                              {formatYen(row.amounts[role])}
                              <span className="text-xs text-gray-400 ml-1">×{row.counts[role]}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatYen(row.total)}
                      </td>
                    </tr>
                  ))}
                  {/* matka. 行（商品売上） */}
                  {shippedOrderTotal > 0 && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        matka.
                        <span className="text-xs text-gray-400 font-normal ml-1">（商品）</span>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-right text-gray-300">—</td>
                      ))}
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatYen(shippedOrderTotal)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
            {hasStaffRows && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-5 py-3 font-semibold text-gray-700">合計</td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-4 py-3 text-right font-semibold text-gray-700">
                      {roleTotals[role] ? formatYen(roleTotals[role]) : '—'}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-bold text-brand text-base">
                    {formatYen(staffGrandTotal + shippedOrderTotal)}
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
