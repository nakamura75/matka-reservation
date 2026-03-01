import { notFound } from 'next/navigation';
import {
  getReservationById,
  getReservationOptions,
  getPlans,
  getOptions,
} from '@/lib/google-sheets';
import { formatDate } from '@/lib/utils';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number) {
  return `¥${amount.toLocaleString('ja-JP')}`;
}
function taxExcluded(amount: number) {
  return Math.round(amount / 1.1);
}

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const [reservation, plans, options] = await Promise.all([
    getReservationById(params.id),
    getPlans(),
    getOptions(),
  ]);

  if (!reservation) notFound();

  const reservationOptions = await getReservationOptions(reservation.id);

  const plan = plans.find((p) => p.id === reservation.planId);

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return { ...ro, optionName: opt?.name ?? '', price: opt?.price ?? 0 };
  });

  const optionTotal = optionsWithInfo.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const planPrice = plan?.price ?? 0;
  const computedTotal = planPrice + optionTotal;
  // T列に保存された合計（手動設定）があればそちらを優先
  const total =
    reservation.discountAmount != null && reservation.discountAmount > 0
      ? reservation.discountAmount
      : computedTotal;

  const issueDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <title>領収書 {reservation.reservationNumber}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; background: #f5f5f5; }
          .page { background: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 20mm 20mm 20mm 20mm; }
          .header { text-align: center; margin-bottom: 32px; }
          .store-name { font-size: 13px; color: #888; letter-spacing: 0.2em; margin-bottom: 4px; }
          .title { font-size: 28px; font-weight: bold; letter-spacing: 0.3em; margin-bottom: 24px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 13px; }
          .meta-left { font-size: 15px; }
          .meta-left .customer { font-size: 20px; font-weight: bold; margin-bottom: 4px; border-bottom: 2px solid #222; min-width: 200px; padding-bottom: 4px; }
          .meta-right { text-align: right; color: #555; }
          .amount-box { border: 2px solid #222; padding: 16px 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; }
          .amount-label { font-size: 14px; }
          .amount-value { font-size: 28px; font-weight: bold; }
          .tadashi { font-size: 13px; color: #555; margin-bottom: 32px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
          thead tr { border-bottom: 2px solid #222; }
          th { padding: 8px 4px; text-align: left; font-weight: 600; }
          th:not(:first-child) { text-align: right; }
          tbody tr { border-bottom: 1px solid #ddd; }
          td { padding: 8px 4px; }
          td:not(:first-child) { text-align: right; }
          .subtotal-area { border-top: 2px solid #222; padding-top: 12px; font-size: 13px; }
          .subtotal-row { display: flex; justify-content: space-between; padding: 4px 0; color: #555; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; font-weight: bold; border-top: 1px solid #ccc; margin-top: 4px; }
          .footer { margin-top: 48px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 16px; text-align: center; }
          .no-print { position: fixed; top: 20px; right: 20px; display: flex; gap: 8px; }
          @media print {
            body { background: white; }
            .page { margin: 0; padding: 15mm; box-shadow: none; }
            .no-print { display: none; }
          }
        `}</style>
      </head>
      <body>
        {/* 印刷ボタン（印刷時は非表示） */}
        <div className="no-print">
          <PrintButton />
          <a
            href={`/reservations/${reservation.id}`}
            style={{ padding: '8px 16px', background: '#e5e7eb', borderRadius: 8, fontSize: 13, textDecoration: 'none', color: '#374151' }}
          >
            ← 戻る
          </a>
        </div>

        <div className="page">
          {/* ヘッダー */}
          <div className="header">
            <div className="store-name">matka photo studio</div>
            <div className="title">領　収　書</div>
          </div>

          {/* 宛名・発行情報 */}
          <div className="meta">
            <div className="meta-left">
              <div className="customer">　　　　　　　　　　様</div>
              <div style={{ fontSize: 12, color: '#888' }}>予約番号：{reservation.reservationNumber}</div>
            </div>
            <div className="meta-right">
              <div>発行日：{issueDate}</div>
              <div style={{ marginTop: 4 }}>撮影日：{formatDate(reservation.date)}</div>
            </div>
          </div>

          {/* 合計金額 */}
          <div className="amount-box">
            <span className="amount-label">合計金額（税込）</span>
            <span className="amount-value">{formatCurrency(total)}</span>
          </div>

          {/* 但し書き */}
          <div className="tadashi">但し、撮影代として</div>

          {/* 明細 */}
          <table>
            <thead>
              <tr>
                <th>品目</th>
                <th>単価</th>
                <th>数量</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {plan && (
                <tr>
                  <td>{plan.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(planPrice)}</td>
                  <td style={{ textAlign: 'right' }}>1</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(planPrice)}</td>
                </tr>
              )}
              {optionsWithInfo.map((o) => (
                <tr key={o.id}>
                  <td>{o.optionName}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(o.price)}</td>
                  <td style={{ textAlign: 'right' }}>{o.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(o.price * o.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 小計・税・合計 */}
          <div className="subtotal-area">
            <div className="subtotal-row">
              <span>小計（税抜）</span>
              <span>{formatCurrency(taxExcluded(total))}</span>
            </div>
            <div className="subtotal-row">
              <span>消費税（10%）</span>
              <span>{formatCurrency(total - taxExcluded(total))}</span>
            </div>
            <div className="total-row">
              <span>合計（税込）</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* フッター */}
          <div className="footer">
            <div>matka photo studio</div>
          </div>
        </div>
      </body>
    </html>
  );
}
