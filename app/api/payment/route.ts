import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, amount } = body;

    console.log("決済開始: ", { sourceId, amount });

    // Sandbox環境のエンドポイント
    const url = 'https://connect.squareupsandbox.com/v2/payments';
    
    // 本番環境の場合はこちらに切り替える必要があります
    // const url = 'https://connect.squareup.com/v2/payments';

    // ライブラリを使わず、直接fetchでSquare APIを叩く
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, // .env.localからトークン読み込み
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(), // 重複決済防止キー
        source_id: sourceId,
        amount_money: {
          amount: amount, // 金額 (数値のままでOK)
          currency: 'JPY',
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Square側からエラーが返ってきた場合
      console.error("Square API Error:", result);
      throw new Error(result.errors ? result.errors[0].detail : 'Square payment failed');
    }

    console.log("決済成功: ", result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("サーバー内部エラー:", error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}