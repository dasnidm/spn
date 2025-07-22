import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Create Example Request function booting up...");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { word_id } = await req.json();
    if (!word_id) {
      throw new Error("word_id is required.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not found.");

    // 1. jobs 테이블에 새로운 작업 추가 또는 기존 작업 확인
    const { data: job, error: upsertError } = await supabaseClient
      .from('example_generation_jobs')
      .upsert({
        word_id: word_id,
        user_id: user.id,
        status: 'pending' // 항상 pending으로 시작
      }, { onConflict: 'user_id, word_id' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    // 2. 백그라운드에서 예문 처리 함수를 즉시 호출 (결과는 기다리지 않음)
    const { error: invokeError } = await supabaseClient.functions.invoke('process-example-queue', {
      body: { job_id: job.id }, // 어떤 job을 처리할지 명시
      invocationType: 'event', // 비동기 호출
    });

    if (invokeError) throw invokeError;

    return new Response(JSON.stringify({ 
      message: "Example generation job started successfully.",
      job: job 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202, // 202 Accepted: 요청이 접수되었으며, 처리는 비동기적으로 이루어짐
    });

  } catch (error) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});