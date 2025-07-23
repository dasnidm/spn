/**
 * 날짜를 'YYYY-MM-DD' 형식의 문자열로 변환합니다.
 * 타임존 문제를 피하기 위해 UTC 기준 날짜를 사용합니다.
 * @param {Date} date - 변환할 Date 객체
 * @returns {string} 'YYYY-MM-DD' 형식의 날짜 문자열
 */
const toDateString = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 두 날짜 사이의 일수 차이를 계산합니다.
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number} 두 날짜 사이의 일수
 */
const getDaysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1 - date2) / oneDay));
};

/**
 * 전체적인 학습 통계를 계산합니다.
 * @param {Array} words - 학습 진행률이 병합된 단어 객체 배열
 * @returns {Object} 주요 통계 지표
 */
export const calculateOverallStats = (words) => {
  if (!words || words.length === 0) {
    return {
      totalWords: 0,
      learnedWords: 0,
      completedWords: 0,
      learningWords: 0,
      progressPercentage: 0,
    };
  }

  const totalWords = words.length;
  const learnedWords = words.filter(w => w.status && w.status !== 'not_started').length;
  const completedWords = words.filter(w => w.status === 'completed').length;
  const learningWords = learnedWords - completedWords;
  const progressPercentage = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;

  return {
    totalWords,
    learnedWords,
    completedWords,
    learningWords,
    progressPercentage,
  };
};

/**
 * 일일 학습 활동을 집계합니다. (학습 캘린더용 데이터)
 * @param {Array} words - 학습 진행률이 병합된 단어 객체 배열
 * @returns {Object} 날짜를 key로, 학습한 단어 수를 value로 갖는 객체
 */
export const getDailyActivity = (words) => {
  const activity = {};
  words.forEach(word => {
    if (word.last_reviewed_at) {
      const dateStr = toDateString(new Date(word.last_reviewed_at));
      activity[dateStr] = (activity[dateStr] || 0) + 1;
    }
  });
  return activity;
};

/**
 * 연속 학습일과 최장 연속 학습일을 계산합니다.
 * @param {Object} dailyActivity - getDailyActivity에서 반환된 객체
 * @returns {{currentStreak: number, longestStreak: number}}
 */
export const calculateLearningStreak = (dailyActivity) => {
  const dates = Object.keys(dailyActivity).sort();
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 0;
  let currentStreak = 0;

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
      longestStreak = 1;
    } else {
      const currentDate = new Date(dates[i]);
      const prevDate = new Date(dates[i - 1]);
      const diff = getDaysBetween(currentDate, prevDate);

      if (diff === 1) {
        currentStreak++;
      } else {
        currentStreak = 1; // 연속이 끊김
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  }

  // 오늘 또는 어제 학습했는지 확인하여 현재 연속 학습일 결정
  const today = new Date();
  const lastLearningDate = new Date(dates[dates.length - 1]);
  const diffFromToday = getDaysBetween(today, lastLearningDate);

  if (diffFromToday > 1) {
    currentStreak = 0; // 마지막 학습일이 이틀 이상 전이면 연속일은 0
  }

  return { currentStreak, longestStreak };
};

/**
 * 품사별 학습 통계를 계산합니다.
 * @param {Array} words - 학습 진행률이 병합된 단어 객체 배열
 * @returns {Object} 품사를 key로, 해당 품사의 통계를 value로 갖는 객체
 */
export const getStatsByPOS = (words) => {
  const stats = {};
  
  words.forEach(word => {
    const pos = word.part_of_speech || 'N/A';
    if (!stats[pos]) {
      stats[pos] = { total: 0, learned: 0 };
    }
    stats[pos].total++;
    if (word.status && word.status !== 'not_started') {
      stats[pos].learned++;
    }
  });

  // 퍼센티지 계산
  for (const pos in stats) {
    stats[pos].percentage = stats[pos].total > 0 
      ? Math.round((stats[pos].learned / stats[pos].total) * 100) 
      : 0;
  }

  return stats;
};
