import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

console.log("Process Example Queue function booting up for single job processing...");

const API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!API_KEY) console.error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function createPrompt(targetWord, pos, knownWords) {
  const knownWordsString = knownWords.length > 0 ? knownWords.join(', ') : '없음';
  return `You are a professional tutor creating a personalized example sentence for a beginner-intermediate Spanish learner.
# Target Word:
${targetWord} (Part of Speech: ${pos})
# Words the learner already knows (use these as much as possible):
${knownWordsString}
# Request:
1. Create one natural Spanish example sentence using the 'Target Word' and prioritizing words from the 'known words list'.
2. Keep the grammar at a beginner-intermediate level.
3. The sentence should be concise, ideally between 5 and 15 words long.
4. Your response MUST be only in the following JSON format. Do not add any other explanations.
{
  "spanish_example": "Your Spanish sentence here",
  "korean_translation": "Your Korean translation here"
}`;
}

serve(async (req) => {
  const { job_id } = await req.json();
  if (!job_id) {
    return new Response(JSON.stringify({ error: "job_id is required." }), { status: 400 });
  }

  console.log(`[Job ${job_id}] Starting processing...`);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('example_generation_jobs')
      .select('id, user_id, word:words(id, spanish, pos:part_of_speech)')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job ${job_id} not found. Error: ${jobError?.message}`);
    }
    console.log(`[Job ${job_id}] Found job details for word: ${job.word.spanish}`);

    await supabaseAdmin
      .from('example_generation_jobs')
      .update({ status: 'processing', processed_at: new Date().toISOString() })
      .eq('id', job.id);
    console.log(`[Job ${job_id}] Status updated to 'processing'.`);

    // 'stability' 컬럼을 사용하지 않도록 수정
    const { data: knownProgress, error: progressError } = await supabaseAdmin
      .from('user_word_progress')
      .select('word_id, status')
      .eq('user_id', job.user_id);

    if (progressError) throw new Error(`Failed to fetch user progress: ${progressError.message}`);

    // 'stability' 조건을 제거하고 'status'만으로 필터링
    const knownWordIds = knownProgress
      .filter(p => p.status === 'completed')
      .map(p => p.word_id);
    console.log(`[Job ${job_id}] Found ${knownWordIds.length} known word IDs based on 'completed' status.`);

    let knownWords = [];
    if (knownWordIds.length > 0) {
      const { data: wordsData, error: wordsError } = await supabaseAdmin
        .from('words')
        .select('spanish')
        .in('id', knownWordIds);

      if (wordsError) throw new Error(`Failed to fetch known words text: ${wordsError.message}`);
      knownWords = wordsData.map(w => w.spanish);
    }
    console.log(`[Job ${job_id}] Assembled ${knownWords.length} known words.`);

    const prompt = createPrompt(job.word.spanish, job.word.pos, knownWords);
    console.log(`[Job ${job_id}] Sending prompt to Gemini...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(`[Job ${job_id}] Received raw response from Gemini: ${text}`);

    let generatedData;
    try {
      const jsonString = text.replace(/```json\n|```/g, '').trim();
      generatedData = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response from Gemini. Raw text: ${text}. Error: ${parseError.message}`);
    }
    
    await supabaseAdmin
      .from('generated_examples')
      .upsert({
        word_id: job.word.id,
        user_id: job.user_id,
        spanish_example: generatedData.spanish_example,
        korean_translation: generatedData.korean_translation,
        generated_by: 'gemini-1.5-flash',
        knowledge_snapshot: { known_words_count: knownWords.length }
      }, { onConflict: 'word_id, user_id' });
    console.log(`[Job ${job_id}] Successfully upserted example into DB.`);

    await supabaseAdmin
      .from('example_generation_jobs')
      .update({ status: 'completed' })
      .eq('id', job.id);

    console.log(`[Job ${job_id}] Status updated to 'completed'. Job finished.`);
    return new Response(JSON.stringify({ message: "Job completed successfully." }), { status: 200 });

  } catch (e) {
    console.error(`[Job ${job_id}] CRITICAL ERROR: ${e.message}`);
    await supabaseAdmin
      .from('example_generation_jobs')
      .update({ status: 'failed', error_message: e.message })
      .eq('id', job_id);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
