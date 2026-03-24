import { createAdminClient } from './supabase/admin';
import type {
  Customer,
  Plan,
  Option,
  Product,
  Staff,
  Reservation,
  ReservationOption,
  Order,
  OrderItem,
  SalesRecord,
  Holiday,
  BlockedSlot,
} from '@/types';

// ============================================================
// Supabaseクライアント（service_role: RLSバイパス）
// API Routes / Server Components / Cron / Webhook すべてで使用
// ============================================================
function supabase() {
  return createAdminClient();
}

// ============================================================
// snake_case ⇔ camelCase 変換ヘルパー
// ============================================================

function dbToCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id as string,
    name: r.name as string,
    furigana: r.furigana as string | undefined,
    phone: r.phone as string,
    email: r.email as string | undefined,
    zipCode: r.zip_code as string | undefined,
    address: r.address as string | undefined,
    lineName: r.line_name as string | undefined,
    lineUserId: r.line_user_id as string | undefined,
    chatLineUserId: r.chat_line_user_id as string | undefined,
    note: r.note as string | undefined,
    createdAt: r.created_at as string | undefined,
  };
}

function customerToDb(c: Partial<Customer>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (c.id !== undefined) m.id = c.id;
  if (c.name !== undefined) m.name = c.name;
  if (c.furigana !== undefined) m.furigana = c.furigana;
  if (c.phone !== undefined) m.phone = c.phone;
  if (c.email !== undefined) m.email = c.email;
  if (c.zipCode !== undefined) m.zip_code = c.zipCode;
  if (c.address !== undefined) m.address = c.address;
  if (c.lineName !== undefined) m.line_name = c.lineName;
  if (c.lineUserId !== undefined) m.line_user_id = c.lineUserId;
  if (c.chatLineUserId !== undefined) m.chat_line_user_id = c.chatLineUserId;
  if (c.note !== undefined) m.note = c.note;
  if (c.createdAt !== undefined) m.created_at = c.createdAt;
  return m;
}

function dbToReservation(r: Record<string, unknown>): Reservation {
  const status = r.status as string;
  const date = r.date as string;

  // 予約確定済で予約日が過ぎていたら自動的に完了扱い
  let effectiveStatus = status;
  if (status === '予約確定' && date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) effectiveStatus = '完了';
  }

  const calendarEventId = r.calendar_event_id as string | undefined;

  return {
    id: r.id as string,
    customerId: r.customer_id as string,
    planId: r.plan_id as string,
    paymentStatus: r.payment_status as boolean,
    paymentDate: r.payment_date as string | undefined,
    date: date,
    timeSlot: (r.time_slot ?? '9:00') as Reservation['timeSlot'],
    childrenCount: r.children_count as number | undefined,
    adultCount: r.adult_count as string | undefined,
    familyNote: r.family_note as string | undefined,
    status: effectiveStatus as Reservation['status'],
    referencePhoto: r.reference_photo as string | undefined,
    note: r.note as string | undefined,
    createdAt: r.created_at as string | undefined,
    lineUserId: r.line_user_id as string | undefined,
    flag: r.flag as boolean | undefined,
    phonePreference: r.phone_preference as string | undefined,
    scene: r.scene as Reservation['scene'],
    reservationNumber: r.reservation_number as string | undefined,
    discountAmount: (r.discount_amount as number) || 0,
    discountReason: r.discount_reason as string | undefined,
    discountRate: (r.discount_rate as number) || 0,
    checkInTime: r.check_in_time as string | undefined,
    checkOutTime: r.check_out_time as string | undefined,
    calendarEventId: calendarEventId,
    pdfUrl: calendarEventId?.startsWith('http') ? calendarEventId : (r.pdf_url as string | undefined),
    staffAssignmentJson: r.staff_assignment_json as string | undefined,
    customerNote: r.customer_note as string | undefined,
    otherSceneNote: r.other_scene_note as string | undefined,
    chatLineUserId: r.chat_line_user_id as string | undefined,
    paymentMethod: r.payment_method as string | undefined,
    snsPermission: r.sns_permission as string | undefined,
  };
}

function reservationToDb(r: Partial<Reservation>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (r.id !== undefined) m.id = r.id;
  if (r.customerId !== undefined) m.customer_id = r.customerId;
  if (r.planId !== undefined) m.plan_id = r.planId;
  if (r.paymentStatus !== undefined) m.payment_status = r.paymentStatus;
  if (r.paymentDate !== undefined) m.payment_date = r.paymentDate;
  if (r.date !== undefined) m.date = r.date;
  if (r.timeSlot !== undefined) m.time_slot = r.timeSlot;
  if (r.childrenCount !== undefined) m.children_count = r.childrenCount;
  if (r.adultCount !== undefined) m.adult_count = r.adultCount;
  if (r.familyNote !== undefined) m.family_note = r.familyNote;
  if (r.status !== undefined) m.status = r.status;
  if (r.referencePhoto !== undefined) m.reference_photo = r.referencePhoto;
  if (r.note !== undefined) m.note = r.note;
  if (r.createdAt !== undefined) m.created_at = r.createdAt;
  if (r.lineUserId !== undefined) m.line_user_id = r.lineUserId;
  if (r.flag !== undefined) m.flag = r.flag;
  if (r.phonePreference !== undefined) m.phone_preference = r.phonePreference;
  if (r.scene !== undefined) m.scene = r.scene;
  if (r.reservationNumber !== undefined) m.reservation_number = r.reservationNumber;
  if (r.discountAmount !== undefined) m.discount_amount = r.discountAmount;
  if (r.discountReason !== undefined) m.discount_reason = r.discountReason;
  if (r.discountRate !== undefined) m.discount_rate = r.discountRate;
  if (r.checkInTime !== undefined) m.check_in_time = r.checkInTime;
  if (r.checkOutTime !== undefined) m.check_out_time = r.checkOutTime;
  if (r.calendarEventId !== undefined) m.calendar_event_id = r.calendarEventId;
  if (r.pdfUrl !== undefined) m.pdf_url = r.pdfUrl;
  if (r.staffAssignmentJson !== undefined) m.staff_assignment_json = r.staffAssignmentJson;
  if (r.customerNote !== undefined) m.customer_note = r.customerNote;
  if (r.otherSceneNote !== undefined) m.other_scene_note = r.otherSceneNote;
  if (r.chatLineUserId !== undefined) m.chat_line_user_id = r.chatLineUserId;
  if (r.paymentMethod !== undefined) m.payment_method = r.paymentMethod;
  if (r.snsPermission !== undefined) m.sns_permission = r.snsPermission;
  return m;
}

// ============================================================
// 顧客
// ============================================================

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase()
    .from('customers')
    .select('*')
    .order('furigana', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(dbToCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await supabase()
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return dbToCustomer(data);
}

export async function createCustomer(data: Customer): Promise<Customer> {
  const row = customerToDb(data);
  if (!row.created_at) row.created_at = new Date().toLocaleDateString('ja-JP');
  const { error } = await supabase().from('customers').insert(row);
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(data: Customer): Promise<void> {
  const { id, ...rest } = data;
  const row = customerToDb(rest);
  const { error } = await supabase().from('customers').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase().from('customers').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// プラン
// ============================================================

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase()
    .from('plans')
    .select('*')
    .order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    duration: r.duration,
    description: r.description,
    isActive: r.is_active,
  }));
}

export async function createPlan(data: Plan): Promise<void> {
  const { error } = await supabase().from('plans').insert({
    id: data.id,
    name: data.name,
    price: data.price,
    duration: data.duration,
    description: data.description ?? '',
    is_active: data.isActive,
  });
  if (error) throw error;
}

export async function updatePlan(data: Plan): Promise<void> {
  const { error } = await supabase().from('plans').update({
    name: data.name,
    price: data.price,
    duration: data.duration,
    description: data.description ?? '',
    is_active: data.isActive,
  }).eq('id', data.id);
  if (error) throw error;
}

// ============================================================
// オプション
// ============================================================

export async function getOptions(): Promise<Option[]> {
  const { data, error } = await supabase()
    .from('options')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    description: r.description,
    isActive: r.is_active,
    externalCode: r.external_code,
    showInForm: r.show_in_form ?? true,
  }));
}

export async function createOption(data: Option): Promise<void> {
  const { error } = await supabase().from('options').insert({
    id: data.id,
    name: data.name,
    price: data.price,
    description: data.description ?? '',
    is_active: data.isActive,
    external_code: data.externalCode ?? '',
    show_in_form: data.showInForm ?? true,
  });
  if (error) throw error;
}

export async function updateOption(data: Option): Promise<void> {
  const { error } = await supabase().from('options').update({
    name: data.name,
    price: data.price,
    description: data.description ?? '',
    is_active: data.isActive,
    external_code: data.externalCode ?? '',
    show_in_form: data.showInForm ?? true,
  }).eq('id', data.id);
  if (error) throw error;
}

// ============================================================
// スタッフ
// ============================================================

export async function getStaff(): Promise<Staff[]> {
  const { data, error } = await supabase()
    .from('staff')
    .select('*')
    .order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    role: r.role,
  }));
}

export async function createStaff(data: Staff): Promise<void> {
  const { error } = await supabase().from('staff').insert({
    id: data.id,
    name: data.name,
    is_active: data.isActive ?? 'TRUE',
    role: data.role ?? '',
  });
  if (error) throw error;
}

export async function updateStaff(data: Staff): Promise<void> {
  const { error } = await supabase().from('staff').update({
    name: data.name,
    is_active: data.isActive ?? 'TRUE',
    role: data.role ?? '',
  }).eq('id', data.id);
  if (error) throw error;
}

// ============================================================
// 予約
// ============================================================

export async function getReservations(opts?: { fromDate?: string; toDate?: string }): Promise<Reservation[]> {
  let query = supabase()
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: true });
  if (opts?.fromDate) query = query.gte('date', opts.fromDate);
  if (opts?.toDate) query = query.lte('date', opts.toDate);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(dbToReservation);
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const { data, error } = await supabase()
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return dbToReservation(data);
}

/** 同日同時間に既存予約（キャンセル・見学以外）があるか確認 */
export async function checkSlotConflict(date: string, timeSlot: string, excludeId?: string): Promise<boolean> {
  let query = supabase()
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .eq('time_slot', timeSlot)
    .not('status', 'in', '("キャンセル","見学","保留")');
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function createReservation(data: Reservation): Promise<void> {
  const row = reservationToDb(data);
  const { error } = await supabase().from('reservations').insert(row);
  if (error) throw error;
}

export async function updateReservation(
  id: string,
  fields: Partial<Reservation>
): Promise<void> {
  const row = reservationToDb(fields);
  const { error } = await supabase().from('reservations').update(row).eq('id', id);
  if (error) throw error;
}

export async function updateReservationStatus(
  id: string,
  status: Reservation['status'],
  lineUserId?: string
): Promise<void> {
  const fields: Partial<Reservation> = { status };
  if (lineUserId) fields.lineUserId = lineUserId;
  await updateReservation(id, fields);
}

export async function updateCalendarEventId(id: string, calendarEventId: string): Promise<void> {
  await updateReservation(id, { calendarEventId });
}

export async function getReservationByNumber(reservationNumber: string): Promise<Reservation | null> {
  const { data, error } = await supabase()
    .from('reservations')
    .select('*')
    .eq('reservation_number', reservationNumber)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return dbToReservation(data);
}

export async function linkLineUserId(id: string, lineUserId: string): Promise<void> {
  await updateReservation(id, { lineUserId, flag: true });
}

export async function saveChatLineUserId(id: string, chatLineUserId: string): Promise<void> {
  await updateReservation(id, { chatLineUserId });
}

// ============================================================
// 予約オプション
// ============================================================

export async function getReservationOptions(reservationId?: string): Promise<ReservationOption[]> {
  let query = supabase()
    .from('reservation_options')
    .select('*')
    .order('id');
  if (reservationId) {
    query = query.eq('reservation_id', reservationId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    reservationId: r.reservation_id,
    optionId: r.option_id,
    quantity: r.quantity,
    note: r.note,
  }));
}

export async function createReservationOption(
  data: Omit<ReservationOption, 'subtotal' | 'commissionAmount'>
): Promise<void> {
  const { error } = await supabase().from('reservation_options').insert({
    id: data.id,
    reservation_id: data.reservationId,
    option_id: data.optionId,
    quantity: data.quantity,
    note: data.note ?? '',
  });
  if (error) throw error;
}

export async function deleteReservationOption(id: string): Promise<void> {
  const { error } = await supabase().from('reservation_options').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteReservation(id: string): Promise<void> {
  // 関連するreservation_optionsを先に削除
  await supabase().from('reservation_options').delete().eq('reservation_id', id);
  const { error } = await supabase().from('reservations').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 注文
// ============================================================

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase()
    .from('orders')
    .select('*')
    .order('order_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    reservationId: r.reservation_id,
    orderDate: r.order_date,
    isPaid: r.is_paid,
    paidDate: r.paid_date,
    note: r.note,
    flag: r.flag,
    deadline: r.deadline as string | undefined,
  }));
}

export async function createOrder(data: Omit<Order, 'items'>): Promise<void> {
  const row: Record<string, unknown> = {
    id: data.id,
    customer_id: data.customerId,
    reservation_id: data.reservationId ?? '',
    order_date: data.orderDate,
    is_paid: data.isPaid,
    paid_date: data.paidDate ?? '',
    note: data.note ?? '',
    flag: data.flag ?? false,
  };
  if (data.deadline) row.deadline = data.deadline;
  const { error } = await supabase().from('orders').insert(row);
  if (error) throw error;
}

export async function updateOrder(
  id: string,
  fields: { isPaid?: boolean; paidDate?: string; note?: string; deadline?: string }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (fields.isPaid !== undefined) {
    row.is_paid = fields.isPaid;
    if (fields.isPaid && fields.paidDate) row.paid_date = fields.paidDate;
  }
  if (fields.note !== undefined) row.note = fields.note;
  if (fields.deadline !== undefined) row.deadline = fields.deadline;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase().from('orders').update(row).eq('id', id);
  if (error) throw error;
}

// ============================================================
// 注文詳細
// ============================================================

export async function getOrderItems(orderId?: string): Promise<OrderItem[]> {
  let query = supabase()
    .from('order_items')
    .select('*')
    .order('id');
  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    customerId: r.customer_id,
    quantity: r.quantity,
    status: r.status as OrderItem['status'],
    selectedDate: r.selected_date as string | undefined,
    layoutDate: r.layout_date as string | undefined,
    orderedDate: r.ordered_date,
    packedDate: r.packed_date as string | undefined,
    shippedDate: r.shipped_date,
    trackingNumber: r.tracking_number,
    note: r.note,
  }));
}

export async function createOrderItem(
  data: Omit<OrderItem, 'subtotal' | 'commissionAmount'>
): Promise<void> {
  const { error } = await supabase().from('order_items').insert({
    id: data.id,
    order_id: data.orderId,
    product_id: data.productId,
    customer_id: data.customerId ?? '',
    quantity: data.quantity,
    status: data.status,
    selected_date: data.selectedDate ?? '',
    layout_date: data.layoutDate ?? '',
    ordered_date: data.orderedDate ?? '',
    packed_date: data.packedDate ?? '',
    shipped_date: data.shippedDate ?? '',
    tracking_number: data.trackingNumber ?? '',
    note: data.note ?? '',
  });
  if (error) throw error;
}

export async function updateOrderItem(
  id: string,
  fields: {
    status?: OrderItem['status'];
    selectedDate?: string;
    layoutDate?: string;
    orderedDate?: string;
    packedDate?: string;
    shippedDate?: string;
    trackingNumber?: string;
    note?: string;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.selectedDate !== undefined) row.selected_date = fields.selectedDate;
  if (fields.layoutDate !== undefined) row.layout_date = fields.layoutDate;
  if (fields.orderedDate !== undefined) row.ordered_date = fields.orderedDate;
  if (fields.packedDate !== undefined) row.packed_date = fields.packedDate;
  if (fields.shippedDate !== undefined) row.shipped_date = fields.shippedDate;
  if (fields.trackingNumber !== undefined) row.tracking_number = fields.trackingNumber;
  if (fields.note !== undefined) row.note = fields.note;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase().from('order_items').update(row).eq('id', id);
  if (error) throw error;
}

// ============================================================
// 商品
// ============================================================

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase()
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    image: r.image,
    description: r.description,
    isActive: r.is_active,
    sortOrder: r.sort_order ?? 0,
  }));
}

export async function createProduct(data: Product): Promise<void> {
  const { error } = await supabase().from('products').insert({
    id: data.id,
    name: data.name,
    price: data.price,
    image: data.image ?? '',
    description: data.description ?? '',
    is_active: data.isActive,
    sort_order: data.sortOrder ?? 0,
  });
  if (error) throw error;
}

export async function updateProduct(data: Product): Promise<void> {
  const { error } = await supabase().from('products').update({
    name: data.name,
    price: data.price,
    image: data.image ?? '',
    description: data.description ?? '',
    is_active: data.isActive,
    sort_order: data.sortOrder ?? 0,
  }).eq('id', data.id);
  if (error) throw error;
}

export async function updateProductSortOrders(items: { id: string; sortOrder: number }[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase().from('products').update({
      sort_order: item.sortOrder,
    }).eq('id', item.id);
    if (error) throw error;
  }
}

// ============================================================
// 売上明細
// ============================================================

export async function getSalesRecords(): Promise<SalesRecord[]> {
  const { data, error } = await supabase()
    .from('sales')
    .select('*')
    .order('id');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    paymentId: r.payment_id,
    paymentDateTime: r.payment_date_time,
    reservationId: r.reservation_id,
    productName: r.product_name,
    category: r.category,
    amount: r.amount,
    staffId: r.staff_id,
  }));
}

// ============================================================
// 祝日
// ============================================================

export async function getHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase()
    .from('holidays')
    .select('id, date, name, type')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Holiday[];
}

export async function createHoliday(holiday: Omit<Holiday, 'id'> & { id: string }): Promise<void> {
  const { error } = await supabase().from('holidays').insert(holiday);
  if (error) throw error;
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await supabase().from('holidays').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ブロック枠（休業日）
// ============================================================

export async function getBlockedSlots(): Promise<BlockedSlot[]> {
  const { data, error } = await supabase()
    .from('blocked_slots')
    .select('id, date, time_slot, reason')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    timeSlot: r.time_slot,
    reason: r.reason,
  }));
}

export async function createBlockedSlot(slot: { id: string; date: string; time_slot?: string | null; reason?: string | null }): Promise<void> {
  const { error } = await supabase().from('blocked_slots').insert(slot);
  if (error) throw error;
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  const { error } = await supabase().from('blocked_slots').delete().eq('id', id);
  if (error) throw error;
}
