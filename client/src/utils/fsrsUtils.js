import { FSRS } from 'ts-fsrs';

const fsrs = new FSRS();

/**
 * @typedef {Object} FSRSCard
 * @property {string|number} id
 * @property {number} stability
 * @property {number} difficulty
 * @property {Date} due
 * @property {number} state
 * @property {number} lapses
 * @property {Date|undefined} last_review
 */

/**
 * Word, UserWordProgress → FSRSCard 변환
 * @param {Object} word
 * @param {Object} progress
 * @returns {FSRSCard}
 */
export function toFSRSCard(word, progress) {
  return {
    id: String(word.id),
    stability: progress?.stability ?? 2.5,
    difficulty: progress?.difficulty ?? 2.5,
    due: progress?.next_review_at ? new Date(progress.next_review_at) : new Date(),
    state: progress?.state ?? 0,
    lapses: progress?.lapses ?? 0,
    last_review: progress?.last_reviewed_at ? new Date(progress.last_reviewed_at) : undefined,
  };
}

/**
 * FSRSCard → 예상 기억률(0~1)
 * @param {FSRSCard} card
 * @returns {number}
 */
export function getRecallProbability(card) {
  if (!card.stability || !card.last_review) return 0.0;
  const now = new Date();
  const elapsed_days = Math.max(0, (now - card.last_review) / (1000 * 60 * 60 * 24));
  return Math.exp(-elapsed_days / card.stability);
}

// recall(0~1) → HSL 색상 그라데이션
export function getMemoryColor(recall) {
  // 10% 미만은 어두운 회색으로 처리
  if (recall < 0.1) return '#444'; 
  
  const hue = 130; // 생생한 초록색의 색상(hue)
  
  // 채도(Saturation): 10%일 때 20, 100%일 때 80 (회색빛 -> 선명한 색)
  const saturation = 20 + (recall - 0.1) * (80 - 20) / 0.9;
  
  // 명도(Lightness): 10%일 때 35, 100%일 때 60 (어두운 색 -> 밝은 색)
  const lightness = 35 + (recall - 0.1) * (60 - 35) / 0.9;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// grade: 'again' | 'hard' | 'good' 등 → FSRS grade(1~4)
function mapLevelToFSRSGrade(level) {
  // FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy
  if (level === 'again') return 1;
  if (level === 'hard') return 2;
  if (level === 'good') return 3;
  if (level === 'easy') return 4;
  return 1; // 기본값: Again
}

// userWordProgress, word, level → FSRS 상태 갱신 결과 반환
export function updateFSRSProgress(userWordProgress, word, level) {
  const card = toFSRSCard(userWordProgress, word);
  const grade = mapLevelToFSRSGrade(level);
  const now = Date.now();
  const result = fsrs.repeat(card, grade, now);
  
  // result는 { [newState]: { card, log } } 형태의 객체입니다.
  // e.g., { "Review": { card: ..., log: ... } }
  // 따라서 Object.values()를 사용해 내부의 card 객체를 추출해야 합니다.
  const newCard = Object.values(result)[0].card;

  return {
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    due: newCard.due, // ms timestamp
    state: newCard.state,
    lapses: newCard.lapses,
    last_reviewed_at: new Date(now).toISOString(),
    next_review_at: new Date(newCard.due).toISOString(),
    status: grade >= 3 ? 'completed' : 'review_needed',
  };
} 