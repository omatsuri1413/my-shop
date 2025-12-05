'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, ShoppingCart, ArrowLeft, Move, RotateCcw, Scan, Scaling, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toPng } from 'html-to-image';
import { supabase } from '@/lib/supabase'; // ★追加: Supabaseクライアント

// === カラー定義 ===
const COLORS = [
  { name: 'White', code: '#ffffff', border: '#e5e7eb' },
  { name: 'Black', code: '#1a1a1a', border: '#1a1a1a' },
  { name: 'Mix Gray', code: '#d1d5db', border: '#9ca3af' },
  { name: 'Ash', code: '#f3f4f6', border: '#d1d5db' },
  { name: 'Sumi', code: '#374151', border: '#374151' },
  { name: 'Navy', code: '#1e3a8a', border: '#1e3a8a' },
  { name: 'Indigo', code: '#312e81', border: '#312e81' },
  { name: 'Royal Blue', code: '#2563eb', border: '#2563eb' },
  { name: 'Light Blue', code: '#bae6fd', border: '#7dd3fc' },
  { name: 'Red', code: '#dc2626', border: '#dc2626' },
  { name: 'Burgundy', code: '#7f1d1d', border: '#7f1d1d' },
  { name: 'Orange', code: '#ea580c', border: '#ea580c' },
  { name: 'Gold', code: '#eab308', border: '#ca8a04' },
  { name: 'Ivy Green', code: '#14532d', border: '#14532d' },
  { name: 'Lime Green', code: '#84cc16', border: '#65a30d' },
  { name: 'Purple', code: '#7e22ce', border: '#7e22ce' },
  { name: 'Light Pink', code: '#fce7f3', border: '#fbcfe8' },
  { name: 'Hot Pink', code: '#db2777', border: '#db2777' },
  { name: 'Sand Khaki', code: '#d6d3d1', border: '#a8a29e' },
  { name: 'Dark Brown', code: '#451a03', border: '#451a03' },
];

// === 商品データ定義 ===
const PRODUCT_DATA: Record<string, any> = {
  tshirt: {
    name: '5.6oz Tシャツ',
    price: 1500,
    hasColor: true,
    defaultAreaScale: 0.7,
    printAreaMoving: false,
    chargesPerPrint: true,
    needsTextureOverlay: true,
    defaultVariant: 'm',
    images: {
      front: '/tshirt-front.png',
      back: '/tshirt-back.png',
    },
    printArea: { top: '18%', left: '28%', width: '44%', height: '58%', borderRadius: '0%' }
  },
  tote: {
    name: 'キャンバストート',
    price: 1000,
    hasColor: false,
    defaultAreaScale: 0.8,
    printAreaMoving: false,
    chargesPerPrint: true,
    needsTextureOverlay: true,
    defaultVariant: 'standard',
    images: {
      front: '/tote-front.png',
      back: '/tote-back.png',
    },
    printArea: { top: '45%', left: '25%', width: '50%', height: '40%', borderRadius: '0%' }
  },
  acsta: {
    name: 'アクリルスタンド',
    price: 800,
    hasColor: false,
    defaultAreaScale: 0.5,
    printAreaMoving: true, 
    chargesPerPrint: false,
    needsTextureOverlay: true,
    defaultVariant: '5x5',
    images: {
      front: '/acsta.png',
      back: null,
    },
    printArea: { top: '8.33%', left: '0%', width: '100%', height: '83.33%', borderRadius: '0%' }
  },
  badge: {
    name: '缶バッジ',
    price: 200,
    hasColor: false,
    defaultAreaScale: 0.85,
    printAreaMoving: true, 
    chargesPerPrint: false,
    needsTextureOverlay: true,
    defaultVariant: '32mm',
    images: {
      front: '/badge.png',
      back: null,
    },
    printArea: {
      top: '17%',
      left: '10%',
      width: '80%',
      height: '66%',
      borderRadius: '50%'
    }
  },
};

type SideDesign = {
  image: string | null;
  x: number;
  y: number;
  scale: number;
};

// Base64変換
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// ★追加: Base64画像をSupabaseにアップロードする関数
const uploadBase64ToSupabase = async (base64Data: string | null, folder: string) => {
  if (!base64Data) return null;
  
  try {
    // Base64をBlobに変換
    const res = await fetch(base64Data);
    const blob = await res.blob();

    // ファイル名生成
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    // Upload
    const { error } = await supabase.storage
      .from('order-images')
      .upload(fileName, blob, { contentType: 'image/png' });

    if (error) throw error;

    // Public URL取得
    const { data } = supabase.storage
      .from('order-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error("Upload failed:", error);
    return null;
  }
};


export default function ProductEditorPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const product = PRODUCT_DATA[productId] || PRODUCT_DATA['tshirt'];
  
  const isMovingArea = product.printAreaMoving;
  const isBadge = productId === 'badge';

  // === State ===
  const [designs, setDesigns] = useState<{ front: SideDesign; back: SideDesign }>({
    front: { image: null, x: 0, y: 0, scale: 1 },
    back:  { image: null, x: 0, y: 0, scale: 1 },
  });

  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [hoverColor, setHoverColor] = useState<typeof COLORS[0] | null>(null);
  const displayColor = hoverColor || selectedColor;

  const [scenePos, setScenePos] = useState({ x: 0, y: 0 });
  const sceneScale = 1.0;
  const [areaScale, setAreaScale] = useState(product.defaultAreaScale || 1);

  const [dragTarget, setDragTarget] = useState<'none' | 'design' | 'scene'>('none');
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 }); 
  
  const [isCapturing, setIsCapturing] = useState(false);

  const captureRefFront = useRef<HTMLDivElement>(null);
  const captureRefBack = useRef<HTMLDivElement>(null);

  const currentDesign = designs[currentSide];

  const calculateTotal = () => {
    let additionalCost = 0;
    if (product.chargesPerPrint) {
        if (designs.front.image) additionalCost += 1000;
        if (designs.back.image) additionalCost += 1000;
    }
    return product.price + additionalCost;
  };

  useEffect(() => {
    setDesigns({
      front: { image: null, x: 0, y: 0, scale: 1 },
      back:  { image: null, x: 0, y: 0, scale: 1 },
    });
    setScenePos({ x: 0, y: 0 });
    setAreaScale(product.defaultAreaScale || 1);
    setCurrentSide('front');
    setSelectedColor(COLORS[0]);
  }, [productId, product.defaultAreaScale]);

  const updateDesign = (updates: Partial<SideDesign>) => {
    setDesigns(prev => ({
      ...prev,
      [currentSide]: { ...prev[currentSide], ...updates }
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        updateDesign({ image: base64, x: 0, y: 0, scale: 1 });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteImage = () => {
    if (confirm('この面のデザインを削除しますか？')) {
      updateDesign({ image: null, x: 0, y: 0, scale: 1 });
    }
  };

  const handleDesignMouseDown = (e: React.MouseEvent) => {
    if (!currentDesign.image) return;
    e.stopPropagation(); 
    setDragTarget('design');
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { x: currentDesign.x, y: currentDesign.y };
  };

  const handleSceneMouseDown = (e: React.MouseEvent) => {
    setDragTarget('scene');
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...scenePos };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragTarget === 'none') return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    if (dragTarget === 'design') {
      updateDesign({
        x: initialPosRef.current.x + deltaX,
        y: initialPosRef.current.y + deltaY,
      });
    } else if (dragTarget === 'scene') {
      setScenePos({
        x: initialPosRef.current.x + deltaX,
        y: initialPosRef.current.y + deltaY,
      });
    }
  };

  const handleMouseUp = () => {
    setDragTarget('none');
  };

  const resetView = () => {
    setScenePos({ x: 0, y: 0 });
  };

  const resetDesign = () => {
    updateDesign({ x: 0, y: 0, scale: 1 });
    setAreaScale(product.defaultAreaScale || 1);
  };

  // ★修正: 画像をStorageにアップロードしてからカートに追加する処理
  const handleAddToCart = async () => {
    setIsCapturing(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // 1. 表面キャプチャ
        let frontCaptureBase64 = null;
        if (captureRefFront.current) {
           frontCaptureBase64 = await toPng(captureRefFront.current, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });
        }

        // 2. 裏面キャプチャ
        let backCaptureBase64 = null;
        if (product.images.back && captureRefBack.current) {
            backCaptureBase64 = await toPng(captureRefBack.current, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });
        }

        // ★追加: ここでSupabaseにアップロードしてしまう
        // (localStorageに巨大なBase64を入れないため)
        const thumbUrlFront = await uploadBase64ToSupabase(frontCaptureBase64, 'cart-thumb');
        const thumbUrlBack = await uploadBase64ToSupabase(backCaptureBase64, 'cart-thumb');
        const originalUrlFront = await uploadBase64ToSupabase(designs.front.image, 'original');
        const originalUrlBack = await uploadBase64ToSupabase(designs.back.image, 'original');

        // 3. データ作成 (URLを保存)
        const defaultKey = product.defaultVariant || 'standard';
        const quantities = { [defaultKey]: 1 };

        const cartItem = {
            id: new Date().getTime(),
            productId,
            name: product.name,
            price: product.price,
            chargesPerPrint: product.chargesPerPrint,
            quantities,
            color: product.hasColor ? selectedColor.name : null,
            
            // Base64ではなくURLを保存
            image: thumbUrlFront, 
            imageBack: thumbUrlBack,
            originalImageFront: originalUrlFront,
            originalImageBack: originalUrlBack,
            
            // designsの中のimage(Base64)もURLに置き換えるか、削除して軽量化する
            // 再編集機能のために座標データは残すが、画像はURLにする
            designs: {
              front: { ...designs.front, image: originalUrlFront },
              back:  { ...designs.back, image: originalUrlBack }
            },
        };

        const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
        localStorage.setItem('cart', JSON.stringify([...existingCart, cartItem]));

        router.push('/cart');

    } catch (error) {
        console.error("Cart processing failed:", error);
        alert("カートへの追加に失敗しました。もう一度お試しください。");
    } finally {
        setIsCapturing(false);
    }
  };

  const moveStyle: React.CSSProperties = {
    transform: `translate(${scenePos.x}px, ${scenePos.y}px) scale(${sceneScale})`,
    transition: (dragTarget === 'scene' || isCapturing) ? 'none' : 'transform 0.1s ease-out',
  };

  const ProductPreview = ({ side, isInteractive = true }: { side: 'front' | 'back', isInteractive?: boolean }) => {
    const design = designs[side];
    const baseImage = side === 'front' ? product.images.front : product.images.back;
    
    const PrintAreaLayer = () => (
      <div 
        className={`absolute z-20 overflow-hidden ${isInteractive && !isCapturing ? 'border-2 border-dashed border-blue-200 hover:border-blue-500' : ''}`}
        style={{
          top: product.printArea.top,
          left: product.printArea.left,
          width: product.printArea.width,
          height: product.printArea.height,
          borderRadius: product.printArea.borderRadius,
          transform: `scale(${areaScale})`,
          transformOrigin: 'center',
          cursor: isInteractive && design.image ? 'grab' : 'default',
          pointerEvents: isInteractive ? 'auto' : 'none'
        }}
        onMouseDown={isInteractive ? handleDesignMouseDown : undefined}
      >
        {design.image && (
          <img 
            src={design.image} 
            alt="Design" 
            className="absolute max-w-none origin-center" 
            style={{
              transform: `translate(${design.x}px, ${design.y}px) scale(${design.scale})`,
              width: '100%',
              mixBlendMode: 'normal',
              filter: 'brightness(0.95)'
            }}
            draggable={false} 
          />
        )}
        {isInteractive && !design.image && (
           <div className="w-full h-full flex items-center justify-center text-blue-300 text-xs font-bold pointer-events-none bg-blue-50/20">
              PRINT AREA
           </div>
        )}
      </div>
    );

    return (
      <div className="relative w-[500px] h-[600px] flex-shrink-0 bg-transparent">
        <div className="absolute inset-0 w-full h-full pointer-events-none" style={isInteractive ? moveStyle : undefined}>
            {/* 1. 下地 */}
            {product.hasColor ? (
              <div 
                className="absolute inset-0 z-10 transition-colors duration-200"
                style={{ 
                    backgroundColor: displayColor.code,
                    maskImage: `url(${baseImage})`,
                    WebkitMaskImage: `url(${baseImage})`,
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center',
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                }}
              />
            ) : (
              <img src={baseImage} alt="Base" className="absolute inset-0 w-full h-full object-contain z-10" />
            )}

            {/* 2. デザイン */}
            {(!isMovingArea || isInteractive) && (
               <div className="absolute inset-0 z-20 pointer-events-none">
                  <PrintAreaLayer />
               </div>
            )}

            {/* 3. 質感オーバーレイ */}
            {product.needsTextureOverlay && (
              <img 
                src={baseImage} 
                alt="Texture Overlay"
                className="absolute inset-0 w-full h-full object-contain z-30 mix-blend-multiply pointer-events-none"
                style={{ filter: 'contrast(1.2)', opacity: 0.8 }}
              />
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onMouseLeave={handleMouseUp}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center text-gray-600 hover:text-black font-medium transition">
          <ArrowLeft className="w-5 h-5 mr-2" />
          商品一覧に戻る
        </Link>
        <span className="font-bold text-lg">{product.name} 作成中</span>
        <div className="w-24"></div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 h-[calc(100vh-80px)]">
        
        <div 
            className="lg:col-span-2 bg-gray-200/50 rounded-2xl border border-gray-300 overflow-hidden relative flex items-center justify-center cursor-move group"
            onMouseDown={handleSceneMouseDown}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <button onClick={(e) => { e.stopPropagation(); resetView(); }} className="absolute top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-sm border text-gray-600 hover:text-black text-xs font-bold flex items-center cursor-pointer">
             <RotateCcw className="w-4 h-4 mr-2" /> 位置リセット
          </button>

          {product.images.back && (
            <div className="absolute top-4 right-4 z-40 bg-white border rounded-lg p-1 flex shadow-sm cursor-default">
              <button onClick={(e) => { e.stopPropagation(); setCurrentSide('front'); }} className={`px-4 py-2 rounded text-sm font-bold transition ${currentSide === 'front' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>表面</button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentSide('back'); }} className={`px-4 py-2 rounded text-sm font-bold transition ${currentSide === 'back' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>裏面</button>
            </div>
          )}
          
          <ProductPreview side={currentSide} isInteractive={true} />
        </div>

        <div className="space-y-6 overflow-y-auto pr-2">
          
          {product.hasColor && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">カラーを選択</h3>
              <div className="grid grid-cols-5 gap-3">
                {COLORS.map((color) => (
                  <button key={color.name}
                    className={`w-full aspect-square rounded-full border shadow-sm transition-all transform relative group ${selectedColor.name === color.name ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color.code, borderColor: color.border }}
                    onClick={() => setSelectedColor(color)}
                    onMouseEnter={() => setHoverColor(color)}
                    onMouseLeave={() => setHoverColor(null)}
                    title={color.name}
                  >
                    {selectedColor.name === color.name && (<span className={`absolute inset-0 flex items-center justify-center ${['White', 'Ash', 'Light Pink', 'Light Blue'].includes(color.name) ? 'text-gray-600' : 'text-white'}`}>✔</span>)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center text-sm"><Move className="w-4 h-4 mr-2" /> デザイン編集 ({currentSide === 'front' ? '表面' : '裏面'})</h3>
            <div className="mb-6 pb-6 border-b border-gray-100">
               <div className="flex justify-between text-xs text-gray-500 mb-1"><span className="flex items-center"><Scan className="w-3 h-3 mr-1"/> プリント枠のサイズ</span><span>{isBadge ? '85% (固定)' : `${Math.round(areaScale * 100)}%`}</span></div>
               <input type="range" min="0.5" max="2.0" step="0.05" value={areaScale} onChange={(e) => setAreaScale(parseFloat(e.target.value))} disabled={isBadge} className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isBadge ? 'bg-gray-200 accent-gray-400 cursor-not-allowed' : 'bg-blue-100 accent-blue-600'}`}/>
            </div>
            
            {!currentDesign.image ? (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                  <span className="text-sm font-bold text-blue-600">画像をアップロード</span>
                  {product.chargesPerPrint && <p className="text-xs text-gray-400 mt-1">※+1,000円</p>}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
            ) : (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-2"><span className="text-xs text-gray-500">画像のサイズ</span><button onClick={resetDesign} className="text-xs text-blue-500 hover:underline flex items-center"><RotateCcw className="w-3 h-3 mr-1" /> リセット</button></div>
                <div className="flex items-center gap-2 mb-4"><Scaling className="w-4 h-4 text-gray-400" /><input type="range" min="0.2" max="3" step="0.1" value={currentDesign.scale} onChange={(e) => updateDesign({ scale: parseFloat(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/></div>
                <div className="flex gap-2">
                    <label className="flex-1 text-center py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">変更<input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} /></label>
                    <button onClick={handleDeleteImage} className="flex-1 text-center py-2 border border-red-200 text-red-500 rounded text-sm hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-4 h-4 mr-1"/> 削除</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600 font-medium">基本価格</span><span className="font-bold text-gray-900">¥{product.price.toLocaleString()}</span></div>
             {product.chargesPerPrint && (designs.front.image || designs.back.image) && (<div className="flex justify-between items-center mb-1 text-sm text-blue-600"><span>プリント代 ({[designs.front.image, designs.back.image].filter(Boolean).length}枚)</span><span>+ ¥{((designs.front.image ? 1000 : 0) + (designs.back.image ? 1000 : 0)).toLocaleString()}</span></div>)}
             <div className="border-t my-3 pt-3 flex justify-between items-end mb-4"><span className="text-lg font-bold text-gray-800">合計</span><span className="text-3xl font-bold text-blue-600">¥{calculateTotal().toLocaleString()}</span></div>
             
             <button 
                onClick={handleAddToCart}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${(designs.front.image || designs.back.image) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`} 
                disabled={!(designs.front.image || designs.back.image) || isCapturing}
             >
               <ShoppingCart className="w-5 h-5" />
               {isCapturing ? '処理中...' : 'カートに入れる'}
             </button>
          </div>
        </div>
      </div>

      {/* 隠しキャプチャエリア */}
      <div style={{ position: 'fixed', top: 0, left: '200vw', width: 500, height: 600, opacity: 1, zIndex: -1, pointerEvents: 'none' }}>
         <div ref={captureRefFront} style={{ width: 500, height: 600 }}>
            <ProductPreview side="front" isInteractive={false} />
         </div>
         {product.images.back && (
            <div ref={captureRefBack} style={{ width: 500, height: 600 }}>
               <ProductPreview side="back" isInteractive={false} />
            </div>
         )}
      </div>

    </div>
  );
}
