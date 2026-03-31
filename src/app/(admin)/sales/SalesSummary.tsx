'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { Reservation, Staff, Order, OrderItem, Holiday, ReservationOption } from '@/types';
import { PLAN_STAFF_BREAKDOWN, SCENE_PLAN_MAP, HOLIDAY_FEE } from '@/lib/constants';
import { isWeekend } from '@/lib/utils';

function isHolidayOrWeekend(dateStr: string, holidayDates: Set<string>): boolean {
  return isWeekend(dateStr) || holidayDates.has(dateStr);
}

interface EnrichedOrderItem extends OrderItem { productPrice: number; }
interface EnrichedOrder extends Omit<Order, 'items'> { items: EnrichedOrderItem[]; }

interface Props {
  reservations: Reservation[];
  staff: Staff[];
  orders: EnrichedOrder[];
  holidays: Holiday[];
  reservationOptions: ReservationOption[];
  optionPriceMap: Record<string, number>;
}

const ROLES = ['photo', 'assistant', 'hair', 'makeup', 'option'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  photo: 'フォト',
  assistant: 'アシスタント',
  hair: 'ヘア',
  makeup: 'メイク',
  option: 'オプション',
};

function parseAssignment(json?: string): Partial<Record<'photo' | 'assistant' | 'hair' | 'makeup', string>> & { options?: Record<string, string> } {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

function formatYen(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}

function taxExcluded(amount: number): number {
  return Math.round(amount / 1.1);
}

type TaxMode = 'included' | 'excluded';

export default function SalesSummary({ reservations, staff, orders, holidays, reservationOptions, optionPriceMap }: Props) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialMonth = searchParams.get('month') || defaultMonth;
  const initialTax = (searchParams.get('tax') as TaxMode) || 'included';

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [taxMode, setTaxMode] = useState<TaxMode>(initialTax);

  const updateURL = useCallback((m: string, t: string) => {
    const params = new URLSearchParams();
    params.set('month', m);
    params.set('tax', t);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname]);

  const applyTax = (amount: number) => taxMode === 'excluded' ? taxExcluded(amount) : amount;

  const staffById = useMemo(() => {
    const map: Record<string, Staff> = {};
    for (const s of staff) map[s.id] = s;
    return map;
  }, [staff]);

  // 予約ID → 予約日マップ
  const reservationDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of reservations) map[r.id] = r.date;
    return map;
  }, [reservations]);

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

  // 予約ID → 商品割引率マップ
  const productDiscountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of reservations) map[r.id] = r.productDiscountRate ?? 0;
    return map;
  }, [reservations]);

  // 選択月の注文明細を分類（紐づく予約日で月絞り込み、なければ注文日）
  const monthOrders = useMemo(
    () => orders.filter((o) => {
      const date = o.reservationId ? reservationDateMap[o.reservationId] : o.orderDate;
      return date?.slice(0, 7) === selectedMonth;
    }),
    [orders, reservationDateMap, selectedMonth]
  );
  const shippedOrderTotal = useMemo(
    () => monthOrders.reduce((sum, o) => {
      const raw = o.items.filter((i) => i.status === '発送済').reduce((s, i) => s + i.productPrice * i.quantity, 0);
      const rate = o.reservationId ? (productDiscountMap[o.reservationId] ?? 0) : 0;
      return sum + Math.round(raw * (1 - rate / 100));
    }, 0),
    [monthOrders, productDiscountMap]
  );
  const pendingOrderTotal = useMemo(
    () => monthOrders.reduce((sum, o) => {
      const raw = o.items.filter((i) => i.status !== '発送済').reduce((s, i) => s + i.productPrice * i.quantity, 0);
      const rate = o.reservationId ? (productDiscountMap[o.reservationId] ?? 0) : 0;
      return sum + Math.round(raw * (1 - rate / 100));
    }, 0),
    [monthOrders, productDiscountMap]
  );
  const shippedItemCount = useMemo(
    () => monthOrders.reduce((sum, o) => sum + o.items.filter((i) => i.status === '発送済').length, 0),
    [monthOrders]
  );
  const pendingItemCount = useMemo(
    () => monthOrders.reduce((sum, o) => sum + o.items.filter((i) => i.status !== '発送済').length, 0),
    [monthOrders]
  );
  const holidayDates = useMemo(
    () => new Set(holidays.filter((h) => h.type === 'holiday').map((h) => h.date)),
    [holidays]
  );
  const holidayFeeTotal = useMemo(
    () => completedReservations.filter((r) => isHolidayOrWeekend(r.date, holidayDates) && (r.discountRate ?? 0) < 100).length * HOLIDAY_FEE,
    [completedReservations, holidayDates]
  );
  const holidayFeeCount = useMemo(
    () => completedReservations.filter((r) => isHolidayOrWeekend(r.date, holidayDates) && (r.discountRate ?? 0) < 100).length,
    [completedReservations, holidayDates]
  );

  // 単価別の件数を記録する型
  type UnitEntry = { count: number; discounted: boolean };
  type UnitBreakdown = Record<number, UnitEntry>; // { 単価: { count, discounted } }
  type StaffRow = {
    name: string;
    counts: Record<Role, number>;
    amounts: Record<Role, number>;
    unitBreakdowns: Record<Role, UnitBreakdown>;
    total: number;
  };

  // 予約IDごとのオプション一覧マップ
  const optionsByReservation = useMemo(() => {
    const map: Record<string, ReservationOption[]> = {};
    for (const ro of reservationOptions) {
      if (!map[ro.reservationId]) map[ro.reservationId] = [];
      map[ro.reservationId].push(ro);
    }
    return map;
  }, [reservationOptions]);

  const emptyRoleCounts = (): Record<Role, number> => ({ photo: 0, assistant: 0, hair: 0, makeup: 0, option: 0 });
  const emptyRoleBreakdowns = (): Record<Role, UnitBreakdown> => ({ photo: {}, assistant: {}, hair: {}, makeup: {}, option: {} });

  // 予約リストから担当者別金額を集計する共通関数
  function calcByStaff(
    targets: Reservation[],
    nameMap: Record<string, Staff>
  ) {
    const map: Record<string, StaffRow> = {};
    for (const r of targets) {
      const assignment = parseAssignment(r.staffAssignmentJson);
      const planType = SCENE_PLAN_MAP[r.scene ?? ''] ?? 'Discovery';
      const breakdown = PLAN_STAFF_BREAKDOWN[planType];
      const rate = (r as Reservation & { discountRate?: number }).discountRate ?? 0;
      const multiplier = 1 - rate / 100;
      // プラン役割（photo/assistant/hair/makeup）
      for (const role of (['photo', 'assistant', 'hair', 'makeup'] as const)) {
        const staffId = assignment[role];
        if (!staffId) continue;
        if (!map[staffId]) {
          map[staffId] = {
            name: nameMap[staffId]?.name ?? staffId,
            counts: emptyRoleCounts(),
            amounts: emptyRoleCounts(),
            unitBreakdowns: emptyRoleBreakdowns(),
            total: 0,
          };
        }
        const unitPrice = Math.round(breakdown[role] * multiplier);
        const discounted = rate > 0;
        map[staffId].counts[role] += 1;
        map[staffId].amounts[role] += unitPrice;
        if (!map[staffId].unitBreakdowns[role][unitPrice]) {
          map[staffId].unitBreakdowns[role][unitPrice] = { count: 0, discounted };
        }
        map[staffId].unitBreakdowns[role][unitPrice].count += 1;
        map[staffId].total += unitPrice;
      }
      // オプション担当
      const resOptions = optionsByReservation[r.id] ?? [];
      for (const ro of resOptions) {
        const staffId = assignment.options?.[ro.id];
        if (!staffId) continue;
        if (!map[staffId]) {
          map[staffId] = {
            name: nameMap[staffId]?.name ?? staffId,
            counts: emptyRoleCounts(),
            amounts: emptyRoleCounts(),
            unitBreakdowns: emptyRoleBreakdowns(),
            total: 0,
          };
        }
        const optPrice = (optionPriceMap[ro.optionId] ?? 0) * ro.quantity;
        const unitPrice = Math.round(optPrice * multiplier);
        const discounted = rate > 0;
        map[staffId].counts.option += 1;
        map[staffId].amounts.option += unitPrice;
        if (!map[staffId].unitBreakdowns.option[unitPrice]) {
          map[staffId].unitBreakdowns.option[unitPrice] = { count: 0, discounted };
        }
        map[staffId].unitBreakdowns.option[unitPrice].count += 1;
        map[staffId].total += unitPrice;
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
    const totals: Record<Role, number> = { photo: 0, assistant: 0, hair: 0, makeup: 0, option: 0 };
    for (const row of byStaff) {
      for (const role of ROLES) totals[role] += row.amounts[role];
    }
    return totals;
  }, [byStaff]);

  // 支払方法別の集計（完了のみ）
  const paymentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const r of completedReservations) {
      const method = r.paymentMethod || '未設定';
      breakdown[method] = (breakdown[method] ?? 0) + (r.total ?? 0);
    }
    return breakdown;
  }, [completedReservations]);

  const hasStaffRows = byStaff.length > 0 || shippedOrderTotal > 0 || holidayFeeTotal > 0;

  return (
    <div className="space-y-4">
      {/* 月選択 & 税切り替え */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <label className="text-sm text-gray-600 font-medium">対象月</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); updateURL(e.target.value, taxMode); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <span className="text-xs text-gray-400">完了・予約済・予約確定から集計</span>
        <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => { setTaxMode('included'); updateURL(selectedMonth, 'included'); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              taxMode === 'included'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            税込
          </button>
          <button
            onClick={() => { setTaxMode('excluded'); updateURL(selectedMonth, 'excluded'); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              taxMode === 'excluded'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            税抜
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">確定売上{taxMode === 'excluded' ? '（税抜）' : ''}</p>
          <p className="text-xs text-gray-400 mb-2">
            完了 {completedReservations.length} 件
            {shippedItemCount > 0 && <span className="ml-2">＋ 発送済商品 {shippedItemCount} 点</span>}
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatYen(applyTax(grandTotal + shippedOrderTotal))}</p>
          {shippedOrderTotal > 0 && (
            <p className="text-xs text-gray-400 mt-1">うち商品 {formatYen(applyTax(shippedOrderTotal))}</p>
          )}
          {Object.keys(paymentBreakdown).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
              {Object.entries(paymentBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([method, amount]) => (
                  <p key={method} className="text-xs text-gray-400">
                    {method} {formatYen(applyTax(amount))}
                  </p>
                ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">見込み売上{taxMode === 'excluded' ? '（税抜）' : ''}</p>
          <p className="text-xs text-gray-400 mb-2">
            仮予約・確定 {pendingReservations.length} 件
            {pendingItemCount > 0 && <span className="ml-2">＋ 商品 {pendingItemCount} 点</span>}
          </p>
          <p className="text-2xl font-bold text-blue-600">{formatYen(applyTax(pendingTotal + pendingOrderTotal))}</p>
          {pendingOrderTotal > 0 && (
            <p className="text-xs text-gray-400 mt-1">うち商品 {formatYen(applyTax(pendingOrderTotal))}</p>
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
                    <tr key={row.name} className="hover:bg-gray-50 align-top">
                      <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                      {ROLES.map((role) => {
                        const bd = row.unitBreakdowns[role];
                        const entries = Object.entries(bd).map(([p, entry]) => ({ unitPrice: Number(p), ...entry }));
                        return (
                          <td key={role} className="px-4 py-3 text-right text-gray-600">
                            {row.counts[role] > 0 ? (
                              <div>
                                <div className="font-medium">{formatYen(applyTax(row.amounts[role]))}</div>
                                {role !== 'option' && (
                                  <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                                    {entries.map(({ unitPrice, count, discounted }) => (
                                      <div key={unitPrice} className="flex items-baseline justify-end gap-1">
                                        {discounted
                                          ? <span className="text-red-400">割引あり</span>
                                          : <span>&nbsp;</span>}
                                        <span className="tabular-nums">{formatYen(applyTax(unitPrice))} ×{count}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatYen(applyTax(row.total))}
                      </td>
                    </tr>
                  ))}
                  {/* matka. 行（休日料金・商品売上） */}
                  {(shippedOrderTotal > 0 || holidayFeeTotal > 0) && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        matka.
                        <div className="text-xs text-gray-400 font-normal mt-0.5 space-y-0.5">
                          {holidayFeeCount > 0 && (
                            <div>休日料金 ×{holidayFeeCount}　{formatYen(applyTax(holidayFeeTotal))}</div>
                          )}
                          {shippedOrderTotal > 0 && (
                            <div>商品（発送済）　{formatYen(applyTax(shippedOrderTotal))}</div>
                          )}
                        </div>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-right text-gray-300">—</td>
                      ))}
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatYen(applyTax(shippedOrderTotal + holidayFeeTotal))}
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
                      {roleTotals[role] ? formatYen(applyTax(roleTotals[role])) : '—'}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right">
                    <div className="font-bold text-brand text-base">
                      {formatYen(applyTax(staffGrandTotal + shippedOrderTotal + holidayFeeTotal))}
                    </div>
                    {Object.keys(paymentBreakdown).length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(paymentBreakdown)
                          .sort(([, a], [, b]) => b - a)
                          .map(([method, amount]) => (
                            <div key={method} className="text-xs text-gray-400">
                              {method} {formatYen(applyTax(amount))}
                            </div>
                          ))}
                      </div>
                    )}
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
