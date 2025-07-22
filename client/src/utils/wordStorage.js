import { get, set, del } from 'idb-keyval';
import supabase from '../supabaseClient';

const WORDS_KEY = 'words_data';
const PROGRESS_KEY = 'user_word_progress';
const LAST_SYNC_DATE_KEY = 'last_sync_date';

export async function getWordsFromIndexedDB() {
  try {
    const words = await get(WORDS_KEY);
    console.log('IndexedDB에서 데이터 로드 시도:', words ? '성공' : '데이터 없음');
    return words;
  } catch (error) {
    console.error('IndexedDB에서 데이터 로드 실패:', error);
    return null;
  }
}

export async function saveWordsToIndexedDB(words) {
  try {
    await set(WORDS_KEY, words);
    console.log('IndexedDB에 데이터 저장 성공');
  } catch (error) {
    console.error('IndexedDB에 데이터 저장 실패:', error);
  }
}

export async function fetchAndCacheWords() {
  try {
    let words = await getWordsFromIndexedDB();
    
    if (words) {
      console.log('캐시된 데이터 유효성:', {
        isArray: Array.isArray(words),
        length: words.length,
        hasId: words[0]?.id !== undefined,
        hasPos: words[0]?.pos !== undefined
      });
    }

    if (words && Array.isArray(words) && words.length > 0 && words[0]?.id !== undefined && words[0]?.pos !== undefined) {
      console.log('캐시된 데이터 사용');
      return words;
    }

    console.log('새로운 데이터 다운로드 시작');
    const res = await fetch('/words.json');
    const freshWords = await res.json();
    
    const wordsWithIdAndPos = freshWords.map((word) => ({
      ...word,
      id: word.frequency_rank, 
      pos: word.part_of_speech 
    }));

    await saveWordsToIndexedDB(wordsWithIdAndPos);
    return wordsWithIdAndPos;
  } catch (error) {
    console.error('데이터 로드/캐시 과정 중 오류:', error);
    return null;
  }
}

export async function clearWordsFromIndexedDB() {
  await del(WORDS_KEY);
}

export async function setLastSyncDate(date) {
  try {
    await set(LAST_SYNC_DATE_KEY, date);
  } catch (error) {
    console.error('마지막 동기화 날짜 저장 실패:', error);
  }
}

export async function getLastSyncDate() {
  try {
    return await get(LAST_SYNC_DATE_KEY);
  } catch (error) {
    console.error('마지막 동기화 날짜 로드 실패:', error);
    return null;
  }
}

// --- Verb Conjugations Functions ---
const VERBS_KEY = 'verb_conjugations_data';

export async function getVerbsFromIndexedDB() {
  try {
    return await get(VERBS_KEY);
  } catch (error) {
    console.error('IndexedDB에서 동사 데이터 로드 실패:', error);
    return null;
  }
}

export async function saveVerbsToIndexedDB(verbs) {
  try {
    await set(VERBS_KEY, verbs);
  } catch (error) {
    console.error('IndexedDB에 동사 데이터 저장 실패:', error);
  }
}

export async function fetchAndCacheVerbs() {
  try {
    const cachedVerbs = await getVerbsFromIndexedDB();
    if (cachedVerbs && cachedVerbs.length > 0) {
      return cachedVerbs;
    }

    const { data, error } = await supabase
      .from('verb_conjugations')
      .select(`
        word_id,
        is_irregular,
        conjugations,
        word:words ( spanish, frequency_rank, category_code )
      `);

    if (error) throw error;

    const verbsData = data.map(item => ({
      ...item,
      verb: item.word.spanish,
      frequency_rank: item.word.frequency_rank,
      category_code: item.word.category_code,
    }));

    await saveVerbsToIndexedDB(verbsData);
    return verbsData;
  } catch (error) {
    console.error('동사 데이터 로드/캐시 중 오류:', error);
    return null;
  }
}

// --- User Progress Functions ---

export async function getProgress() {
  return (await get(PROGRESS_KEY)) || {};
}

export async function updateProgress(wordId, progressObj) {
  const progress = await getProgress();
  // [수정] 로컬 IndexedDB에 저장하는 데이터는 user_id가 필요 없습니다.
  // wordId가 key이므로 word_id도 필요 없습니다.
  progress[wordId] = { ...progressObj };
  await set(PROGRESS_KEY, progress);

  // Supabase에는 user_id와 word_id를 포함하여 전송합니다.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      const upsertData = {
        user_id: user.id,
        word_id: wordId,
        ...progressObj
      };

      const { error } = await supabase
        .from('user_word_progress')
        .upsert(upsertData, { onConflict: 'user_id, word_id' });

      if (error) {
        console.error('Supabase 진도 업데이트 실패:', error);
      }
    }
  } catch (error) {
    console.error('사용자 정보 가져오기 또는 Supabase 업데이트 중 오류:', error);
  }
}

export async function mergeWordsWithProgress(words) {
  try {
    const progress = await getProgress();

    if (!words || !Array.isArray(words)) {
      console.error('유효하지 않은 단어 데이터');
      return [];
    }

    const mergedWords = words.map(word => {
      if (!word || !word.id) {
        return word;
      }
      const prog = progress[word.id] || { status: 'not_started' };
      return {
        ...word,
        ...prog,
      };
    });

    return mergedWords;
  } catch (error) {
    console.error('단어 데이터 병합 중 오류:', error);
    return words || [];
  }
}

/**
 * Supabase와 IndexedDB 진도(progress) 동기화 (최종 수정본)
 * @param {string} userId
 */
export async function syncProgressWithSupabase(userId) {
  console.log('--- 동기화 시작 ---');
  
  // 1. Supabase에서 전체 진도 fetch
  const { data: supaRows, error: supaError } = await supabase
    .from('user_word_progress')
    .select('*')
    .eq('user_id', userId);

  if (supaError) {
    console.error('Supabase 진도 fetch 실패:', supaError);
    return;
  }
  const supaProgress = {};
  for (const row of supaRows) {
    supaProgress[row.word_id] = row;
  }

  // 2. IndexedDB에서 전체 진도 fetch
  const localProgress = await getProgress();

  // 3. word_id별로 최신 데이터 선택하여 병합
  const mergedProgress = {};
  const allWordIds = new Set([...Object.keys(supaProgress), ...Object.keys(localProgress)]);

  for (const wordIdStr of allWordIds) {
    const wordId = parseInt(wordIdStr, 10);
    const supa = supaProgress[wordId];
    const local = localProgress[wordId];
    let definitiveRecord;

    if (!supa) {
      // 로컬에만 존재 -> 서버로 푸시할 최종 데이터로 구성
      definitiveRecord = {
        ...local,
        user_id: userId,
        word_id: wordId,
      };
    } else if (!local) {
      // 서버에만 존재 -> 로컬에 저장할 최종 데이터로 구성
      definitiveRecord = supa;
    } else {
      // 둘 다 존재 -> 타임스탬프 비교
      const supaTime = new Date(supa.last_reviewed_at || 0).getTime();
      const localTime = new Date(local.last_reviewed_at || 0).getTime();

      if (supaTime >= localTime) {
        definitiveRecord = supa;
      } else {
        // 로컬이 최신 -> 로컬 데이터를 기반으로 서버에 푸시할 최종 데이터 구성
        definitiveRecord = {
          ...local,
          user_id: userId,
          word_id: wordId,
        };
      }
    }
    mergedProgress[wordId] = definitiveRecord;
  }

  // 4. 병합된 결과를 양쪽에 모두 반영
  const upserts = Object.values(mergedProgress);
  if (upserts.length > 0) {
    // (a) Supabase에 upsert
    const { error: upsertError } = await supabase.from('user_word_progress').upsert(upserts, { onConflict: 'user_id, word_id' });
    if (upsertError) {
      console.error('동기화 중 Supabase upsert 실패:', upsertError);
    } else {
      console.log('Supabase 동기화 성공:', upserts.length, '건');
    }
  }

  // (b) IndexedDB에 저장 (서버와 동일한, 완전한 데이터 저장)
  //    로컬 데이터도 user_id, word_id를 갖게 되어 일관성 유지
  await set(PROGRESS_KEY, mergedProgress);
  console.log('IndexedDB 동기화 완료.');

  await setLastSyncDate(new Date().toISOString());
  console.log('--- 동기화 종료 ---');
}