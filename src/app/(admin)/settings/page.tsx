'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';
import type { Plan, Option, Product, Staff } from '@/types';

type Tab = 'plans' | 'options' | 'products' | 'staff';

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
      const res = await fetch('/api/settings/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isActive: true }),
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

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-1.5 hover:bg-brand-light">
          <PlusIcon className="w-4 h-4" />商品追加
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
              <EditableRow<Product>
                item={{ name: '', price: 0, description: '' }}
                fields={fields}
                onSave={(d) => handleSave(d, true)}
                onCancel={() => setAdding(false)}
              />
            )}
            {products.map((p) =>
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
// メインコンポーネント
// ============================================================
const TABS: { key: Tab; label: string }[] = [
  { key: 'plans', label: 'プラン' },
  { key: 'options', label: 'オプション' },
  { key: 'products', label: '商品' },
  { key: 'staff', label: 'スタッフ' },
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
    </div>
  );
}
