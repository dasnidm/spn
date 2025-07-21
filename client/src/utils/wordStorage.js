import { get, set, del } from 'idb-keyval';

const WORDS_KEY = 'words_data';
const PROGRESS_KEY = 'user_word_progress';

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

// --- User Progress Functions ---

export async function getProgress() {
  return (await get(PROGRESS_KEY)) || {};
}

export async function updateProgress(wordId, status) {
  const progress = await getProgress();
  progress[wordId] = { status, last_reviewed: new Date().toISOString() };
  await set(PROGRESS_KEY, progress);
}

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
      return {
        ...word,
        ...(progress[word.id] || { status: 'not_started' }),
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
 