'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Truck, MapPin, ShieldCheck, Lock, Mail, Landmark } from 'lucide-react';
import Link from 'next/link';
import { PaymentForm, CreditCard as SquareCard } from 'react-square-web-payments-sdk';

// === カート画面と同じバリエーション定義 (計算用) ===
const VARIANTS: Record<string, { [key: string]: { label: string; extraPrice: number } }> = {
  tshirt: {
    xs: { label: 'XS', extraPrice: 0 },
    s: { label: 'S', extraPrice: 0 },
    m: { label: 'M', extraPrice: 0 },
    l: { label: 'L', extraPrice: 0 },
    xl: { label: 'XL', extraPrice: 0 },
  },
  tote: {
    standard: { label: 'フリーサイズ', extraPrice: 0 },
  },
  acsta: {
    '5x5': { label: '5×5cm', extraPrice: 0 },
    '10x10': { label: '10×10cm', extraPrice: 200 },
    '15x15': { label: '15×15cm', extraPrice: 350 },
    '20x20': { label: '20×20cm', extraPrice: 420 },
  },
  badge: {
    '32mm': { label: '小(φ32㎜)', extraPrice: 0 },
    '44mm': { label: '中(φ44㎜)', extraPrice: 50 },
    '57mm': { label: '大(φ57㎜)', extraPrice: 70 },
    '76mm': { label: 'メガ(φ76㎜)', extraPrice: 100 },
  },
};

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [amounts, setAmounts] = useState({ subtotal: 0, shipping: 0, total: 0 });
  
  // フォーム入力用
  const [formData, setFormData] = useState({
    lastName: '', firstName: '', email: '',
    postalCode: '', prefecture: '東京都', address: '', phone: ''
  });

  // 環境変数の読み込み
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  // === 金額計算ロジック ===
  const calculateItemTotal = (item: any) => {
    let total = 0;
    let printFee = 0;
    if (item.chargesPerPrint) {
        const front = item.originalImageFront || item.designs?.front?.image;
        const back = item.originalImageBack || item.designs?.back?.image;
        if (front) printFee += 1000;
        if (back) printFee += 1000;
    }
    
    const basePrice = item.price + printFee;
    const variants = VARIANTS[item.productId] || {};

    if (item.quantities) {
        Object.keys(item.quantities).forEach(key => {
            const qty = item.quantities[key];
            const extra = variants[key]?.extraPrice || 0;
            total += qty * (basePrice + extra);
        });
    } else {
        total = basePrice * (item.quantity || 1);
    }

    return total;
  };

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) {
      const items = JSON.parse(stored);
      
      let subtotal = 0;
      items.forEach((item: any) => {
          subtotal += calculateItemTotal(item);
      });

      const shipping = subtotal > 5000 ? 0 : 600;
      setAmounts({ subtotal, shipping, total: subtotal + shipping });
      setCartItems(items);
    }
  }, []);

  // 1. 注文情報をSupabase(データベース)に保存
  const saveOrderToDb = async () => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: formData,
          items: cartItems,
          total: amounts.total,
          paymentMethod: paymentMethod === 'credit' ? 'クレジットカード' : paymentMethod === 'bank' ? '銀行振込' : '代金引換'
        }),
      });
      
      if (!response.ok) {
         const errorData = await response.json();
         console.error('DB Save Error:', errorData);
         throw new Error('注文情報の保存に失敗しました');
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // 2. 注文完了メール送信 (ログ出力)
  const sendOrderEmail = async () => {
    await fetch('/api/send-order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        name: `${formData.lastName} ${formData.firstName}`,
        items: cartItems,
        total: amounts.total,
        paymentMethod: paymentMethod === 'credit' ? 'クレジットカード' : paymentMethod === 'bank' ? '銀行振込' : '代金引換'
      }),
    });
  };

  // 注文確定処理 (代引き・銀行振込)
  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
        alert('メールアドレスを入力してください');
        return;
    }

    // DB保存
    const isSaved = await saveOrderToDb();
    if (!isSaved) {
        alert('注文処理中にエラーが発生しました（DB保存失敗）。');
        return;
    }

    // メール送信
    await sendOrderEmail();

    alert(`ご注文ありがとうございます！\n確認メールを ${formData.email} 宛に送信しました。`);
    localStorage.removeItem('cart');
    window.location.href = '/';
  };

  // Square決済成功時の処理
  const handleCardPayment = async (token: any) => {
    try {
      if (!formData.email) {
        alert('メールアドレスを入力してください');
        return;
      }

      // Square決済実行
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: token.token,
          amount: amounts.total,
        }),
      });

      if (response.ok) {
        // 決済成功 -> DB保存 -> メール送信
        await saveOrderToDb();
        await sendOrderEmail();

        alert('決済が完了しました！ご注文ありがとうございます。');
        localStorage.removeItem('cart');
        window.location.href = '/';
      } else {
        alert('決済に失敗しました。カード情報をご確認ください。');
      }
    } catch (error) {
      console.error(error);
      alert('通信エラーが発生しました。');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center">
          <Link href="/cart" className="text-gray-500 hover:text-black mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-xl">ご注文手続き</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        
        {/* === 左カラム: 入力フォーム === */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. 配送先情報 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-lg mb-4 flex items-center text-gray-800">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" /> お届け先情報
            </h2>
            <form id="order-form" onSubmit={handleOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">姓</label>
                  <input name="lastName" type="text" placeholder="山田" required className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">名</label>
                  <input name="firstName" type="text" placeholder="太郎" required className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                   <input name="email" type="email" placeholder="yamada@example.com" required className="w-full border border-gray-300 rounded-lg p-2 pl-10 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
                </div>
                <p className="text-xs text-gray-400 mt-1">※ご注文内容の確認メールをお送りします</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">郵便番号</label>
                <input name="postalCode" type="text" placeholder="123-4567" required className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">都道府県</label>
                <select name="prefecture" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white" onChange={handleInputChange}>
                  <option>東京都</option>
                  <option>大阪府</option>
                  <option>北海道</option>
                  {/* 他の県も必要に応じて追加 */}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">住所</label>
                <input name="address" type="text" placeholder="市区町村・番地" required className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">電話番号</label>
                <input name="phone" type="tel" placeholder="090-0000-0000" required className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" onChange={handleInputChange} />
              </div>
            </form>
          </section>

          {/* 2. 配送方法 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-lg mb-4 flex items-center text-gray-800">
              <Truck className="w-5 h-5 mr-2 text-blue-600" /> 配送方法
            </h2>
            <div className="space-y-3">
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors bg-blue-50 border-blue-200">
                <input type="radio" name="shipping" defaultChecked className="w-4 h-4 text-blue-600" />
                <div className="ml-3 flex-1">
                  <span className="block font-bold text-sm text-gray-800">通常配送</span>
                  <span className="block text-xs text-gray-500">5~10営業日でお届け</span>
                </div>
                <span className="text-sm font-bold text-gray-800">¥{amounts.shipping.toLocaleString()}</span>
              </label>
            </div>
          </section>

          {/* 3. お支払い方法 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-lg mb-4 flex items-center text-gray-800">
              <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> お支払い方法
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <button 
                type="button" onClick={() => setPaymentMethod('credit')}
                className={`p-4 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'credit' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'hover:bg-gray-50'}`}
              >
                <span className="font-bold text-lg mb-1">Square</span>
                <span className="text-xs text-gray-500">カード決済</span>
              </button>
              
              <button 
                type="button" onClick={() => setPaymentMethod('bank')}
                className={`p-4 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'bank' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'hover:bg-gray-50'}`}
              >
                <span className="font-bold text-lg mb-1"><Landmark className="w-6 h-6"/></span>
                <span className="text-xs text-gray-500">銀行振込</span>
              </button>

              <button 
                type="button" onClick={() => setPaymentMethod('cod')}
                className={`p-4 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'cod' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'hover:bg-gray-50'}`}
              >
                <span className="font-bold text-lg mb-1">¥</span>
                <span className="text-xs text-gray-500">代金引換</span>
              </button>
            </div>

            {/* Square決済フォーム */}
            {paymentMethod === 'credit' && (
              <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                 <p className="text-sm font-bold text-gray-700 mb-4">クレジットカード情報を入力</p>
                 
                 {appId && locationId ? (
                   <PaymentForm
                      applicationId={appId}
                      locationId={locationId}
                      cardTokenizeResponseReceived={handleCardPayment}
                   >
                      <SquareCard
                         buttonProps={{
                            css: {
                               backgroundColor: '#000',
                               fontSize: '14px',
                               color: 'transparent', // 文字を透明に
                               position: 'relative',
                               '&:hover': { backgroundColor: '#333' },
                               '&::after': {
                                  content: '"お支払いを確定する"', // 日本語を擬似要素で表示
                                  color: '#fff',
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: '100%',
                                  textAlign: 'center',
                               },
                            },
                         }}
                      />
                   </PaymentForm>
                 ) : (
                   <div className="text-red-500 text-sm border border-red-200 bg-red-50 p-4 rounded">
                     <p className="font-bold">設定エラー</p>
                     SquareのIDが設定されていません。.env.localファイルを確認して再起動してください。
                   </div>
                 )}

                 <div className="mt-4 text-[10px] text-gray-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    情報はSSLで暗号化されSquareへ直接送信されます
                 </div>
              </div>
            )}
            
            {/* 銀行振込情報 */}
            {paymentMethod === 'bank' && (
               <div className="mt-6 p-6 bg-blue-50 rounded-lg border border-blue-100 text-sm text-gray-700 space-y-4">
                  <div className="flex items-start gap-3">
                     <Landmark className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                     <div>
                        <p className="font-bold text-blue-800 mb-2">振込先口座</p>
                        <ul className="space-y-1">
                           <li>銀行名：<strong>住信SBIネット銀行</strong></li>
                           <li>支店名：<strong>法人第一支店</strong></li>
                           <li>種類　：<strong>普通</strong></li>
                           <li>番号　：<strong>1525264</strong></li>
                           <li>名義　：<strong>特定非営利活動法人山正</strong></li>
                        </ul>
                     </div>
                  </div>
                  <div className="text-xs text-gray-500 border-t border-blue-200 pt-3">
                     <p>※振込手数料はお客様のご負担となります。</p>
                     <p className="font-bold text-red-500 mt-1">※ご入金確認後の制作開始となります。</p>
                  </div>
               </div>
            )}

            {/* 代金引換情報 */}
            {paymentMethod === 'cod' && (
              <div className="p-4 bg-gray-100 text-gray-600 text-sm rounded-lg mt-6">
                 商品受け取り時に、配達員へ現金でお支払いください。<br/>
                 ※別途代引手数料がかかる場合があります。
              </div>
            )}
          </section>
        </div>

        {/* === 右カラム: 注文サマリー === */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 sticky top-24">
            <h3 className="font-bold text-lg mb-6 pb-4 border-b text-gray-800">注文内容の確認</h3>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm text-gray-600">
                <span>小計</span>
                <span>¥{amounts.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>送料</span>
                <span>¥{amounts.shipping.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-end border-t pt-4 mb-8">
              <span className="font-bold text-gray-800">お支払い合計</span>
              <span className="text-2xl font-bold text-blue-600">¥{amounts.total.toLocaleString()}</span>
            </div>
            
            {/* Square (credit) の場合は、フォーム内のボタンを使うため、ここのボタンは非表示 */}
            {paymentMethod !== 'credit' ? (
                <button 
                  type="submit" 
                  form="order-form" // フォームIDと紐付け
                  className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <ShieldCheck className="w-5 h-5" />
                  注文を確定する
                </button>
            ) : (
                <div className="text-center text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                   左側のカード情報を入力し<br/>黒い「お支払いを確定する」ボタンを押してください
                </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}