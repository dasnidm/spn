import { useMemo } from 'react';
import { groupWordsByPos } from '../utils/grouping';
import { getRecallProbability, toFSRSCard } from '../utils/fsrsUtils'; // FSRS 유틸리티 임포트

/**
 * 피라미드 표시에 필요한 모든 데이터 계산 및 상태 관리를 담당하는 훅
 * @param {Array<object>} words - 전체 단어 목록 (학습 상태 포함)
 * @param {string} viewMode - 'all' 또는 'layer'
 * @param {number|null} selectedLayer - 선택된 레벨
 * @param {string} sortMode - 'pos' 또는 'freq'
 * @param {object} stageSize - Konva Stage의 크기 { width, height }
 * @param {boolean} isMobile - 모바일 뷰 여부
 * @returns {object} 피라미드 표시에 필요한 모든 계산된 데이터
 */
export const usePyramidData = (words, viewMode, selectedLayer, sortMode, stageSize, isMobile) => {

    // 선택된 레이어나 정렬 모드가 바뀔 때마다 표시할 단어 목록을 업데이트
    const displayedWords = useMemo(() => {
        if (selectedLayer === null || !words || words.length === 0) {
            return [];
        }

        const startIndex = (selectedLayer - 1) * 100;
        const endIndex = Math.min(startIndex + 100, words.length);
        const selectedWords = words.slice(startIndex, endIndex);

        const sortedWords = [...selectedWords].sort((a, b) => {
            if (sortMode === 'pos') {
                const posA = a.pos || 'zzz';
                const posB = b.pos || 'zzz';
                if (posA < posB) return -1;
                if (posA > posB) return 1;
            }
            return a.frequency_rank - b.frequency_rank;
        });

        return sortedWords;
    }, [selectedLayer, sortMode, words]);

    /**
     * [핵심 수정] 앱의 새로운 철학에 따라 모든 통계를 재정의합니다.
     */
    const totalStats = useMemo(() => {
        if (!words || words.length === 0) {
            return { total: 0, learnedCount: 0, percent: 0, notStarted: 0, reviewNeeded: 0 };
        }
        
        const total = words.length;

        // 1. "학습한 단어" (진도율 n) = FSRS 기록이 있거나, 체크된 단어
        const learnedCount = words.filter(w => w.last_reviewed_at || w.is_checked).length;
        const percent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

        // 2. "미학습 단어" = 학습 기록도 없고, 체크도 안 된 단어
        const notStarted = total - learnedCount;

        // 3. "복습 필요 단어" = 체크 안 됐고, 기억률이 90% 미만인 단어
        const reviewNeeded = words.filter(w => {
            if (w.is_checked || !w.last_reviewed_at) {
                return false; // 체크됐거나, 학습 기록이 없으면 복습 대상이 아님
            }
            const recall = getRecallProbability(toFSRSCard(w, w));
            return recall < 0.9;
        }).length;

        return { total, learnedCount, percent, notStarted, reviewNeeded };
    }, [words]);

    // 전체 뷰 (피라미드) 레이아웃 계산
    const allViewLayouts = useMemo(() => {
        if (!words || words.length === 0 || !stageSize.width) return [];

        const levelCount = Math.ceil(words.length / 100);
        const layerHeight = isMobile ? 44 : 40;
        const maxLayerWidth = Math.max(300, stageSize.width * (isMobile ? 0.9 : 0.8));
        const verticalSpacing = 12;
        const topMargin = isMobile ? 120 : 80;
        
        return Array.from({ length: levelCount }, (_, i) => {
            const level = i + 1;
            const startIdx = i * 100;
            const endIdx = Math.min(startIdx + 100, words.length);
            
            const widthRatio = 0.4 + (i * 0.4 / levelCount);
            const layerWidth = Math.max(maxLayerWidth * widthRatio, maxLayerWidth * 0.4);
            const x = (stageSize.width - layerWidth) / 2;
            const y = topMargin + (i * (layerHeight + verticalSpacing));
            
            return {
                level,
                x: Math.max(0, x),
                y: Math.max(topMargin, y),
                width: Math.max(1, layerWidth),
                height: Math.max(1, layerHeight),
                startIdx,
                endIdx
            };
        });
    }, [words, stageSize.width, isMobile]);

    // 전체 뷰의 총 높이 계산
    const allViewTotalHeight = useMemo(() => {
        if (allViewLayouts.length === 0) return stageSize.height;
        const lastLayout = allViewLayouts[allViewLayouts.length - 1];
        return lastLayout.y + lastLayout.height + (isMobile ? 200 : 280);
    }, [allViewLayouts, stageSize.height, isMobile]);

    // 품사별로 그룹화된 단어들 계산
    const groupedByPos = useMemo(() => {
        if (sortMode !== 'pos' || displayedWords.length === 0) return {};
        return groupWordsByPos(displayedWords);
    }, [sortMode, displayedWords]);

    return { displayedWords, totalStats, allViewLayouts, allViewTotalHeight, groupedByPos };
};
