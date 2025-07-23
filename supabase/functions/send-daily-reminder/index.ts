import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

webpush.setVapidDetails(
  'mailto:your-email@example.com', // 실제 이메일 주소로 변경하세요.
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (_req) => {
  try {
    // 서비스 역할 키를 사용하여 Supabase 클라이언트 생성 (모든 데이터 접근 가능)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. 모든 구독 정보를 가져옵니다.
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id, subscription');

    if (subsError) throw subsError;

    // 2. 오늘 학습한 사용자 목록을 가져옵니다.
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: learnedUsers, error: learnedError } = await supabaseAdmin
      .from('user_word_progress')
      .select('user_id')
      .gte('last_reviewed_at', `${today}T00:00:00.000Z`);
    
    if (learnedError) throw learnedError;
    const learnedUserIds = new Set(learnedUsers.map(u => u.user_id));

    // 3. 알림 페이로드 설정
    const payload = JSON.stringify({
      title: '📚 Vocabulario Inteligente',
      body: '오늘의 스페인어 학습을 잊으셨나요? 지금 바로 시작해보세요!',
    });

    // 4. 학습하지 않은 사용자에게 알림 발송
    const promises = subscriptions
      .filter(sub => !learnedUserIds.has(sub.user_id))
      .map(sub => webpush.sendNotification(sub.subscription, payload)
        .catch(err => {
          // 구독이 만료되었거나 유효하지 않으면 DB에서 삭제
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('Subscription expired or invalid, deleting...');
            return supabaseAdmin.from('push_subscriptions').delete().match({ 'subscription->>endpoint': sub.subscription.endpoint });
          } else {
            console.error('Error sending push notification:', err);
          }
        })
      );

    await Promise.all(promises);

    return new Response(JSON.stringify({ message: 'Reminders sent successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
