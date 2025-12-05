import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer, items, total, paymentMethod } = body;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: `${customer.lastName} ${customer.firstName}`,
        email: customer.email,
        phone: customer.phone,
        address_full: `〒${customer.postalCode} ${customer.prefecture} ${customer.address}`,
        payment_method: paymentMethod,
        total_amount: total
      })
      .select()
      .single();

    if (orderError) throw orderError;

    for (const item of items) {
      // オプション詳細を文字列化
      const optionDetail = JSON.stringify({
        quantities: item.quantities,
        color: item.color,
        // 画像URLはすでにSupabaseにあるので、そのまま保存
        images: {
            thumb: item.image,
            thumbBack: item.imageBack,
            original_front: item.originalImageFront,
            original_back: item.originalImageBack
        }
      });

      await supabase.from('order_items').insert({
        order_id: order.id,
        product_name: item.name,
        quantity: 1,
        price: item.totalPrice || item.price,
        option_detail: optionDetail,
        image_url: item.image // 一覧用
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error: any) {
    console.error('Order save failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}