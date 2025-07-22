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
    
    // 데이터 유효성 검사 결과 로깅
    if (words) {
      console.log('캐시된 데이터 유효성:', {
        isArray: Array.isArray(words),
        length: words.length,
        hasId: words[0]?.id !== undefined,
        hasPos: words[0]?.pos !== undefined
      });
    }

    // 유효한 캐시 데이터가 있으면 사용
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
    // 오류 발생 시 빈 배열 대신 null을 반환하여 상위 컴포넌트에서 처리하도록 함
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

/**
 * @typedef {Object} UserWordProgress
 * @property {string|number} word_id
 * @property {string} status
 * @property {string} last_reviewed_at
 * @property {string} next_review_at
 * @property {number} stability
 * @property {number} difficulty
 * @property {number} state
 * @property {number} lapses
 */

/**
 * wordId, progressObj(FSRS 상태 전체) 저장
 * @param {string|number} wordId
 * @param {UserWordProgress} progressObj
 */
export async function updateProgress(wordId, progressObj) {
  const progress = await getProgress();
  progress[wordId] = { ...progressObj };
  await set(PROGRESS_KEY, progress);

  // Supabase에도 즉시 업데이트 추가
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      const { error } = await supabase
        .from('user_word_progress')
        .upsert({
          user_id: user.id,
          word_id: wordId,
          ...progressObj // progressObj의 모든 필드를 여기에 포함
        }, { onConflict: 'user_id, word_id' });

      if (error) {
        console.error('Supabase 진도 업데이트 실패:', error);
      }
    }
  } catch (error) {
    console.error('사용자 정보 가져오기 또는 Supabase 업데이트 중 오류:', error);
  }
}

/**
 * words와 progress를 병합할 때 FSRS 필드까지 모두 병합
 * @param {Array<Object>} words
 * @returns {Promise<Array<Object>>}
 */
export async function mergeWordsWithProgress(words) {
  try {
    console.log('병합 전 단어 데이터:', {
      wordsExists: !!words,
      wordsLength: words?.length || 0
    });
    
    const progress = await getProgress();
    console.log('사용자 진도 데이터:', {
      progressExists: !!progress,
      progressKeys: Object.keys(progress).length
    });

    if (!words || !Array.isArray(words)) {
      console.error('유효하지 않은 단어 데이터');
      return [];
    }

    const mergedWords = words.map(word => {
      if (!word || !word.id) {
        console.warn('유효하지 않은 단어 항목:', word);
        return word;
      }
      const prog = progress[word.id] || { status: 'not_started' };
      return {
        ...word,
        ...prog, // FSRS 필드까지 모두 병합
      };
    });

    console.log('병합 후 단어 데이터:', {
      mergedLength: mergedWords.length,
      sampleWord: mergedWords[0]
    });

    return mergedWords;
  } catch (error) {
    console.error('단어 데이터 병합 중 오류:', error);
    return words || []; // 오류 발생 시 원본 데이터 반환
  }
}

/**
 * Supabase와 IndexedDB 진도(progress) 동기화
 * @param {string} userId
 */
export async function syncProgressWithSupabase(userId) {
  console.log('--- 동기화 시작 ---');
  console.log('사용자 ID:', userId);

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
  console.log('Supabase에서 가져온 진도 데이터 수:', supaRows.length);

  // 2. IndexedDB에서 전체 진도 fetch
  const localProgress = await getProgress();
  console.log('IndexedDB에서 가져온 진도 데이터 수:', Object.keys(localProgress).length);

  // 3. word_id별로 최신 데이터 선택
  const merged = {};
  const allWordIds = new Set([...Object.keys(supaProgress), ...Object.keys(localProgress)]);
  let localToSupaCount = 0;
  let supaToLocalCount = 0;

  for (const wordId of allWordIds) {
    const supa = supaProgress[wordId];
    const local = localProgress[wordId];

    if (!supa) {
      // Supabase에 없고 로컬에만 있는 경우: 로컬 데이터를 최신으로 간주
      merged[wordId] = local;
      localToSupaCount++;
      console.log(`[병합] 로컬 -> Supabase (새 단어): ${wordId}`);
    } else if (!local) {
      // 로컬에 없고 Supabase에만 있는 경우: Supabase 데이터를 최신으로 간주
      merged[wordId] = supa;
      supaToLocalCount++;
      console.log(`[병합] Supabase -> 로컬 (새 단어): ${wordId}`);
    } else {
      // 둘 다 있는 경우: last_reviewed_at 비교
      const supaTime = new Date(supa.last_reviewed_at || 0).getTime();
      const localTime = new Date(local.last_reviewed_at || 0).getTime();

      if (supaTime >= localTime) {
        merged[wordId] = supa;
        if (supaTime > localTime) {
          supaToLocalCount++;
          console.log(`[병합] Supabase -> 로컬 (최신): ${wordId}`);
        } else {
          console.log(`[병합] 동일 (Supabase 선택): ${wordId}`);
        }
      } else {
        merged[wordId] = local;
        localToSupaCount++;
        console.log(`[병합] 로컬 -> Supabase (최신): ${wordId}`);
      }
    }
  }
  console.log('병합 완료. 로컬 -> Supabase 업데이트 예정:', localToSupaCount, '건');
  console.log('Supabase -> 로컬 업데이트 예정:', supaToLocalCount, '건');


  // 4. Supabase/IndexedDB 모두에 병합 결과 반영
  // (a) Supabase upsert (최신 데이터만)
  const upserts = Object.values(merged).filter(row => row && row.user_id === userId);
  if (upserts.length > 0) {
    const { error: upsertError } = await supabase.from('user_word_progress').upsert(upserts, { onConflict: 'user_id, word_id' });
    if (upsertError) {
      console.error('Supabase upsert 실패:', upsertError);
    } else {
      console.log('Supabase upsert 성공:', upserts.length, '건');
    }
  } else {
    console.log('Supabase에 upsert할 데이터 없음.');
  }

  // (b) IndexedDB 저장
  await set(PROGRESS_KEY, merged);
  console.log('IndexedDB 저장 완료.');

  await setLastSyncDate(new Date().toISOString()); // 마지막 동기화 날짜 저장
  console.log('--- 동기화 종료 ---');
}
 