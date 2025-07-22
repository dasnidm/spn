/**
 * 단어 배열을 품사(pos)에 따라 그룹화합니다.
 * @param {Array} words - 그룹화할 단어 배열. 각 단어는 'pos' 속성을 가져야 합니다.
 * @returns {Object} - 품사를 키로, 해당 품사의 단어 배열을 값으로 갖는 객체.
 */
export function groupWordsByPos(words) {
    const groups = {};
    words.forEach(word => {
        const pos = word.pos || '기타'; // 품사가 없는 경우 '기타'로 분류
        if (!groups[pos]) {
            groups[pos] = [];
        }
        groups[pos].push(word);
    });
    return groups;
}
