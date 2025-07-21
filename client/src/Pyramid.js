import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';

// 상태별 색상
const STATUS_COLORS = {
    completed: '#66BB6A',
    review_needed: '#FFA726',
    not_started: '#444'
};

// 품사별 색상
const POS_COLORS = {
    noun: '#4FC3F7',
    verb: '#66BB6A',
    adjective: '#FFA726',
    adverb: '#9575CD',
    pronoun: '#FF8A65',
    preposition: '#90A4AE',
    conjunction: '#A1887F',
    article: '#B0BEC5',
    numeral: '#F06292',
    default: '#BDBDBD'
};

// 버튼 스타일
const buttonStyle = {
    background: '#2c2c2e',
    color: 'white',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginLeft: 8,
    minWidth: 110,
    fontSize: 15,
    whiteSpace: 'nowrap'
};

const Pyramid = ({ words, setWords }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('all');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const [hoveredWord, setHoveredWord] = useState(null);
    const [sortMode, setSortMode] = useState('pos');
    const [displayedWords, setDisplayedWords] = useState([]); // 정렬된 단어를 저장할 새로운 상태
    const containerRef = useRef(null);
    const [stageSize, setStageSize] = useState({ 
        width: window.innerWidth, 
        height: window.innerHeight - (viewMode === 'layer' ? 112 : 56)
    });
    const [user, setUser] = useState(null);
    const stageRef = useRef(null);

    // 사용자 정보 가져오기
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    // 윈도우 크기 변경 감지
    useEffect(() => {
        const handleResize = () => {
            setStageSize({
                width: window.innerWidth,
                height: window.innerHeight - (viewMode === 'layer' ? 112 : 56)
            });
        };

        window.addEventListener('resize', handleResize);
        // handleResize(); // 초기 크기 설정 - 이 부분을 제거합니다.

        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

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

    // 계층별 통계 계산
    const layerStats = useMemo(() => {
        if (!words || words.length === 0) return [];
        
        const layerCount = Math.ceil(words.length / 100);
        return Array.from({ length: layerCount }, (_, i) => {
            const layerWords = words.slice(i * 100, Math.min((i + 1) * 100, words.length));
            return {
                completed: layerWords.filter(w => w.status === 'completed').length,
                review_needed: layerWords.filter(w => w.status === 'review_needed').length,
                total: layerWords.length
            };
        });
    }, [words]);

    // 전체 뷰 (피라미드) 레이아웃
    const allViewLayouts = useMemo(() => {
        if (!words || words.length === 0 || !stageSize.width) return [];

        const levelCount = Math.ceil(words.length / 100);
        const levelStart = 1;
        const minLayerHeight = 30;
        const maxLayerWidth = Math.max(300, stageSize.width * 0.8);
        const verticalSpacing = 12;
        const topMargin = 80;
        const bottomMargin = 200;

        // 모든 계층이 표시되도록 충분한 높이 계산
        const totalHeight = levelCount * (minLayerHeight + verticalSpacing) + topMargin + bottomMargin;
        const layerHeight = Math.max(minLayerHeight, (totalHeight - topMargin - bottomMargin) / levelCount);

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
    }, [words, stageSize]);

    // 계층 뷰 레이아웃
    const layerViewLayouts = useMemo(() => {
        if (displayedWords.length === 0) return [];
        
        const minBlockSize = 40;
        const maxBlockSize = Math.min(60, Math.floor(stageSize.width / 25));
        const blockSize = Math.max(minBlockSize, maxBlockSize);
        const blockMargin = Math.max(4, Math.floor(blockSize * 0.1));
        const horizontalPadding = 24;
        const topPadding = 120;

        const blocksPerRow = Math.floor(
            (stageSize.width - (horizontalPadding * 2)) / (blockSize + blockMargin)
        );

        return displayedWords.map((word, index) => {
            const row = Math.floor(index / blocksPerRow);
            const col = index % blocksPerRow;

            const totalWidth = (blocksPerRow * (blockSize + blockMargin)) - blockMargin;
            const startX = (stageSize.width - totalWidth) / 2;

            return {
                word,
                x: startX + (col * (blockSize + blockMargin)),
                y: topPadding + row * (blockSize + blockMargin),
                width: blockSize,
                height: blockSize
            };
        });
    }, [displayedWords, stageSize.width]);


    // 계층 뷰의 Stage 높이를 동적으로 조절
    useEffect(() => {
        if (viewMode === 'layer' && stageRef.current && layerViewLayouts.length > 0) {
            const lastLayout = layerViewLayouts[layerViewLayouts.length - 1];
            if (lastLayout) {
                const totalHeight = lastLayout.y + lastLayout.height + 40; // 아래쪽 여백 추가
                stageRef.current.height(Math.max(stageSize.height, totalHeight));
            }
        }
    }, [layerViewLayouts, stageSize.height, viewMode]);


    // 블록 클릭 핸들러
    const handleBlockClick = useCallback((layout) => {
        if (viewMode === 'all') {
            setSelectedLayer(layout.layer);
            setViewMode('layer');
        } else {
            setHoveredWord({
                word: layout.word,
                x: layout.x + layout.width / 2,
                y: layout.y + layout.height / 2
            });
        }
    }, [viewMode]);

    // 계층 클릭 핸들러
    const handleLayerClick = useCallback((layer) => {
        setSelectedLayer(layer);
        setViewMode('layer');
    }, []);

    // 로그아웃 핸들러
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div ref={containerRef} style={{ 
            width: '100%',
            height: '100vh',
            background: '#1a1a1a',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* 상단 바 */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '8px 24px',
                boxSizing: 'border-box',
                zIndex: 1200,
                background: '#1a1a1a',
                borderBottom: '1px solid #333',
                height: 56
            }}>
                {viewMode === 'layer' && (
                    <button 
                        onClick={() => { setViewMode('all'); setSelectedLayer(null); }}
                        style={{
                            ...buttonStyle,
                            marginLeft: 0,
                            color: '#4FC3F7',
                            background: 'none',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}
                    >
                        {'< Back to Pyramid'}
                    </button>
                )}
                <span style={{ fontSize: '32px', fontWeight: 700, color: 'white', marginRight: 'auto' }}>
                    Vocabulario Inteligente
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{
                        ...buttonStyle,
                        background: '#2c2c2e',
                        color: '#4FC3F7'
                    }} onClick={() => navigate('/learn')}>학습 메뉴로 이동</button>
                    <button style={{
                        ...buttonStyle,
                        background: 'transparent',
                        border: '1px solid #444'
                    }} onClick={handleSignOut}>Sign Out</button>
                </div>
            </div>

            {/* 정렬 버튼 */}
            {viewMode === 'layer' && (
                <div style={{
                    position: 'fixed',
                    top: 56,
                    left: 0,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '12px 0',
                    zIndex: 1200,
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333'
                }}>
                    <button
                        onClick={() => setSortMode('pos')}
                        style={{
                            ...buttonStyle,
                            background: sortMode === 'pos' ? '#4FC3F7' : '#2c2c2e',
                            color: sortMode === 'pos' ? '#1a1a1a' : 'white'
                        }}
                    >
                        품사별 그룹
                    </button>
                    <button
                        onClick={() => setSortMode('freq')}
                        style={{
                            ...buttonStyle,
                            background: sortMode === 'freq' ? '#4FC3F7' : '#2c2c2e',
                            color: sortMode === 'freq' ? '#1a1a1a' : 'white'
                        }}
                    >
                        빈도수 정렬
                    </button>
                </div>
            )}

            {/* 스크롤 가능한 컨테이너 */}
            <div style={{
                position: 'fixed',
                top: viewMode === 'layer' ? 112 : 56,
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: 'auto',
                overflowX: 'hidden'
            }}>
                {/* 실제 콘텐츠 컨테이너 */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '100%',
                    paddingBottom: viewMode === 'all' ? 280 : 40 // 통계창을 위한 여백
                }}>
                    <Stage 
                        ref={stageRef}
                        width={stageSize.width}
                        height={stageSize.height}
                        style={{ 
                            display: 'block',
                            position: 'relative'
                        }}
                    >
                        <Layer>
                            {viewMode === 'all' ? (
                                <>
                                    {allViewLayouts.map((layout) => (
                                        <Group 
                                            key={`layer-${layout.level}`}
                                            onClick={() => handleLayerClick(layout.level)}
                                        >
                                            <Rect
                                                x={layout.x}
                                                y={layout.y}
                                                width={layout.width}
                                                height={layout.height}
                                                fill="#2c2c2e"
                                                cornerRadius={4}
                                                shadowColor="black"
                                                shadowBlur={4}
                                                shadowOpacity={0.2}
                                            />
                                            <Text
                                                x={layout.x}
                                                y={layout.y}
                                                width={layout.width}
                                                height={layout.height}
                                                text={`Level ${layout.level} (${layout.startIdx + 1} - ${layout.endIdx})`}
                                                fill="white"
                                                fontSize={14}
                                                align="center"
                                                verticalAlign="middle"
                                            />
                                            {/* 진행률 표시 */}
                                            <Rect
                                                x={layout.x}
                                                y={layout.y}
                                                width={layout.width * (layout.stats.completed / layout.stats.total)}
                                                height={layout.height}
                                                fill="#4FC3F7"
                                                cornerRadius={4}
                                                opacity={0.3}
                                            />
                                        </Group>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {layerViewLayouts.map((layout) => {
                                        const { word } = layout;
                                        const color = POS_COLORS[word.pos] || POS_COLORS.default;

                                        return (
                                            <Group 
                                                key={word.id}
                                                onClick={() => handleBlockClick(layout)}
                                            >
                                                <Rect
                                                    x={layout.x}
                                                    y={layout.y}
                                                    width={layout.width}
                                                    height={layout.height}
                                                    fill={color}
                                                    cornerRadius={4}
                                                    shadowColor="black"
                                                    shadowBlur={4}
                                                    shadowOpacity={0.2}
                                                />
                                                {/* 빈도수 순위 */}
                                                <Text
                                                    x={layout.x + 4}
                                                    y={layout.y + 4}
                                                    text={`#${word.frequency_rank}`}
                                                    fill="#222"
                                                    fontSize={10}
                                                    fontStyle="bold"
                                                />
                                                {/* 스페인어 단어 */}
                                                <Text
                                                    x={layout.x}
                                                    y={layout.y + layout.height / 3}
                                                    width={layout.width}
                                                    height={layout.height / 2}
                                                    text={word.spanish}
                                                    fill="#111"
                                                    fontSize={12}
                                                    align="center"
                                                    verticalAlign="middle"
                                                />
                                            </Group>
                                        );
                                    })}
                                </>
                            )}
                        </Layer>
                    </Stage>

                    {/* 전체 통계 */}
                    {viewMode === 'all' && (
                        <div style={{
                            position: 'fixed',
                            bottom: 20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#2c2c2e',
                            padding: '20px 24px',
                            borderRadius: '12px',
                            color: 'white',
                            minWidth: '300px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                            zIndex: 1000
                        }}>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px', fontWeight: 'bold' }}>전체 진도율</div>
                                <div style={{ 
                                    height: '8px', 
                                    background: '#444', 
                                    borderRadius: '4px', 
                                    overflow: 'hidden',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ 
                                        width: `${totalStats.percent}%`,
                                        height: '100%',
                                        background: '#4FC3F7',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '4px'
                                    }} />
                                </div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4FC3F7' }}>
                                    {totalStats.percent}% 
                                    <span style={{ fontSize: '16px', color: '#aaa', marginLeft: '8px' }}>
                                        ({totalStats.completed}/{totalStats.total})
                                    </span>
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                gap: '24px', 
                                fontSize: '14px',
                                color: '#aaa',
                                borderTop: '1px solid #444',
                                paddingTop: '16px'
                            }}>
                                <span>미학습: {totalStats.notStarted}</span>
                                <span>복습필요: {totalStats.reviewNeeded}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 툴팁 */}
            {hoveredWord && (
                <div style={{
                    position: 'fixed',
                    left: hoveredWord.x,
                    top: hoveredWord.y,
                    transform: 'translate(-50%, -50%)',
                    background: '#2c2c2e',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #444'
                }}>
                    <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#aaa' }}>{hoveredWord.word.pos}</span>
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {hoveredWord.word.spanish}
                    </div>
                    <div>{hoveredWord.word.korean}</div>
                </div>
            )}
        </div>
    );
};

export default Pyramid;