import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("`update-user-word-progress` function booting up...");

// CORS 핸들러
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

serve(async (req) => {
  // OPTIONS 요청(preflight) 처리
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Supabase Admin 클라이언트 생성 (서비스 키 사용)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 요청 본문에서 학습 진행 데이터 추출
    const progressData = await req.json();

    // 유효성 검사
    if (!progressData.user_id || !progressData.word_id) {
      throw new Error('`user_id` and `word_id` are required.');
    }

    // upsert 실행
    const { error } = await supabaseAdmin
      .from('user_word_progress')
      .upsert(progressData, { onConflict: 'user_id, word_id' });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ message: "Progress updated successfully." }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      status: 200,
    });

  } catch (e) {
    console.error(`Error updating progress: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 500,
    });
  }
});
