import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, items, total, paymentMethod } = body;

    // --- 本来はここで SendGrid や Nodemailer を使ってメールを送ります ---
    // 今回はデモとして、サーバーのコンソールにメール内容を表示します
    console.log('=========================================');
    console.log(`【注文確認メール送信】 To: ${email}`);
    console.log(`お客様名: ${name} 様`);
    console.log(`支払方法: ${paymentMethod}`);
    console.log(`合計金額: ¥${total.toLocaleString()}`);
    console.log('注文商品:');
    items.forEach((item: any) => {
        console.log(` - ${item.name}`);
    });
    console.log('=========================================');
    // ---------------------------------------------------------------

    // 成功レスポンスを返す
    return NextResponse.json({ message: 'Email sent successfully' });

  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}