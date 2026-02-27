'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '8px 20px',
        background: '#1f2937',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      印刷 / PDF保存
    </button>
  );
}
