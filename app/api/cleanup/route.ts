import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  // === セキュリティチェック ===
  // Vercel Cronからのアクセスかどうかを確認
  // ※ローカル環境(development)ではチェックをスキップしてテストしやすくする
  if (process.env.NODE_ENV !== 'development') {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    // 1. データベースに保存されている（＝注文完了した）画像のパスを全取得
    const { data: orderItems, error: dbError } = await supabase
      .from('order_items')
      .select('image_url, option_detail');
    
    if (dbError) throw dbError;

    const validUrls = new Set<string>();
    
    orderItems.forEach(item => {
      if (item.image_url) validUrls.add(item.image_url);
      
      if (item.option_detail) {
        try {
          const details = JSON.parse(item.option_detail);
          if (details.images) {
            Object.values(details.images).forEach((url: any) => {
                if (typeof url === 'string') validUrls.add(url);
            });
          }
        } catch (e) { /* JSON parse error ignore */ }
      }
    });

    // 2. Storage内の全ファイルを取得
    const folders = ['cart-thumb', 'original'];
    let deletedCount = 0;

    for (const folder of folders) {
      const { data: files, error: storageError } = await supabase.storage
        .from('order-images')
        .list(folder, { limit: 100 }); // タイムアウト防止のため一度の処理数を制限

      if (storageError) continue;
      if (!files || files.length === 0) continue;

      const filesToDelete: string[] = [];
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000; // 24時間

      for (const file of files) {
        // ファイル名からタイムスタンプを抽出
        const timestamp = parseInt(file.name.split('-')[0]);
        
        // 24時間以上経過しているかチェック
        if (isNaN(timestamp) || (now - timestamp > ONE_DAY)) {
          
          const { data: publicUrlData } = supabase.storage
             .from('order-images')
             .getPublicUrl(`${folder}/${file.name}`);
          
          // 注文データに含まれていなければ削除リストへ
          if (!validUrls.has(publicUrlData.publicUrl)) {
             filesToDelete.push(`${folder}/${file.name}`);
          }
        }
      }

      // 3. 削除実行
      if (filesToDelete.length > 0) {
        await supabase.storage
          .from('order-images')
          .remove(filesToDelete);
        deletedCount += filesToDelete.length;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed. Deleted ${deletedCount} files.` 
    });

  } catch (error: any) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}