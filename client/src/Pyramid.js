import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import { getRecallProbability, getMemoryColor, toFSRSCard } from './utils/fsrsUtils';
import { usePyramidData } from './hooks/usePyramidData'; // 커스텀 훅 임포트

// 스타일과 상수들은 그대로 유지
const STATUS_COLORS = {
    completed: '#66BB6A',
    review_needed: '#FFA726',
    not_started: '#444'
};
const POS_COLORS = {
    noun: '#0A84FF', verb: '#30D158', adjective: '#FF9F0A', adverb: '#BF5AF2', 
    pronoun: '#FF453A', preposition: '#64D2FF', conjunction: '#FFD60A', 
    article: '#8E8E93', numeral: '#E52B50', default: '#48484A'
};
const buttonStyle = {
    background: '#2c2c2e', color: 'white', border: 'none', padding: '8px 20px',
    borderRadius: '8px', cursor: 'pointer', marginLeft: 8, minWidth: 110,
    fontSize: 15, whiteSpace: 'nowrap'
};

const Pyramid = ({ words, setWords }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('all');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const [hoveredWord, setHoveredWord] = useState(null); // 툴팁용
    const [sortMode, setSortMode] = useState('pos');
    const [selectedWord, setSelectedWord] = useState(null); // 모달용
    const [user, setUser] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false); // AI 예문 생성 중 상태
    const [generatedExample, setGeneratedExample] = useState(null); // 생성된 AI 예문
    const [generationError, setGenerationError] = useState(null); // AI 예문 생성 오류
    const stageRef = useRef(null);
    const [stageSize, setStageSize] = useState({ 
        width: window.innerWidth, 
        height: window.innerHeight - (viewMode === 'layer' ? 112 : 56)
    });
    const isMobile = stageSize.width <= 768;

    // 데이터 계산 및 상태 관리를 커스텀 훅에 위임
    const {
        displayedWords,
        totalStats,
        allViewLayouts,
        allViewTotalHeight,
        groupedByPos
    } = usePyramidData(words, viewMode, selectedLayer, sortMode, stageSize, isMobile);

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
        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

    const handleLayerClick = useCallback((layer) => {
        setSelectedLayer(layer);
        setViewMode('layer');
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div style={{ 
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
                <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
                    <Stage 
                        ref={stageRef}
                        width={stageSize.width}
                        height={allViewTotalHeight}
                        style={{ display: viewMode === 'all' ? 'block' : 'none' }}
                    >
                        <Layer>
                            {allViewLayouts.map((layout) => {
                                const layerWords = words.slice(layout.startIdx, layout.endIdx);
                                let avgRecall = 0;
                                if (layerWords.length > 0) {
                                    avgRecall = layerWords.reduce((sum, w) => {
                                        const card = toFSRSCard(w, w);
                                        return sum + getRecallProbability(card);
                                    }, 0) / layerWords.length;
                                }
                                const layerColor = getMemoryColor(avgRecall);
                                return (
                                    <Group key={`layer-${layout.level}`} onClick={() => handleLayerClick(layout.level)}>
                                        <Rect
                                            x={layout.x} y={layout.y} width={layout.width} height={layout.height}
                                            fill={layerColor} cornerRadius={4}
                                            shadowColor="black" shadowBlur={4} shadowOpacity={0.2}
                                        />
                                        <Text
                                            x={layout.x} y={layout.y} width={layout.width} height={layout.height}
                                            text={`Level ${layout.level} (${layout.startIdx + 1} - ${layout.endIdx})`}
                                            fill="white" fontSize={14} align="center" verticalAlign="middle"
                                        />
                                    </Group>
                                );
                            })}
                        </Layer>
                    </Stage>

                    {viewMode === 'layer' && (
                        <div style={{ padding: isMobile ? '12px 8px' : '24px 32px' }}>
                            {sortMode === 'pos' ? (
                                Object.entries(groupedByPos).map(([pos, groupWords]) => {
                                    const color = POS_COLORS[pos] || POS_COLORS.default;
                                    return (
                                        <React.Fragment key={pos}>
                                            <div style={{
                                                margin: '24px 0 8px 0', fontWeight: 700, fontSize: isMobile ? 16 : 18,
                                                color: color, letterSpacing: 1, textTransform: 'uppercase',
                                            }}>{pos}</div>
                                            <div style={{
                                                display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12, marginBottom: 8
                                            }}>
                                                {groupWords.map(word => {
                                                    const card = toFSRSCard(word, word);
                                                    const recall = getRecallProbability(card);
                                                    const color = getMemoryColor(recall);
                                                    const percent = Math.round(recall * 100);
                                                    return (
                                                        <div key={word.id} style={{
                                                            background: color, color: '#fff', borderRadius: 10,
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                                            padding: isMobile ? '12px 14px' : '14px 18px',
                                                            fontSize: isMobile ? 15 : 17, fontWeight: 600, minWidth: 70,
                                                            marginBottom: 4, display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', userSelect: 'none', transition: 'box-shadow 0.2s',
                                                        }}
                                                        onClick={() => setSelectedWord(word)}>
                                                            <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{word.pos}</span>
                                                            <span style={{ fontSize: isMobile ? 16 : 18 }}>{word.spanish}</span>
                                                            <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{`#${word.frequency_rank}`}</span>
                                                            <span style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{percent}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12, marginBottom: 8 }}>
                                    {displayedWords.map(word => {
                                        const card = toFSRSCard(word, word);
                                        const recall = getRecallProbability(card);
                                        const color = getMemoryColor(recall);
                                        const percent = Math.round(recall * 100);
                                        return (
                                            <div key={word.id} style={{
                                                background: color, color: '#fff', borderRadius: 10,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                                padding: isMobile ? '12px 14px' : '14px 18px',
                                                fontSize: isMobile ? 15 : 17, fontWeight: 600, minWidth: 70,
                                                marginBottom: 4, display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', userSelect: 'none', transition: 'box-shadow 0.2s',
                                            }}
                                            onClick={() => setSelectedWord(word)}>
                                                <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{word.pos}</span>
                                                <span style={{ fontSize: isMobile ? 16 : 18 }}>{word.spanish}</span>
                                                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{`#${word.frequency_rank}`}</span>
                                                <span style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{percent}%</span>
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

            {/* 모달 렌더링 */}
            {selectedWord && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.45)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setSelectedWord(null)}
              >
                <div
                  style={{
                    background: '#222',
                    borderRadius: 16,
                    padding: '32px 24px',
                    minWidth: 260,
                    maxWidth: 360,
                    color: 'white',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    position: 'relative',
                    textAlign: 'center',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 18,
                      right: 22,
                      fontSize: 26,
                      color: selectedWord.status === 'completed' ? '#30D158' : '#888',
                      cursor: 'pointer',
                      zIndex: 2
                    }}
                    title={selectedWord.status === 'completed' ? '완료됨' : '완료로 표시'}
                    onClick={async () => {
                      if (selectedWord.status !== 'completed') {
                        if (setWords) {
                          setWords(words => words.map(w => w.id === selectedWord.id ? { ...w, status: 'completed' } : w));
                        }
                        setSelectedWord({ ...selectedWord, status: 'completed' });
                      }
                    }}
                  >✔️</span>
                  <h2 style={{ margin: '0 0 12px 0', fontSize: 28 }}>{selectedWord.spanish}</h2>
                  <div style={{ fontSize: 15, color: '#4FC3F7', marginBottom: 8 }}>{selectedWord.pos}</div>
                  <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{selectedWord.korean}</div>
                  {selectedWord.english_meaning && (
                    <div style={{ fontSize: 16, color: '#FFD60A', marginBottom: 8 }}>
                      영어 뜻: {selectedWord.english_meaning}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>빈도수: #{selectedWord.frequency_rank}</div>
                  {selectedWord.category_code && (
                    <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>분류코드: {selectedWord.category_code}</div>
                  )}
                  {selectedWord && (
                    (() => {
                      const card = toFSRSCard(selectedWord, selectedWord);
                      const recall = getRecallProbability(card);
                      const color = getMemoryColor(recall);
                      const percent = Math.round(recall * 100);
                      return (
                        <div style={{
                          margin: '12px 0 8px 0',
                          fontSize: 15,
                          fontWeight: 700,
                          color: color,
                          background: color + '22',
                          borderRadius: 8,
                          padding: '6px 0',
                          display: 'inline-block',
                          minWidth: 100
                        }}>
                          암기 정도: {percent}%
                        </div>
                      );
                    })()
                  )}
                  {selectedWord.status && (
                    <div style={{ fontSize: 13, color: '#FFA726', marginBottom: 8 }}>학습상태: {selectedWord.status}</div>
                  )}
                  {/* AI 예문 섹션 */}
                  <div style={{
                    margin: '16px 0 8px 0',
                    padding: '12px 10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 8
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#64D2FF' }}>AI 동적 예문</div>
                    {generationError && <div style={{ color: '#FF453A' }}>{generationError}</div>}
                    {isGenerating && <div style={{ color: '#aaa' }}>예문을 생성하고 있습니다...</div>}
                    {generatedExample ? (
                        <div>
                            <p style={{ fontSize: 16, color: '#fff', margin: '0 0 4px 0' }}>{generatedExample.spanish_example}</p>
                            <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>{generatedExample.korean_translation}</p>
                        </div>
                    ) : (
                        !isGenerating && (
                            <button 
                                style={{ ...buttonStyle, background: '#64D2FF', color: '#1a1a1a', marginLeft: 0, fontSize: 14, padding: '8px 16px' }}
                                onClick={async () => {
                                    setIsGenerating(true);
                                    setGenerationError(null);
                                    try {
                                        // 1. "아는 단어" 목록 준비 (FSRS 기준)
                                        const knownWords = words
                                            .filter(w => w.status === 'completed' || (w.stability && w.stability > 21))
                                            .map(w => w.spanish)
                                            .slice(0, 50); // API 성능을 위해 최대 50개로 제한

                                        // 2. Edge Function 호출
                                        const { data, error } = await supabase.functions.invoke('process-example-queue', {
                                            body: {
                                                targetWord: selectedWord.spanish,
                                                pos: selectedWord.pos,
                                                knownWords: knownWords,
                                            },
                                        });

                                        if (error) throw error;

                                        setGeneratedExample(data);
                                        // TODO: 생성된 예문을 generated_examples 테이블에 저장하는 로직 추가 (Phase 3)

                                    } catch (err) {
                                        console.error('예문 생성 오류:', err);
                                        setGenerationError('예문 생성에 실패했습니다. 다시 시도해 주세요.');
                                    } finally {
                                        setIsGenerating(false);
                                    }
                                }}
                            >
                                AI 예문 보기
                            </button>
                        )
                    )}
                  </div>

                  <button
                    style={{
                      marginTop: 16,
                      padding: '8px 20px',
                      background: '#4FC3F7',
                      color: '#222',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedWord(null)}
                  >닫기</button>
                </div>
              </div>
            )}
        </div>
    );
};

export default Pyramid;
