import { fsrs, createEmptyCard, generatorParameters, Rating, State } from 'ts-fsrs';

// README에 따라 FSRS 인스턴스를 생성합니다.
const f = fsrs(generatorParameters());

/**
 * DB의 word/progress 정보를 FSRS 라이브러리가 사용하는 Card 객체로 변환합니다.
 * DB에서 온 데이터가 null일 수 있는 모든 예외 케이스를 처리하도록 수정되었습니다.
 * @param {object} progressOrWord - user_word_progress 정보가 포함된 word 객체
 * @param {object} [word] - (옵션) word 객체.
 * @returns {import('ts-fsrs').Card} FSRS 카드 객체
 */
export const toFSRSCard = (progressOrWord, word) => {
  const source = progressOrWord || {};
  const card = createEmptyCard(new Date());

  if (!source.last_reviewed_at) {
    return card;
  }

  card.due = new Date(source.next_review_at);
  card.stability = source.stability ?? 0;
  card.difficulty = source.difficulty ?? 0;
  card.state = source.state ?? State.New;
  card.lapses = source.lapses ?? 0;
  card.last_review = new Date(source.last_reviewed_at);
  
  return card;
};


/**
 * FSRS 카드의 현재 예상 기억률(retrievability)을 계산합니다.
 * @param {import('ts-fsrs').Card} card - FSRS 카드 객체
 * @returns {number} 예상 기억률 (0.0 ~ 1.0 사이의 확률 값)
 */
export function getRecallProbability(card) {
  if (!card.last_review) {
    return 0;
  }
  
  const now = new Date();
  const recall = f.get_retrievability(card, now);
  
  const rawProbability = recall ? parseFloat(recall) : 0;

  // [핵심 수정] 라이브러리가 0-100 범위의 백분율을 반환하는 경우에 대비하여
  // 0-1 범위의 확률 값으로 정규화합니다.
  if (rawProbability > 1) {
    return rawProbability / 100;
  }
  
  return rawProbability;
}


/**
 * 예상 기억률에 따라 시각적 피드백을 위한 HSL 색상을 반환합니다.
 * @param {number} recall - 예상 기억률 (0.0 ~ 1.0)
 * @returns {string} HSL 색상 문자열
 */
export function getMemoryColor(recall) {
  if (recall < 0.1) return '#444';
  
  const hue = 130; // 초록색 계열
  const saturation = 20 + (recall - 0.1) * (80 - 20) / 0.9;
  const lightness = 35 + (recall - 0.1) * (60 - 35) / 0.9;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


/**
 * 사용자의 학습 평가('again', 'hard', 'good')를 FSRS의 Rating 값으로 변환합니다.
 * @param {string} level - 사용자의 평가 ('again', 'hard', 'good')
 * @returns {Rating} FSRS Rating 값
 */
function mapLevelToFSRSRating(level) {
  const ratingMap = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
  };
  return ratingMap[level] || Rating.Again;
}


/**
 * 학습 활동을 기반으로 FSRS 상태를 업데이트하고, DB에 저장할 완전한 객체를 반환합니다.
 * @param {object} userWordProgress - 현재 단어의 학습 진행 상태
 * @param {object} word - 현재 단어 정보
 * @param {string} level - 사용자의 평가 ('again', 'hard', 'good')
 * @returns {object} user_word_progress 테이블 스키마와 일치하는 객체
 */
export const updateFSRSProgress = (userWordProgress, word, level) => {
  const card = toFSRSCard(userWordProgress, word);
  const now = new Date();
  const rating = mapLevelToFSRSRating(level);

  const scheduling_cards = f.repeat(card, now);
  const newCard = scheduling_cards[rating].card;

  let status;
  if (newCard.state === State.Review) {
    status = 'review_needed';
  } else if (newCard.state === State.Learn || newCard.state === State.Relearn) {
    status = 'in_progress';
  } else {
    status = 'completed';
  }

  return {
    status: status,
    last_reviewed_at: now.toISOString(),
    next_review_at: newCard.due.toISOString(),
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    state: newCard.state,
    lapses: newCard.lapses,
  };
};
