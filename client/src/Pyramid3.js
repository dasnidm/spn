
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { animated, useSprings } from '@react-spring/konva';
import Konva from 'konva';
import FlashcardModal from './FlashcardModal';
import { updateProgress } from './utils/wordStorage';

// --- Constants ---
const POS_COLORS = {
    n: '#4FC3F7', v: '#81C784', adj: '#FFD54F', adv: '#BA68C8',
    pron: '#FF8A65', prep: '#90A4AE', conj: '#A1887F', art: '#B0BEC5',
    num: '#F06292', default: '#BDBDBD'
};
const STATUS_COLORS = {
    completed: '#81C784',
    review_needed: '#F06292',
    not_started: '#555555'
};
const POS_ORDER = ['n', 'v', 'adj', 'adv', 'pron', 'prep', 'conj', 'art', 'num', 'default'];
const ANIM_CONFIG = { mass: 1, tension: 300, friction: 35, clamp: true };

function getPosGroup(pos) {
    if (!pos) return 'default';
    const p = pos.toLowerCase();
    if (p.startsWith('n')) return 'n';
    if (p.startsWith('v')) return 'v';
    if (p.startsWith('adj')) return 'adj';
    if (p.startsWith('adv')) return 'adv';
    if (p.startsWith('pron')) return 'pron';
    if (p.startsWith('prep')) return 'prep';
    if (p.startsWith('conj')) return 'conj';
    if (p.startsWith('art')) return 'art';
    if (p.startsWith('num')) return 'num';
    return 'default';
}

const Pyramid = ({ words, setWords }) => {
    const containerRef = useRef();
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [viewMode, setViewMode] = useState('all');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const [flashcardWord, setFlashcardWord] = useState(null);
    const [layerScrollY, setLayerScrollY] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 전체 뷰 네모 레이아웃 계산 (빈도수 순서)
    const allViewLayouts = useMemo(() => {
        if (!containerSize.width || !words.length) return [];
        const layerViewPadding = 20;
        const availableWidth = containerSize.width - layerViewPadding * 2;
        const blocksPerRow = containerSize.width < 600 ? 8 : 15;
        const blockMargin = 4;
        const blockSize = Math.max(1, (availableWidth - (blocksPerRow - 1) * blockMargin) / blocksPerRow);
        return words.map((word, idx) => {
            const layerIdx = Math.floor(idx / 100);
            const idxInLayer = idx % 100;
            const row = Math.floor(idxInLayer / blocksPerRow);
            const col = idxInLayer % blocksPerRow;
            return {
                x: layerViewPadding + col * (blockSize + blockMargin),
                y: 60 + layerIdx * 400 + row * (blockSize + blockMargin),
                width: blockSize,
                height: blockSize,
                opacity: 1
            };
        });
    }, [containerSize, words]);

    // 계층 뷰 네모 레이아웃 계산 (빈도수 순서)
    const layerViewLayouts = useMemo(() => {
        if (selectedLayer === null || !containerSize.width || !words.length) return [];
        const layerWords = words
            .slice(selectedLayer * 100, (selectedLayer + 1) * 100)
            .sort((a, b) => a.frequency_rank - b.frequency_rank);
        const layerViewPadding = 20;
        const availableWidth = containerSize.width - layerViewPadding * 2;
        const blocksPerRow = containerSize.width < 600 ? 8 : 15;
        const blockMargin = 4;
        const blockSize = Math.max(1, (availableWidth - (blocksPerRow - 1) * blockMargin) / blocksPerRow);
        return layerWords.map((word, idx) => {
            const row = Math.floor(idx / blocksPerRow);
            const col = idx % blocksPerRow;
            return {
                x: layerViewPadding + col * (blockSize + blockMargin),
                y: 60 + row * (blockSize + blockMargin),
                width: blockSize,
                height: blockSize,
                opacity: 1
            };
        });
    }, [selectedLayer, containerSize, words]);

    // 계층 뷰 진입 시 전체 뷰 위치에서 계층 뷰 위치로 spring 애니메이션
    const selectedWords = useMemo(() => {
        if (selectedLayer === null) return [];
        return words
            .slice(selectedLayer * 100, (selectedLayer + 1) * 100)
            .sort((a, b) => a.frequency_rank - b.frequency_rank);
    }, [selectedLayer, words]);

    // 전체 뷰에서의 위치(from), 계층 뷰 목표 위치(to)
    const fromLayouts = useMemo(() => {
        if (selectedLayer === null) return [];
        const startIdx = selectedLayer * 100;
        return words.slice(startIdx, startIdx + 100).map((word, idx) => allViewLayouts[startIdx + idx] || { x: 0, y: 0, width: 0, height: 0, opacity: 0 });
    }, [selectedLayer, words, allViewLayouts]);
    const toLayouts = layerViewLayouts;

    const [springs, api] = useSprings(selectedWords.length, i => ({
        ...(fromLayouts[i] || { x: 0, y: 0, width: 0, height: 0, opacity: 0 }),
        scale: { x: 1, y: 1 },
        config: ANIM_CONFIG,
    }), [selectedWords.length, fromLayouts]);

    useEffect(() => {
        if (viewMode === 'layer' && selectedWords.length && toLayouts.length) {
            api.start(i => ({
                ...(toLayouts[i] || { x: 0, y: 0, width: 0, height: 0, opacity: 0 }),
                scale: { x: 1, y: 1 },
                opacity: 1,
                delay: i * 5
            }));
        }
    }, [viewMode, selectedWords, toLayouts, api]);

    const handleMarkAsCompleted = async (word) => {
        await updateProgress(word.id, 'completed');
        const newWords = words.map(w => w.id === word.id ? { ...w, status: 'completed' } : w);
        setWords(newWords);
        setFlashcardWord(null);
    };

    const handleWheel = useCallback((e) => {
        if (viewMode !== 'layer') return;
        e.evt.preventDefault();
        setLayerScrollY(prev => {
            const newScrollY = prev + e.evt.deltaY;
            const maxScroll = Math.max(0, layerViewLayouts.length * 400 - containerSize.height + 60); // Adjusted for layer view height
            return Math.max(0, Math.min(newScrollY, maxScroll));
        });
    }, [viewMode, layerViewLayouts.length, containerSize.height]);

    const changeCursor = (cursor) => (e) => e.target.getStage().container().style.cursor = cursor;

    // spring 객체를 안전하게 숫자로 변환하는 함수
    function getSpringValue(val) {
        if (val && typeof val.get === 'function') return val.get();
        if (val && typeof val.to === 'function') return val.to(n => n);
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return Number(val);
        return 10; // fallback
    }

    // 계층별 진도율 summary 계산
    const layerSummaries = useMemo(() => {
        const layerCount = Math.ceil(words.length / 100);
        const summaries = [];
        for (let i = 0; i < layerCount; i++) {
            const layerWords = words.slice(i * 100, (i + 1) * 100);
            summaries.push({
                completed: layerWords.filter(w => w.status === 'completed').length,
                review_needed: layerWords.filter(w => w.status === 'review_needed').length,
                total: layerWords.length
            });
        }
        return summaries;
    }, [words]);

    // 상단 바(HTML) 분리
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', overflow: 'hidden' }}>
            {/* 상단 바 */}
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', zIndex: 10, background: '#1a1a1a', display: 'flex', alignItems: 'center', padding: '0 24px', height: 56 }}>
                {viewMode === 'layer' && (
                    <button style={{ marginRight: 16, fontSize: 18, background: 'none', color: '#4FC3F7', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setViewMode('all')}>
                        {'< Back to Pyramid'}
                    </button>
                )}
                <span style={{ fontSize: 32, fontWeight: 700, color: 'white', marginRight: 32 }}>Vocabulario Inteligente</span>
                <div style={{ flex: 1 }} />
                <button style={{ marginRight: 8 }}>Sign Out</button>
                <button style={{ marginRight: 8 }}>학습 메뉴로 이동</button>
                <button>데이터 새로고침</button>
            </div>
            {/* Stage 영역 */}
            <div ref={containerRef} style={{ width: '100vw', height: 'calc(100vh - 56px)', position: 'absolute', top: 56, left: 0, background: '#1a1a1a' }}>
                <Stage width={containerSize.width} height={containerSize.height}>
                    {/* --- ALL VIEW --- */}
                    <Layer visible={viewMode === 'all'}>
                        {layerSummaries.map((summary, i) => {
                            const barWidth = containerSize.width * 0.8 - (i * containerSize.width * 0.01);
                            const barHeight = Math.max(12, (containerSize.height / (layerSummaries.length + 2)) * 0.6);
                            const x = (containerSize.width - barWidth) / 2;
                            const y = containerSize.height * 0.95 - (i + 1) * (barHeight + 4);
                            const completedWidth = (summary.completed / summary.total) * barWidth;
                            const reviewWidth = (summary.review_needed / summary.total) * barWidth;
                            return (
                                <Group key={i} x={x} y={y} 
                                    onClick={() => { setViewMode('layer'); setSelectedLayer(i); setLayerScrollY(0); }} 
                                    onTap={() => { setViewMode('layer'); setSelectedLayer(i); setLayerScrollY(0); }}
                                    onMouseEnter={changeCursor('pointer')} onMouseLeave={changeCursor('default')}
                                >
                                    <Rect width={barWidth} height={barHeight} fill={STATUS_COLORS.not_started} cornerRadius={4} />
                                    <Rect width={completedWidth + reviewWidth} height={barHeight} fill={STATUS_COLORS.review_needed} cornerRadius={4} />
                                    <Rect width={completedWidth} height={barHeight} fill={STATUS_COLORS.completed} cornerRadius={4} />
                                    <Text text={`Level ${i + 1} (${i * 100 + 1} - ${(i + 1) * 100})`} x={10} y={(barHeight - 14) / 2} fill="white" fontSize={14} fontStyle="bold" listening={false} />
                                </Group>
                            );
                        })}
                    </Layer>

                    {/* --- LAYER VIEW --- */}
                    <Layer visible={viewMode === 'layer'} y={-layerScrollY}>
                        {/* Back to Pyramid 버튼을 Rect+Text로 감싸 클릭 영역 확장 */}
                        <Group
                            x={20}
                            y={20 + layerScrollY}
                            onClick={() => setViewMode('all')}
                            onTap={() => setViewMode('all')}
                            onMouseEnter={changeCursor('pointer')}
                            onMouseLeave={changeCursor('default')}
                            listening={true}
                        >
                            <Rect width={160} height={32} fill="#222" opacity={0.12} cornerRadius={8} listening={true} />
                            <Text
                                text="< Back to Pyramid"
                                x={8}
                                y={6}
                                fontSize={18}
                                fill="#4FC3F7"
                                fontStyle="bold"
                                listening={true}
                            />
                        </Group>
                        {layerViewLayouts.map((layout, idx) => (
                            <Text key={idx} x={20} y={layout.y} text={`Level ${idx + 1} (${idx * 100 + 1} - ${(idx + 1) * 100})`} fontSize={16} fill="#aaa" fontStyle="bold" />
                        ))}
                        {springs.map((props, i) => {
                            const word = selectedWords[i];
                            const key = String(word.id);
                            // width/height spring 객체 안전 변환
                            const width = getSpringValue(props.width);
                            const height = getSpringValue(props.height);
                            return (
                                <animated.Group
                                    key={key}
                                    {...props}
                                    onClick={() => setFlashcardWord(word)}
                                    onTap={() => setFlashcardWord(word)}
                                    onMouseEnter={(e) => {
                                        changeCursor('pointer')(e);
                                        api.start(j => (i === j ? { scale: { x: 1.1, y: 1.1 }, shadowBlur: 10 } : { scale: { x: 1, y: 1 }, shadowBlur: 0 }));
                                    }}
                                    onMouseLeave={(e) => {
                                        changeCursor('default')(e);
                                        api.start(j => (i === j ? { scale: { x: 1, y: 1 }, shadowBlur: 0 } : {}));
                                    }}
                                >
                                    <Rect
                                        width={width}
                                        height={height}
                                        fill={POS_COLORS[getPosGroup(word.part_of_speech)] || POS_COLORS.default}
                                        cornerRadius={4}
                                        shadowColor="black"
                                        shadowOpacity={0.3}
                                    />
                                    <Text
                                        text={word.spanish}
                                        width={width}
                                        height={height}
                                        align="center"
                                        verticalAlign="middle"
                                        fontSize={16}
                                        fill="white"
                                        fontStyle="bold"
                                        listening={false} // Important for performance
                                        ellipsis={true}
                                    />
                                </animated.Group>
                            );
                        })}
                    </Layer>
                </Stage>

                <FlashcardModal
                    isOpen={!!flashcardWord}
                    onRequestClose={() => setFlashcardWord(null)}
                    word={flashcardWord}
                    onMarkAsCompleted={handleMarkAsCompleted}
                />
            </div>
        </div>
    );
};

export default Pyramid;



