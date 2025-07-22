import { useState, useEffect, useMemo } from 'react';
import { groupWordsByPos } from '../utils/grouping'; // (나중에 생성할 파일)

// 이 훅은 피라미드 표시에 필요한 모든 데이터 계산 및 상태 관리를 담당합니다.
export const usePyramidData = (words, viewMode, selectedLayer, sortMode, stageSize, isMobile) => {

    const [displayedWords, setDisplayedWords] = useState([]);

    // 선택된 레이어나 정렬 모드가 바뀔 때마다 표시할 단어 목록을 업데이트
    useEffect(() => {
        if (selectedLayer === null || !words || words.length === 0) {
            setDisplayedWords([]);
            return;
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

        setDisplayedWords(sortedWords);
    }, [selectedLayer, sortMode, words]);

    // 전체 통계 계산
    const totalStats = useMemo(() => {
        if (!words || words.length === 0) return { total: 0, completed: 0, notStarted: 0, reviewNeeded: 0, percent: 0 };
        const total = words.length;
        const completed = words.filter(w => w.status === 'completed').length;
        const notStarted = words.filter(w => !w.status || w.status === 'not_started').length;
        const reviewNeeded = words.filter(w => w.status === 'review_needed').length;
        const percent = Math.round((completed / total) * 100);
        return { total, completed, notStarted, reviewNeeded, percent };
    }, [words]);

    // 전체 뷰 (피라미드) 레이아웃 계산
    const allViewLayouts = useMemo(() => {
        if (!words || words.length === 0 || !stageSize.width) return [];

        const levelCount = Math.ceil(words.length / 100);
        const levelStart = 1;
        const layerHeight = isMobile ? 44 : 40;
        const maxLayerWidth = Math.max(300, stageSize.width * (isMobile ? 0.9 : 0.8));
        const verticalSpacing = 12;
        const topMargin = isMobile ? 120 : 80;
        
        return Array.from({ length: levelCount }, (_, i) => {
            const level = levelStart + i;
            const startIdx = (level - 1) * 100;
            const endIdx = Math.min(level * 100, words.length);
            const layerWords = words.slice(startIdx, endIdx);
            const stats = {
                completed: layerWords.filter(w => w.status === 'completed').length,
                review_needed: layerWords.filter(w => w.status === 'review_needed').length,
                total: layerWords.length
            };
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
                stats,
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