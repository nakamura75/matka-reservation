'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';
import type { Plan, Option, Product, Staff, Holiday, BlockedSlot } from '@/types';
import { formatDate } from '@/lib/utils';

type Tab = 'plans' | 'options' | 'products' | 'staff' | 'holidays';

// ============================================================
// 汎用インライン編集行
// ============================================================
function EditableRow<T extends { id: string; name: string }>({
  item,
  fields,
  onSave,
  onCancel,
}: {
  item: Partial<T>;
  fields: { key: keyof T; label: string; type: string }[];
  onSave: (data: Partial<T>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<T>>(item);
  return (
    <tr className="bg-brand-light">
      {fields.map(({ key, type }) => (
        <td key={String(key)} className="px-4 py-2">
          <input
            type={type}
            value={String(form[key] ?? '')}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                [key]: type === 'number' ? Number(e.target.value) : e.target.value,
              }))
            }
            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </td>
      ))}
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => onSave(form)}
            className="p-1 bg-brand text-white rounded hover:bg-brand-dark"
          >
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 border border-gray-200 rounded hover:bg-gray-50">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// プランタブ
// ============================================================
function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/plans').then(r => r.json()).then(d => {
      setPlans(d.data ?? []);
      setLoading(false);
    });
  }, []);

  const fields: { key: keyof Plan; label: string; type: string }[] = [
    { key: 'name', label: 'プラン名', type: 'text' },
    { key: 'price', label: '単価', type: 'number' },
    { key: 'duration', label: '所要時間(分)', type: 'number' },
  ];

  async function handleSave(data: Partial<Plan>, isNew = false) {
    if (isNew) {
      const res = await fetch('/api/settings/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isActive: true }),
      });
      const json = await res.json();
      if (json.success) {
        setPlans((p) => [...p, json.data]);
        setAdding(false);
      }
    } else {
      const existing = plans.find((p) => p.id === editingId);
      await fetch('/api/settings/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing, ...data }),
      });
      setPlans((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data } : p)));
      setEditingId(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 hover:bg-brand-light"
        >
          <PlusIcon className="w-4 h-4" />
          プラン追加
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-xs">
            <tr>
              {fields.map((f) => <th key={f.label} className="px-4 py-3 text-left">{f.label}</th>)}
              <th className="px-4 py-3 text-left">有効</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <EditableRow<Plan>
                item={{ name: '', price: 0, duration: 90 }}
                fields={fields}
                onSave={(d) => handleSave(d, true)}
                onCancel={() => setAdding(false)}
              />
            )}
            {plans.map((plan) =>
              editingId === plan.id ? (
                <EditableRow<Plan>
                  key={plan.id}
                  item={plan}
                  fields={fields}
                  onSave={(d) => handleSave(d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{plan.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(plan.price)}</td>
                  <td className="px-4 py-3 text-gray-700">{plan.duration}分</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {plan.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingId(plan.id)} className="text-gray-400 hover:text-brand">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// オプションタブ
// ============================================================
function OptionsTab() {
  const [options, setOptions] = useState<Option[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/options').then(r => r.json()).then(d => {
      setOptions(d.data ?? []);
      setLoading(false);
    });
  }, []);

  const fields: { key: keyof Option; label: string; type: string }[] = [
    { key: 'name', label: 'オプション名', type: 'text' },
    { key: 'price', label: '単価', type: 'number' },
    { key: 'description', label: '説明', type: 'text' },
  ];

  async function handleSave(data: Partial<Option>, isNew = false) {
    if (isNew) {
      const res = await fetch('/api/settings/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isActive: true }),
      });
      const json = await res.json();
      if (json.success) {
        setOptions((prev) => [...prev, json.data]);
        setAdding(false);
      }
    } else {
      const existing = options.find((o) => o.id === editingId);
      await fetch('/api/settings/options', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing, ...data }),
      });
      setOptions((prev) => prev.map((o) => (o.id === editingId ? { ...o, ...data } : o)));
      setEditingId(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 hover:bg-brand-light">
          <PlusIcon className="w-4 h-4" />オプション追加
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-xs">
            <tr>
              {fields.map((f) => <th key={f.label} className="px-4 py-3 text-left">{f.label}</th>)}
              <th className="px-4 py-3 text-left">有効</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <EditableRow<Option>
                item={{ name: '', price: 0, description: '' }}
                fields={fields}
                onSave={(d) => handleSave(d, true)}
                onCancel={() => setAdding(false)}
              />
            )}
            {options.map((opt) =>
              editingId === opt.id ? (
                <EditableRow<Option>
                  key={opt.id}
                  item={opt}
                  fields={fields}
                  onSave={(d) => handleSave(d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={opt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{opt.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(opt.price)}</td>
                  <td className="px-4 py-3 text-gray-500">{opt.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${opt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {opt.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingId(opt.id)} className="text-gray-400 hover:text-brand">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 商品タブ
// ============================================================
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/products').then(r => r.json()).then(d => {
      setProducts(d.data ?? []);
      setLoading(false);
    });
  }, []);

  const fields: { key: keyof Product; label: string; type: string }[] = [
    { key: 'name', label: '商品名', type: 'text' },
    { key: 'price', label: '単価', type: 'number' },
    { key: 'description', label: '説明', type: 'text' },
  ];

  async function handleSave(data: Partial<Product>, isNew = false) {
    if (isNew) {
      const maxSort = products.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), 0);
      const res = await fetch('/api/settings/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isActive: true, sortOrder: maxSort + 1 }),
      });
      const json = await res.json();
      if (json.success) {
        setProducts((prev) => [...prev, json.data]);
        setAdding(false);
      }
    } else {
      const existing = products.find((p) => p.id === editingId);
      await fetch('/api/settings/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing, ...data }),
      });
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data } : p)));
      setEditingId(null);
    }
  }

  async function moveProduct(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= products.length) return;
    const newProducts = [...products];
    [newProducts[index], newProducts[swapIndex]] = [newProducts[swapIndex], newProducts[index]];
    const updated = newProducts.map((p, i) => ({ ...p, sortOrder: i }));
    setProducts(updated);
    setSaving(true);
    await fetch('/api/settings/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updated.map((p, i) => ({ id: p.id, sortOrder: i })) }),
    });
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {saving && <span className="text-xs text-gray-400">保存中...</span>}
        {!saving && <span />}
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 hover:bg-brand-light">
          <PlusIcon className="w-4 h-4" />商品追加
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-xs">
            <tr>
              <th className="px-2 py-3 text-center w-[70px]">並替</th>
              {fields.map((f) => <th key={f.label} className="px-4 py-3 text-left">{f.label}</th>)}
              <th className="px-4 py-3 text-left">有効</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-brand-light">
                <td className="px-2 py-2" />
                {fields.map(({ key }) => (
                  <td key={String(key)} className="px-4 py-2" />
                ))}
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
              </tr>
            )}
            {adding && (
              <EditableRow<Product>
                item={{ name: '', price: 0, description: '' }}
                fields={fields}
                onSave={(d) => handleSave(d, true)}
                onCancel={() => setAdding(false)}
              />
            )}
            {products.map((p, idx) =>
              editingId === p.id ? (
                <EditableRow<Product>
                  key={p.id}
                  item={p}
                  fields={fields}
                  onSave={(d) => handleSave(d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => moveProduct(idx, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 text-gray-400 hover:text-brand disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveProduct(idx, 'down')}
                        disabled={idx === products.length - 1}
                        className="p-0.5 text-gray-400 hover:text-brand disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingId(p.id)} className="text-gray-400 hover:text-brand">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// スタッフタブ
// ============================================================
function StaffTab() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/staff').then(r => r.json()).then(d => {
      setStaff(d.data ?? []);
      setLoading(false);
    });
  }, []);

  async function handleAdd() {
    if (!newName) return;
    const res = await fetch('/api/settings/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    if (json.success) {
      setStaff((prev) => [...prev, json.data]);
      setNewName('');
      setAdding(false);
    }
  }

  async function handleUpdate(member: Staff) {
    await fetch('/api/settings/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...member, name: editName }),
    });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, name: editName } : s)));
    setEditingId(null);
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => { setAdding(true); setNewName(''); }}
          className="flex items-center gap-1 text-sm text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 hover:bg-brand-light">
          <PlusIcon className="w-4 h-4" />スタッフ追加
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-xs">
            <tr>
              <th className="px-4 py-3 text-left">スタッフ名</th>
              <th className="px-4 py-3 text-left">有効</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-brand-light">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="スタッフ名"
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/30"
                  />
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">有効</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={handleAdd} className="p-1 bg-brand text-white rounded">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setAdding(false)} className="p-1 text-gray-400 border border-gray-200 rounded">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {staff.map((member) =>
              editingId === member.id ? (
                <tr key={member.id} className="bg-brand-light">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/30"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">有効</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdate(member)} className="p-1 bg-brand text-white rounded">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 border border-gray-200 rounded">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">有効</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditingId(member.id); setEditName(member.name); }}
                      className="text-gray-400 hover:text-brand">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 休日管理タブ
// ============================================================

const HOLIDAY_TYPES = [
  { value: 'holiday', label: '祝日' },
  { value: 'closed', label: '定休日' },
  { value: 'temporary', label: '臨時休業' },
] as const;

const BLOCK_HOURS = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'] as const;
const BLOCK_END_HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] as const;
function parseHour(t: string): number {
  return parseInt(t.split(':')[0], 10);
}

function HolidaysTab() {
  // --- 祝日 state ---
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');
  const [hType, setHType] = useState('holiday');
  const [hLoading, setHLoading] = useState(true);
  const [hSubmitting, setHSubmitting] = useState(false);

  // --- ブロック枠 state ---
  const [slots, setSlots] = useState<BlockedSlot[]>([]);
  const [sDate, setSDate] = useState('');
  const [sAllDay, setSAllDay] = useState(true);
  const [sStartTime, setSStartTime] = useState('9:00');
  const [sEndTime, setSEndTime] = useState('18:00');
  const [sReason, setSReason] = useState('');
  const [sLoading, setSLoading] = useState(true);
  const [sSubmitting, setSSubmitting] = useState(false);

  // --- アコーディオン state ---
  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set([new Date().getFullYear()]));

  useEffect(() => {
    fetch('/api/settings/holidays').then(r => r.json()).then(d => {
      setHolidays(d.data ?? []);
      setHLoading(false);
    });
    fetch('/api/settings/blocked-slots').then(r => r.json()).then(d => {
      setSlots(d.data ?? []);
      setSLoading(false);
    });
  }, []);

  // 年度別にグループ化
  const holidaysByYear = useMemo(() => {
    const map = new Map<number, Holiday[]>();
    for (const h of holidays) {
      const year = parseInt(h.date.slice(0, 4), 10);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(h);
    }
    // 年度順にソート
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [holidays]);

  function toggleYear(year: number) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  // ブロック枠の統合リスト（定休日・臨時休業 + blocked_slots）
  type BlockedEntry = {
    id: string;
    date: string;
    timeSlot: string | null;
    reason: string | null;
    source: 'holiday' | 'blocked';
    holidayType?: string; // 'closed' | 'temporary'
  };
  const mergedBlocked = useMemo<BlockedEntry[]>(() => {
    const fromHolidays: BlockedEntry[] = holidays
      .filter((h) => h.type === 'closed' || h.type === 'temporary')
      .map((h) => ({
        id: `h-${h.id}`,
        date: h.date,
        timeSlot: null,
        reason: h.name,
        source: 'holiday' as const,
        holidayType: h.type,
      }));
    const fromSlots: BlockedEntry[] = slots.map((s) => ({
      id: s.id,
      date: s.date,
      timeSlot: s.timeSlot ?? null,
      reason: s.reason ?? null,
      source: 'blocked' as const,
    }));
    return [...fromHolidays, ...fromSlots].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, slots]);

  // --- 祝日 handlers ---
  async function handleAddHoliday() {
    if (!hDate || !hName) return;
    setHSubmitting(true);
    try {
      const res = await fetch('/api/settings/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: hDate, name: hName, type: hType }),
      });
      const json = await res.json();
      if (json.success) {
        setHolidays((prev) => [...prev, json.data].sort((a, b) => a.date.localeCompare(b.date)));
        setHDate(''); setHName(''); setHType('holiday');
        // 追加した年を開く
        const addedYear = parseInt(hDate.slice(0, 4), 10);
        setOpenYears((prev) => { const next = new Set(prev); next.add(addedYear); return next; });
      }
    } finally { setHSubmitting(false); }
  }

  async function handleDeleteHoliday(id: string) {
    await fetch(`/api/settings/holidays?id=${id}`, { method: 'DELETE' });
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }

  // --- ブロック枠 handlers ---
  async function handleAddSlot() {
    if (!sDate) return;
    setSSubmitting(true);
    try {
      if (sAllDay) {
        // 終日ブロック
        const res = await fetch('/api/settings/blocked-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: sDate, timeSlot: null, reason: sReason || null }),
        });
        const json = await res.json();
        if (json.success) {
          setSlots((prev) => [...prev, json.data].sort((a, b) => a.date.localeCompare(b.date)));
        }
      } else {
        // 時間帯指定: 範囲内の各時間を1時間単位で個別登録
        const startH = parseHour(sStartTime);
        const endH = parseHour(sEndTime);
        const slotsToBlock: string[] = [];
        for (let h = startH; h < endH; h++) {
          slotsToBlock.push(`${h}:00`);
        }
        for (const slot of slotsToBlock) {
          const res = await fetch('/api/settings/blocked-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: sDate, timeSlot: slot, reason: sReason || null }),
          });
          const json = await res.json();
          if (json.success) {
            setSlots((prev) => [...prev, json.data].sort((a, b) => a.date.localeCompare(b.date)));
          }
        }
      }
      setSDate(''); setSAllDay(true); setSStartTime('9:00'); setSEndTime('18:00'); setSReason('');
    } finally { setSSubmitting(false); }
  }

  async function handleDeleteSlot(id: string) {
    await fetch(`/api/settings/blocked-slots?id=${id}`, { method: 'DELETE' });
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  const typeLabel = (t: string) => HOLIDAY_TYPES.find((h) => h.value === t)?.label ?? t;
  const typeBadge = (t: string) => {
    if (t === 'closed') return 'bg-red-100 text-red-700';
    if (t === 'temporary') return 'bg-orange-100 text-orange-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="space-y-8">
      {/* === 祝日・定休日セクション === */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">祝日・定休日</h2>
        {/* 追加フォーム */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">日付</label>
            <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">名前</label>
            <input type="text" placeholder="例: 元日" value={hName} onChange={(e) => setHName(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[200px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">種別</label>
            <select value={hType} onChange={(e) => setHType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[130px]">
              {HOLIDAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={handleAddHoliday} disabled={hSubmitting || !hDate || !hName}
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-40">
            <PlusIcon className="w-4 h-4" />
            {hSubmitting ? '追加中...' : '追加'}
          </button>
        </div>
        {/* 年度別アコーディオン */}
        {hLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
        ) : holidaysByYear.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
            登録された祝日はありません
          </div>
        ) : (
          <div className="space-y-2">
            {holidaysByYear.map(([year, items]) => (
              <div key={year} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {year}年
                    <span className="ml-2 text-xs font-normal text-gray-400">{items.length}件</span>
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-gray-400 transition-transform ${openYears.has(year) ? 'rotate-180' : ''}`}
                  />
                </button>
                {openYears.has(year) && (
                  <table className="w-full text-sm border-t border-gray-100">
                    <thead className="bg-gray-50 text-gray-400 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left">日付</th>
                        <th className="px-4 py-2 text-left">名前</th>
                        <th className="px-4 py-2 text-left">種別</th>
                        <th className="px-4 py-2 w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((h) => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-700">{formatDate(h.date)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{h.name}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge(h.type)}`}>
                              {typeLabel(h.type)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => handleDeleteHoliday(h.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === ブロック枠セクション === */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">ブロック枠（休業日）</h2>
        <p className="text-xs text-gray-400 mb-3">定休日・臨時休業は祝日・定休日セクションから自動反映されます</p>
        {/* 追加フォーム */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">日付</label>
            <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">時間帯</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={sAllDay} onChange={(e) => setSAllDay(e.target.checked)}
                  className="w-4 h-4 accent-brand" />
                終日
              </label>
              {!sAllDay && (
                <>
                  <select value={sStartTime} onChange={(e) => {
                    setSStartTime(e.target.value);
                    if (parseHour(e.target.value) >= parseHour(sEndTime)) {
                      const idx = BLOCK_HOURS.indexOf(e.target.value as typeof BLOCK_HOURS[number]);
                      setSEndTime(BLOCK_END_HOURS[Math.min(idx, BLOCK_END_HOURS.length - 1)]);
                    }
                  }}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[80px]">
                    {BLOCK_HOURS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-gray-400 text-sm">〜</span>
                  <select value={sEndTime} onChange={(e) => setSEndTime(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[80px]">
                    {BLOCK_END_HOURS.filter((t) => parseHour(t) > parseHour(sStartTime)).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">理由</label>
            <input type="text" placeholder="例: 社内研修" value={sReason} onChange={(e) => setSReason(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 w-[200px]" />
          </div>
          <button onClick={handleAddSlot} disabled={sSubmitting || !sDate}
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-40">
            <PlusIcon className="w-4 h-4" />
            {sSubmitting ? '追加中...' : '追加'}
          </button>
        </div>
        {/* 統合テーブル */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">種別</th>
                <th className="px-4 py-3 text-left">日付</th>
                <th className="px-4 py-3 text-left">時間帯</th>
                <th className="px-4 py-3 text-left">理由</th>
                <th className="px-4 py-3 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(hLoading || sLoading) ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : mergedBlocked.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">登録された休業日はありません</td></tr>
              ) : mergedBlocked.map((entry) => (
                <tr key={entry.id} className={`hover:bg-gray-50 ${entry.source === 'holiday' ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    {entry.source === 'holiday' ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${entry.holidayType === 'closed' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {entry.holidayType === 'closed' ? '定休日' : '臨時休業'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">休業日</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.timeSlot || <span className="text-gray-400">終日</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.reason || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3">
                    {entry.source === 'blocked' ? (
                      <button onClick={() => handleDeleteSlot(entry.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                    ) : (
                      <span className="text-xs text-gray-300">自動</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
const TABS: { key: Tab; label: string }[] = [
  { key: 'plans', label: 'プラン' },
  { key: 'options', label: 'オプション' },
  { key: 'products', label: '商品' },
  { key: 'staff', label: 'スタッフ' },
  { key: 'holidays', label: '休日管理' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">設定</h1>

      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${tab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab />}
      {tab === 'options' && <OptionsTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'holidays' && <HolidaysTab />}
    </div>
  );
}
