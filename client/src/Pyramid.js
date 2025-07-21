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

// 품사별 색상 (Apple 스타일 UI Kit 기반)
const POS_COLORS = {
    noun: '#0A84FF',        // Blue
    verb: '#30D158',        // Green
    adjective: '#FF9F0A',   // Orange
    adverb: '#BF5AF2',      // Purple
    pronoun: '#FF453A',     // Red
    preposition: '#64D2FF', // Teal
    conjunction: '#FFD60A', // Yellow
    article: '#8E8E93',     // Gray
    numeral: '#E52B50',     // Amaranth Pink
    default: '#48484A'      // Dark Gray
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

// 품사별 그룹핑 함수
function groupWordsByPos(words) {
    const groups = {};
    words.forEach(word => {
        const pos = word.pos || '기타';
        if (!groups[pos]) groups[pos] = [];
        groups[pos].push(word);
    });
    return groups;
}

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
    const isMobile = stageSize.width <= 768;

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
        const layerHeight = isMobile ? 44 : 40; // 모바일 터치 영역 확보
        const maxLayerWidth = Math.max(300, stageSize.width * (isMobile ? 0.9 : 0.8)); // 모바일에서 너비 비율 조정
        const verticalSpacing = 12;
        const topMargin = isMobile ? 120 : 80; // 모바일에서 상단 여백 추가
        
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
        return lastLayout.y + lastLayout.height + (isMobile ? 200 : 280); // 모바일에서 하단 여백 조정
    }, [allViewLayouts, stageSize.height, isMobile]);

    // 계층 뷰 레이아웃
    const layerViewLayouts = useMemo(() => {
        if (displayedWords.length === 0) return [];
        
        const minBlockSize = isMobile ? 48 : 52; // 모바일 터치 영역 확보
        const maxBlockSize = Math.min(80, Math.floor(stageSize.width / (isMobile ? 8 : 25)));
        const blockSize = Math.max(minBlockSize, maxBlockSize);
        const blockMargin = Math.max(5, Math.floor(blockSize * 0.1));
        const horizontalPadding = isMobile ? 16 : 24;
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
    }, [displayedWords, stageSize.width, isMobile]);


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
            setSelectedLayer(layout.level);
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
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                padding: `8px ${isMobile ? '16px' : '24px'}`,
                boxSizing: 'border-box',
                zIndex: 1200,
                background: '#1a1a1a',
                borderBottom: '1px solid #333',
                height: isMobile ? 'auto' : 56,
                minHeight: 56
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    marginBottom: isMobile ? '8px' : 0,
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
                                fontSize: isMobile ? '16px' : '18px',
                                padding: isMobile ? '8px 12px' : buttonStyle.padding
                            }}
                        >
                            {'< Back'}
                        </button>
                    )}
                    <span style={{ 
                        fontSize: isMobile ? '24px' : '32px', 
                        fontWeight: 700, 
                        color: 'white', 
                        marginRight: 'auto',
                        marginLeft: viewMode === 'layer' ? (isMobile ? '12px' : 0) : 0,
                    }}>
                        Vocabulario Inteligente
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
                    <button style={{
                        ...buttonStyle,
                        background: '#2c2c2e',
                        color: '#4FC3F7',
                        flex: isMobile ? 1 : 'auto'
                    }} onClick={() => navigate('/learn')}>학습 메뉴</button>
                    <button style={{
                        ...buttonStyle,
                        background: 'transparent',
                        border: '1px solid #444',
                        flex: isMobile ? 1 : 'auto'
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
                top: viewMode === 'layer' ? 112 : (isMobile ? 100 : 56),
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingBottom: viewMode === 'all' ? (isMobile ? '160px' : '180px') : '0px'
            }}>
                {/* 실제 콘텐츠 컨테이너 */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '100%',
                }}>
                    <Stage 
                        ref={stageRef}
                        width={stageSize.width}
                        height={viewMode === 'all' ? allViewTotalHeight : stageSize.height}
                        style={{ 
                            display: viewMode === 'layer' && sortMode === 'pos' ? 'none' : 'block',
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
                                // 빈도수 정렬만 Konva로 렌더링
                                sortMode === 'freq' && (
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
                                                        cornerRadius={8}
                                                        shadowColor="black"
                                                        shadowBlur={10}
                                                        shadowOpacity={0.25}
                                                        shadowOffset={{ x: 0, y: 5 }}
                                                    />
                                                    {/* 품사 */}
                                                    <Text
                                                        x={layout.x + 8}
                                                        y={layout.y + 8}
                                                        text={word.pos}
                                                        fill="#fff"
                                                        fontSize={10}
                                                        opacity={0.6}
                                                    />
                                                    {/* 빈도수 순위 */}
                                                    <Text
                                                        x={layout.x + layout.width - 8}
                                                        y={layout.y + layout.height - 18}
                                                        text={`#${word.frequency_rank}`}
                                                        fill="#fff"
                                                        fontSize={10}
                                                        width={-layout.width + 16}
                                                        align="right"
                                                        opacity={0.6}
                                                    />
                                                    {/* 스페인어 단어 */}
                                                    <Text
                                                        x={layout.x}
                                                        y={layout.y}
                                                        width={layout.width}
                                                        height={layout.height}
                                                        text={word.spanish}
                                                        fill="#fff"
                                                        fontSize={isMobile ? 14 : 16}
                                                        fontStyle="600"
                                                        align="center"
                                                        verticalAlign="middle"
                                                    />
                                                </Group>
                                            );
                                        })}
                                    </>
                                )
                            )}
                        </Layer>
                    </Stage>

                    {/* 레벨 뷰 - 품사별 그룹/빈도수 정렬 모두 DOM 박스 UI로 */}
                    {viewMode === 'layer' && (
                        <div style={{ padding: isMobile ? '12px 8px' : '24px 32px' }}>
                            {sortMode === 'pos' ? (
                                Object.entries(groupWordsByPos(displayedWords)).map(([pos, groupWords], idx) => {
                                    const color = POS_COLORS[pos] || POS_COLORS.default;
                                    return (
                                        <React.Fragment key={pos}>
                                            {/* 품사 헤더 */}
                                            <div style={{
                                                margin: '24px 0 8px 0',
                                                fontWeight: 700,
                                                fontSize: isMobile ? 16 : 18,
                                                color: color,
                                                letterSpacing: 1,
                                                textTransform: 'uppercase',
                                            }}>{pos}</div>
                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: isMobile ? 8 : 12,
                                                marginBottom: 8
                                            }}>
                                                {groupWords.map(word => (
                                                    <div key={word.id} style={{
                                                        background: color,
                                                        color: '#fff',
                                                        borderRadius: 10,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                                        padding: isMobile ? '12px 14px' : '14px 18px',
                                                        fontSize: isMobile ? 15 : 17,
                                                        fontWeight: 600,
                                                        minWidth: 70,
                                                        marginBottom: 4,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        transition: 'box-shadow 0.2s',
                                                    }}
                                                    onClick={() => handleBlockClick({ word })}
                                                    >
                                                        <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{pos}</span>
                                                        <span style={{ fontSize: isMobile ? 16 : 18 }}>{word.spanish}</span>
                                                        <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{`#${word.frequency_rank}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                // 빈도수 정렬: 한 줄로 쭉 나열, 동일 박스 디자인
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: isMobile ? 8 : 12,
                                    marginBottom: 8
                                }}>
                                    {displayedWords.map(word => {
                                        const color = POS_COLORS[word.pos] || POS_COLORS.default;
                                        return (
                                            <div key={word.id} style={{
                                                background: color,
                                                color: '#fff',
                                                borderRadius: 10,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                                padding: isMobile ? '12px 14px' : '14px 18px',
                                                fontSize: isMobile ? 15 : 17,
                                                fontWeight: 600,
                                                minWidth: 70,
                                                marginBottom: 4,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'box-shadow 0.2s',
                                            }}
                                            onClick={() => handleBlockClick({ word })}
                                            >
                                                <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{word.pos}</span>
                                                <span style={{ fontSize: isMobile ? 16 : 18 }}>{word.spanish}</span>
                                                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{`#${word.frequency_rank}`}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

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