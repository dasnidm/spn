import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

// CORS 헤더 (모든 출처에서의 요청을 허용 - 개발용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gemini API 클라이언트 초기화
// !! 중요 !!: Supabase 대시보드에서 'GEMINI_API_KEY' 환경 변수를 설정해야 합니다.
const API_KEY = Deno.env.get("GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


// 프롬프트 생성 함수
function createPrompt(targetWord, pos, knownWords) {
  const knownWordsString = knownWords.length > 0 ? knownWords.join(', ') : '없음';
  
  return `
    당신은 스페인어 초급-중급 학습자를 위한 개인화된 예문을 만드는 전문 튜터입니다.

    # 목표 단어:
    ${targetWord} (품사: ${pos})

    # 학습자가 이미 알고 있는 단어 목록 (이 단어들을 최대한 활용해주세요):
    ${knownWordsString}

    # 요청 사항:
    1. '목표 단어'를 반드시 사용하여, '알고 있는 단어 목록'에 있는 단어들을 최대한 활용해 자연스러운 스페인어 예문 1개를 만들어 주세요.
    2. 문법은 너무 복잡하지 않게, 스페인어 학습자의 초급-중급 수준에 맞춰 주세요.
    3. 답변은 반드시 아래와 같은 JSON 형식으로만 제공해야 합니다. 다른 설명은 절대 추가하지 마세요.

    {
      "spanish_example": "여기에 스페인어 예문을 작성하세요",
      "korean_translation": "여기에 한국어 번역을 작성하세요"
    }
  `;
}


serve(async (req) => {
  // OPTIONS 요청(preflight) 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 본문에서 데이터 추출
    // targetWord: 예문을 만들 단어 (예: "casa")
    // pos: 품사 (예: "noun")
    // knownWords: 사용자가 아는 단어 목록 (예: ["yo", "tengo", "una"])
    const { targetWord, pos, knownWords } = await req.json()

    if (!targetWord || !pos) {
      return new Response(JSON.stringify({ error: 'targetWord와 pos는 필수입니다.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 프롬프트 생성
    const prompt = createPrompt(targetWord, pos, knownWords || []);
    
    // Gemini API 호출
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // API 응답 파싱
    // "```json\n{...}\n```" 형태의 응답을 처리하기 위함
    const jsonString = text.replace(/```json\n|```/g, '').trim();
    const generatedData = JSON.parse(jsonString);

    return new Response(JSON.stringify(generatedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})