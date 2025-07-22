/**
 * 사용자의 설정에 따라 학습할 단어 목록을 필터링하고 정렬합니다.
 * @param {Array} allWords - 필터링할 전체 단어 배열. 각 단어는 status, frequency_rank, spanish, korean 등의 속성을 가져야 합니다.
 * @param {Object} settings - 필터링 설정을 담은 객체.
 * @param {string} settings.filter - 필터링 종류 ('recommended', 'review_needed', 'custom').
 * @param {Array<number>} settings.selectedLevels - 'custom' 필터 시 선택된 레벨 배열.
 * @param {string|number} settings.count - 가져올 단어의 수 ('all' 또는 숫자).
 * @returns {Array} - 필터링 및 정렬된 단어 배열.
 */
export function filterWords(allWords, settings) {
    const { filter, selectedLevels, count } = settings;
    let filtered = [];

    if (filter === 'recommended') {
        // 추천: 미학습 단어 중 빈도수 상위 100개
        filtered = allWords
            .filter(w => !w.status || w.status === 'not_started')
            .sort((a, b) => a.frequency_rank - b.frequency_rank)
            .slice(0, 100);
    } else if (filter === 'review_needed') {
        // 복습 필요: status가 'review_needed'인 단어
        filtered = allWords.filter(w => w.status === 'review_needed');
    } else if (filter === 'custom' && selectedLevels && selectedLevels.length > 0) {
        // 사용자 정의: 선택된 레벨 구간에 해당하는 단어
        const ranges = selectedLevels.map(lv => [1 + (lv - 1) * 100, lv * 100]);
        filtered = allWords.filter(w => {
            const rank = Number(w.frequency_rank);
            return ranges.some(([start, end]) => rank >= start && rank <= end);
        });
    } else {
        // 기본: 모든 단어
        filtered = allWords;
    }

    // 유효한 단어만 필터링 (spanish, korean 필드 확인)
    let finalWords = filtered.filter(w => w && w.spanish && w.korean);

    // 최종 개수 적용 (무작위로 섞은 후 잘라내기)
    if (count !== 'all') {
        finalWords = finalWords.sort(() => Math.random() - 0.5).slice(0, Number(count));
    }

    return finalWords;
}
