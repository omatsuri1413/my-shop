'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shirt, ShoppingBag, Stamp, CircleDot, ShoppingCart } from 'lucide-react';

const PRODUCTS = [
  { id: 'tshirt', name: 'Tシャツ', price: 3000, icon: <Shirt size={48} />, desc: '定番のヘビーウェイトTシャツ' },
  { id: 'tote', name: 'トートバッグ', price: 2500, icon: <ShoppingBag size={48} />, desc: '厚手キャンバス生地' },
  { id: 'acsta', name: 'アクリルスタンド', price: 1200, icon: <Stamp size={48} />, desc: 'フルカラーカット対応' },
  { id: 'badge', name: '缶バッジ', price: 500, icon: <CircleDot size={48} />, desc: '安全ピンタイプ' },
];

export default function HomePage() {
  // カート内のアイテム数をカウント
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // 画面表示時にlocalStorageからカート情報を取得
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartCount(cart.length);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="py-6 px-8 border-b flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Make Your Goods</h1>
        
        {/* ★追加: カートボタン */}
        <Link href="/cart" className="relative group">
          <div className="p-3 bg-gray-100 rounded-full group-hover:bg-blue-50 transition-colors">
            <ShoppingCart className="w-6 h-6 text-gray-600 group-hover:text-blue-600" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cartCount}
              </span>
            )}
          </div>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Create Original Items</h2>
          <p className="text-gray-500">作りたいアイテムを選んで、あなたのデザインをアップロードしてください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PRODUCTS.map((product) => (
            <Link 
              key={product.id} 
              href={`/product/${product.id}`} 
              className="group block border border-gray-200 rounded-3xl p-8 hover:shadow-xl transition-all hover:-translate-y-1 bg-white text-center cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="bg-gray-50 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  {product.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{product.desc}</p>
                <span className="inline-block px-4 py-1 bg-gray-100 rounded-full text-sm font-bold text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                  ¥{product.price.toLocaleString()} ~
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}