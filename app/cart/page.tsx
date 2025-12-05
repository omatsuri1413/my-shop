'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, ArrowRight, ArrowLeft, ShoppingBag, XCircle, HelpCircle } from 'lucide-react';
import Link from 'next/link';

// === バリエーション・追加料金定義 ===
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

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  // ★追加: ホバー中の商品IDを管理するState
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) {
      const parsed = JSON.parse(stored).map((item: any) => {
        if (!item.quantities) {
          let defaultKey = 'standard';
          if (item.productId === 'tshirt') defaultKey = 'm';
          if (item.productId === 'badge') defaultKey = '57mm';
          if (item.productId === 'acsta') defaultKey = '10x10';
          item.quantities = { [defaultKey]: item.quantity || 1 };
        }
        return item;
      });
      setCartItems(parsed);
    }
  }, []);

  const saveCart = (newItems: any[]) => {
    setCartItems(newItems);
    localStorage.setItem('cart', JSON.stringify(newItems));
    window.dispatchEvent(new Event('focus')); 
  };

  const updateQuantity = (itemId: number, variantKey: string, delta: number) => {
    const newItems = cartItems.map((item) => {
      if (item.id === itemId) {
        const currentQty = item.quantities[variantKey] || 0;
        const newQty = Math.max(0, currentQty + delta);
        const newQuantities = { ...item.quantities, [variantKey]: newQty };
        return { ...item, quantities: newQuantities };
      }
      return item;
    });
    saveCart(newItems);
  };

  const removeItem = (id: number) => {
    if (confirm('このデザインをカートから削除しますか？')) {
      const newItems = cartItems.filter(item => item.id !== id);
      saveCart(newItems);
    }
  };

  const clearCart = () => {
    if (confirm('カートの中身をすべて削除してもよろしいですか？')) {
      setCartItems([]);
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('focus'));
    }
  };

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

    Object.keys(item.quantities).forEach(key => {
      const qty = item.quantities[key];
      const extra = variants[key]?.extraPrice || 0;
      total += qty * (basePrice + extra);
    });

    return total;
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const shipping = cartTotal > 5000 ? 0 : 600;
  const grandTotal = cartTotal + shipping;
  const totalItemsCount = cartItems.reduce((sum, item) => sum + Object.values(item.quantities as Record<string, number>).reduce((a, b) => a + b, 0), 0);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-2xl shadow-sm text-center max-w-md w-full">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">カートは空です</h2>
          <Link href="/" className="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition mt-6">
            商品一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-xl flex items-center">
            <ShoppingBag className="w-5 h-5 mr-2" /> ショッピングカート
          </h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-black font-medium">
            買い物を続ける
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左カラム: カート内容 + FAQ */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* カート商品リスト */}
          <div className="space-y-6">
            {cartItems.map((item) => {
               const variants = VARIANTS[item.productId] || {};
               const itemTotal = calculateItemTotal(item);
               const totalQty = Object.values(item.quantities as Record<string, number>).reduce((a, b) => a + b, 0);
               const printSides = [item.originalImageFront || item.designs?.front?.image, item.originalImageBack || item.designs?.back?.image].filter(Boolean).length;

               return (
                <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 items-start">
                  
                  {/* ★修正: ホバーで裏面画像に切り替える機能 */}
                  <div 
                    className="w-32 h-32 bg-gray-50 rounded-lg flex-shrink-0 border overflow-hidden flex items-center justify-center relative cursor-pointer group"
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <img 
                      src={
                        // ホバー中かつ裏面画像があるなら裏面を表示
                        (hoveredItem === item.id && item.imageBack) 
                          ? item.imageBack 
                          : item.image
                      } 
                      alt={item.name} 
                      className="w-full h-full object-contain p-2 transition-opacity duration-300" 
                    />
                    {/* 裏面がある場合に「Turn」バッジを表示 */}
                    {item.imageBack && (
                      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Turn
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
                        {item.color && <span className="text-xs inline-block mt-1 bg-gray-100 px-2 py-1 rounded text-gray-600 mr-2">カラー: {item.color}</span>}
                        <div className="text-xs text-gray-500 mt-1">
                          <span>基本単価: ¥{item.price.toLocaleString()}</span>
                          {item.chargesPerPrint && printSides > 0 && (
                            <span className="ml-2 text-blue-600 font-medium">
                              + プリント代: ¥{(printSides * 1000).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition p-2">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                       <div className={`grid gap-x-6 gap-y-4 ${Object.keys(variants).length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
                          {Object.keys(variants).map((key) => {
                             const variant = variants[key];
                             const qty = item.quantities[key] || 0;
                             return (
                               <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold text-gray-700">{variant.label}</span>
                                     {variant.extraPrice > 0 && (
                                       <span className="text-[10px] text-blue-500 font-medium">+¥{variant.extraPrice}</span>
                                     )}
                                  </div>
                                  <div className="flex items-center border rounded bg-white shadow-sm h-8 w-24 ml-auto sm:ml-0">
                                     <button onClick={() => updateQuantity(item.id, key, -1)} className="w-8 h-full flex items-center justify-center hover:bg-gray-100 text-gray-500 disabled:opacity-30" disabled={qty <= 0}><Minus className="w-3 h-3"/></button>
                                     <span className="flex-1 text-center text-sm font-bold">{qty}</span>
                                     <button onClick={() => updateQuantity(item.id, key, 1)} className="w-8 h-full flex items-center justify-center hover:bg-gray-100 text-gray-500"><Plus className="w-3 h-3"/></button>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    </div>

                    <div className="text-right mt-4 flex justify-end items-baseline gap-2">
                      <div className="text-xs text-gray-500">小計 ({totalQty}点)</div>
                      <div className="text-xl font-bold text-gray-900">¥{itemTotal.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* よくあるご質問セクション */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-lg mb-6 flex items-center text-gray-800">
                <HelpCircle className="w-5 h-5 mr-2 text-blue-500" />
                よくあるご質問
             </h3>
             <div className="space-y-8">
                <div>
                   <h4 className="font-bold text-gray-700 mb-2 text-sm">Q. 納期について</h4>
                   <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
                      通常、ご注文確定後 <strong>5～10営業日</strong> での発送となります。<br/>
                      ※在庫状況や部材の欠品により遅れが生じる場合は、別途メールにてご連絡させていただきます。
                   </p>
                </div>
                <div>
                   <h4 className="font-bold text-gray-700 mb-2 text-sm">Q. Tシャツのサイズについて</h4>
                   <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm text-center text-gray-600">
                         <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                               <th className="py-2 px-3">サイズ</th>
                               <th className="py-2 px-3">身丈</th>
                               <th className="py-2 px-3">身幅</th>
                               <th className="py-2 px-3">肩幅</th>
                               <th className="py-2 px-3">袖丈</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            <tr><td className="py-2">XS</td><td>62</td><td>46</td><td>40</td><td>18</td></tr>
                            <tr><td className="py-2">S</td><td>65</td><td>49</td><td>42</td><td>19</td></tr>
                            <tr><td className="py-2">M</td><td>69</td><td>52</td><td>46</td><td>20</td></tr>
                            <tr><td className="py-2">L</td><td>73</td><td>55</td><td>50</td><td>22</td></tr>
                            <tr><td className="py-2">XL</td><td>77</td><td>58</td><td>54</td><td>24</td></tr>
                         </tbody>
                      </table>
                   </div>
                   <p className="text-xs text-gray-400 mt-2 text-right">※単位：cm / 多少の誤差が生じる場合があります</p>
                </div>
                <div>
                   <h4 className="font-bold text-gray-700 mb-2 text-sm">Q. 送料について</h4>
                   <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 space-y-2">
                      <p>
                         <strong>本州・四国・九州</strong><br/>
                         お買い上げ 5,000円(税込)未満：<strong>600円</strong><br/>
                         お買い上げ 5,000円(税込)以上：<strong>無料</strong>
                      </p>
                      <p className="pt-2 border-t border-gray-200">
                         <strong>北海道・沖縄・離島</strong><br/>
                         一律 <strong>1,000円</strong>
                      </p>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* 右カラム: カートサマリー */}
        <div className="lg:col-span-1">
          <div className="flex justify-end mb-2">
             <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
               <XCircle className="w-4 h-4" /> カートを空にする
             </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
            <h3 className="font-bold text-lg mb-6 border-b pb-4">ご注文内容</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600"><span>商品合計 ({totalItemsCount}点)</span><span>¥{cartTotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-600"><span>送料</span><span>{shipping === 0 ? '無料' : `¥${shipping.toLocaleString()}`}</span></div>
              {shipping > 0 && <div className="text-xs text-blue-500 text-right">あと ¥{(5000 - cartTotal).toLocaleString()} で送料無料</div>}
            </div>
            <div className="flex justify-between items-center border-t pt-4 mb-8">
              <span className="font-bold text-gray-800">合計 (税込)</span>
              <span className="text-2xl font-bold text-blue-600">¥{grandTotal.toLocaleString()}</span>
            </div>
            
            <Link href="/checkout" className="block w-full">
              <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-lg mb-4">
                レジへ進む <ArrowRight className="w-5 h-5" />
              </button>
            </Link>

            <Link href="/" className="block w-full text-center text-sm text-gray-500 hover:underline flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 mr-1" /> 買い物を続ける
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}