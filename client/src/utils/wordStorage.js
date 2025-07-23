import { get, set, del } from 'idb-keyval';
import supabase from '../supabaseClient';

const WORDS_KEY = 'words_data';
const PROGRESS_KEY = 'user_word_progress';
const LAST_SYNC_DATE_KEY = 'last_sync_date';
const VERBS_KEY = 'verb_conjugations_data';
const VERB_PROGRESS_KEY = 'user_verb_progress';

// --- 단어 데이터 함수 ---

export async function getWordsFromIndexedDB() {
  try {
    return await get(WORDS_KEY);
  } catch (error) {
    console.error('IndexedDB에서 단어 데이터 로드 실패:', error);
    return null;
  }
}

export async function saveWordsToIndexedDB(words) {
  try {
    await set(WORDS_KEY, words);
  } catch (error) {
    console.error('IndexedDB에 단어 데이터 저장 실패:', error);
  }
}

export async function fetchAndCacheWords() {
  try {
    const cachedWords = await getWordsFromIndexedDB();
    if (cachedWords && Array.isArray(cachedWords) && cachedWords.length > 0) {
      return cachedWords;
    }

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
    console.error('단어 데이터 로드/캐시 중 오류:', error);
    return null;
  }
}

export async function clearWordsFromIndexedDB() {
  await del(WORDS_KEY);
}

// --- 동기화 날짜 함수 ---

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

// --- 동사 데이터 함수 ---

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

// --- 사용자 학습 진행 데이터 함수 (최종) ---

export async function getProgress() {
  return (await get(PROGRESS_KEY)) || {};
}

export async function updateProgress(wordId, progressObj) {
  const progress = await getProgress();
  
  const completeProgress = {
    ...progressObj,
    is_checked: progressObj.is_checked || false,
  };

  progress[wordId.toString()] = completeProgress;
  await set(PROGRESS_KEY, progress);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      const upsertData = {
        user_id: user.id,
        word_id: wordId,
        ...completeProgress
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
      return [];
    }

    const mergedWords = words.map(word => {
      if (!word || !word.id) {
        return word;
      }
      const prog = progress[word.id.toString()] || {};
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

export async function resetAndSyncWithServer(userId) {
  console.log('--- 서버 데이터로 강제 동기화 시작 ---');

  // 1. 로컬 진행률 데이터 삭제
  await del(PROGRESS_KEY);
  await del(VERB_PROGRESS_KEY); // 동사 진행률도 로컬에서는 삭제
  console.log('로컬 캐시(단어/동사 진행률) 삭제 완료.');

  // 2. 서버에서 단어 진행률 데이터 가져오기
  const { data: supaWordRows, error: supaWordError } = await supabase
    .from('user_word_progress')
    .select('*')
    .eq('user_id', userId);

  if (supaWordError) {
    console.error('Supabase 단어 진행률 fetch 실패:', supaWordError);
    throw supaWordError;
  }
  
  // 3. 가져온 데이터로 로컬 캐시(단어) 재구성
  const newWordProgress = {};
  for (const row of supaWordRows) {
    const { user_id, ...progressData } = row;
    newWordProgress[row.word_id.toString()] = progressData;
  }
  await set(PROGRESS_KEY, newWordProgress);
  console.log(`${supaWordRows.length}개의 단어 진행률을 서버에서 가져와 로컬에 저장했습니다.`);

  // 4. 서버에서 동사 진행률 데이터 가져오기 (임시 비활성화)
  /*
  const { data: supaVerbRows, error: supaVerbError } = await supabase
    .from('user_verb_progress')
    .select('*')
    .eq('user_id', userId);

  if (supaVerbError) {
    console.error('Supabase 동사 진행률 fetch 실패:', supaVerbError);
    throw supaVerbError;
  }
  */

  // 5. 가져온 데이터로 로컬 캐시(동사) 재구성 (임시 비활성화)
  /*
  const newVerbProgress = {};
  for (const row of supaVerbRows) {
    const { user_id, ...progressData } = row;
    newVerbProgress[row.word_id.toString()] = progressData;
  }
  await set(VERB_PROGRESS_KEY, newVerbProgress);
  console.log(`${supaVerbRows.length}개의 동사 진행률을 서버에서 가져와 로컬에 저장했습니다.`);
  */
  
  // 6. 마지막 동기화 날짜 업데이트
  await setLastSyncDate(new Date().toISOString());
  console.log('--- 강제 동기화 성공적으로 종료 ---');

  return supaWordRows.length; // 동사 진행률 개수는 제외
}

export async function syncProgressWithSupabase(userId) {
  console.log('--- 동기화 시작 ---');
  
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
    supaProgress[row.word_id.toString()] = row;
  }

  const localProgress = await getProgress();
  const mergedProgress = {};
  const allWordIds = new Set([...Object.keys(supaProgress), ...Object.keys(localProgress)]);

  for (const wordIdStr of allWordIds) {
    const supa = supaProgress[wordIdStr];
    const local = localProgress[wordIdStr] ? { is_checked: false, ...localProgress[wordIdStr] } : null;
    let definitiveRecord;

    if (!supa) {
      definitiveRecord = { ...local, user_id: userId, word_id: parseInt(wordIdStr, 10) };
    } else if (!local) {
      definitiveRecord = supa;
    } else {
      const supaTime = new Date(supa.last_reviewed_at || 0).getTime();
      const localTime = new Date(local.last_reviewed_at || 0).getTime();
      definitiveRecord = supaTime >= localTime ? supa : { ...local, user_id: userId, word_id: parseInt(wordIdStr, 10) };
    }
    mergedProgress[wordIdStr] = definitiveRecord;
  }

  const upserts = Object.values(mergedProgress);
  if (upserts.length > 0) {
    const { error: upsertError } = await supabase.from('user_word_progress').upsert(upserts, { onConflict: 'user_id, word_id' });
    if (upsertError) {
      console.error('동기화 중 Supabase upsert 실패:', upsertError);
    }
  }

  await set(PROGRESS_KEY, mergedProgress);
  await setLastSyncDate(new Date().toISOString());
  console.log('--- 동기화 종료 ---');
}


// --- 동사 학습 진행 데이터 함수 ---

export async function getVerbProgress() {
  return (await get(VERB_PROGRESS_KEY)) || {};
}

export async function updateVerbProgress(wordId, progressData) {
  const progress = await getVerbProgress();
  progress[wordId.toString()] = progressData;
  await set(VERB_PROGRESS_KEY, progress);

  // 서버 업데이트 로직 임시 비활성화
  /*
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      const upsertData = {
        user_id: user.id,
        word_id: wordId,
        ...progressData
      };
      const { error } = await supabase
        .from('user_verb_progress')
        .upsert(upsertData, { onConflict: 'user_id, word_id' });
      if (error) console.error('Supabase 동사 진도 업데이트 실패:', error);
    }
  } catch (error) {
    console.error('사용자 정보 가져오기 또는 Supabase 동사 업데이트 중 오류:', error);
  }
  */
}

export async function syncVerbProgressWithSupabase(userId) {
  // 전체 함수 임시 비활성화
  console.log('동사 진행률 서버 동기화는 현재 비활성화되어 있습니다.');
  return;
  /*
  const { data: supaRows, error: supaError } = await supabase
    .from('user_verb_progress')
    .select('*')
    .eq('user_id', userId);

  if (supaError) {
    console.error('Supabase 동사 진도 fetch 실패:', supaError);
    return;
  }

  const supaProgress = {};
  supaRows.forEach(row => { supaProgress[row.word_id.toString()] = row; });

  const localProgress = await getVerbProgress();
  const mergedProgress = {};
  const allWordIds = new Set([...Object.keys(supaProgress), ...Object.keys(localProgress)]);

  for (const wordIdStr of allWordIds) {
    const supa = supaProgress[wordIdStr];
    const local = localProgress[wordIdStr];
    if (!supa) {
      mergedProgress[wordIdStr] = { ...local, user_id: userId, word_id: parseInt(wordIdStr, 10) };
    } else if (!local) {
      mergedProgress[wordIdStr] = supa;
    } else {
      const supaTime = new Date(supa.last_reviewed_at || 0).getTime();
      const localTime = new Date(local.last_reviewed_at || 0).getTime();
      mergedProgress[wordIdStr] = supaTime >= localTime ? supa : { ...local, user_id: userId, word_id: parseInt(wordIdStr, 10) };
    }
  }

  const upserts = Object.values(mergedProgress);
  if (upserts.length > 0) {
    const { error: upsertError } = await supabase.from('user_verb_progress').upsert(upserts, { onConflict: 'user_id, word_id' });
    if (upsertError) console.error('동기화 중 Supabase 동사 upsert 실패:', upsertError);
  }

  await set(VERB_PROGRESS_KEY, mergedProgress);
  */
}
