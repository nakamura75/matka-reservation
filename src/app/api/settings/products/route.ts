import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProducts, createProduct, updateProduct } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const products = await getProducts();
  return NextResponse.json({ success: true, data: products });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const product = {
      id: generateId(),
      name: body.name,
      price: Number(body.price),
      description: body.description ?? '',
      isActive: body.isActive ?? true,
      commissionPrice: Number(body.commissionPrice) || 0,
    };
    await createProduct(product);
    return NextResponse.json({ success: true, data: product });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await updateProduct(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
