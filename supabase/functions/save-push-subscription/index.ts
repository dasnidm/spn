import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // CORS preflight request를 처리합니다.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
    }});
  }

  try {
    const { subscription } = await req.json();

    // Supabase 클라이언트를 생성합니다.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 현재 인증된 사용자의 정보를 가져옵니다.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // `push_subscriptions` 테이블에 구독 정보를 저장(upsert)합니다.
    // 동일한 사용자의 동일한 구독 정보가 이미 있다면 덮어씁니다.
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        subscription: subscription,
      }, { onConflict: 'user_id, subscription' })
      .select()
      .single();

    if (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }

    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
