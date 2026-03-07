import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ success: true, data: products });
  } catch (err) {
    console.error('GET /api/products error:', err);
    return NextResponse.json({ success: true, data: [] });
  }
}
