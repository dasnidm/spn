import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import { getRecallProbability, getMemoryColor, toFSRSCard } from './utils/fsrsUtils';
import { usePyramidData } from './hooks/usePyramidData';
import WordDetailModal from './components/WordDetailModal';

// --- 스타일 상수 ---
const buttonStyle = {
    background: '#2c2c2e', color: 'white', border: 'none', padding: '8px 20px',
    borderRadius: '8px', cursor: 'pointer', marginLeft: 8, minWidth: 110,
    fontSize: 15, whiteSpace: 'nowrap'
};
const POS_COLORS = {
    noun: '#0A84FF', verb: '#30D158', adjective: '#FF9F0A', adverb: '#BF5AF2', 
    pronoun: '#FF453A', preposition: '#64D2FF', conjunction: '#FFD60A', 
    article: '#8E8E93', numeral: '#E52B50', default: '#48484A'
};
const CHECKED_ICON_COLOR = '#FF453A'; // 체크 아이콘을 위한 빨간색

// --- Pyramid Component ---
const Pyramid = ({ words, setWords }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('all');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const [sortMode, setSortMode] = useState('pos');
    const [selectedWord, setSelectedWord] = useState(null);
    const stageRef = useRef(null);
    const [stageSize, setStageSize] = useState({ 
        width: window.innerWidth, 
        height: window.innerHeight - (viewMode === 'layer' ? 112 : 56)
    });
    const isMobile = stageSize.width <= 768;

    const { displayedWords, totalStats, allViewLayouts, allViewTotalHeight, groupedByPos } = usePyramidData(words, viewMode, selectedLayer, sortMode, stageSize, isMobile);

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
        navigate('/auth');
    };

    const renderWordBlock = (word) => {
        const isChecked = word.is_checked || false;
        const recall = isChecked ? 1 : getRecallProbability(toFSRSCard(word, word));
        const color = getMemoryColor(recall);
        const percent = Math.round(recall * 100);

        return (
            <div key={word.id} style={{ background: color, color: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', padding: isMobile ? '12px 14px' : '14px 18px', fontSize: isMobile ? 15 : 17, fontWeight: 600, minWidth: 70, marginBottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', transition: 'box-shadow 0.2s', position: 'relative' }} onClick={() => setSelectedWord(word)}>
                {isChecked && <span style={{ position: 'absolute', top: 5, left: 8, fontSize: 18, color: CHECKED_ICON_COLOR, fontWeight: 'bold' }}>✓</span>}
                <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{word.pos}</span>
                <span style={{ fontSize: isMobile ? 16 : 18 }}>{word.spanish}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{`#${word.frequency_rank}`}</span>
                <span style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{percent}%</span>
            </div>
        );
    };

    return (
        <div style={{ width: '100%', height: '100%', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', padding: `8px ${isMobile ? '16px' : '24px'}`, boxSizing: 'border-box', zIndex: 1200, background: '#1a1a1a', borderBottom: '1px solid #333', height: isMobile ? 'auto' : 56, minHeight: 56 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: isMobile ? '8px' : 0 }}>
                    {viewMode === 'layer' && <button onClick={() => { setViewMode('all'); setSelectedLayer(null); }} style={{ ...buttonStyle, marginLeft: 0, color: '#4FC3F7', background: 'none', fontWeight: 'bold', fontSize: isMobile ? '16px' : '18px', padding: isMobile ? '8px 12px' : buttonStyle.padding }}>{'< Back'}</button>}
                    <span style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 700, color: 'white', marginRight: 'auto', marginLeft: viewMode === 'layer' ? (isMobile ? '12px' : 0) : 0 }}>Vocabulario Inteligente</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
                    <button style={{ ...buttonStyle, background: '#2c2c2e', color: '#4FC3F7', flex: isMobile ? 1 : 'auto' }} onClick={() => navigate('/learn')}>학습 메뉴</button>
                    <button style={{ ...buttonStyle, background: 'transparent', border: '1px solid #444', flex: isMobile ? 1 : 'auto' }} onClick={handleSignOut}>Sign Out</button>
                </div>
            </div>

            {viewMode === 'layer' && <div style={{ position: 'fixed', top: 56, left: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '16px', padding: '12px 0', zIndex: 1200, background: '#1a1a1a', borderBottom: '1px solid #333' }}><button onClick={() => setSortMode('pos')} style={{ ...buttonStyle, background: sortMode === 'pos' ? '#4FC3F7' : '#2c2c2e', color: sortMode === 'pos' ? '#1a1a1a' : 'white' }}>품사별 그룹</button><button onClick={() => setSortMode('freq')} style={{ ...buttonStyle, background: sortMode === 'freq' ? '#4FC3F7' : '#2c2c2e', color: sortMode === 'freq' ? '#1a1a1a' : 'white' }}>빈도수 정렬</button></div>}

            <div style={{ position: 'fixed', top: viewMode === 'layer' ? 112 : (isMobile ? 100 : 56), left: 0, right: 0, bottom: 60, overflowY: 'auto', overflowX: 'hidden' }}>
                <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
                    <Stage ref={stageRef} width={stageSize.width} height={allViewTotalHeight} style={{ display: viewMode === 'all' ? 'block' : 'none' }}>
                        <Layer>
                            {allViewLayouts.map((layout) => {
                                const layerWords = words.slice(layout.startIdx, layout.endIdx);
                                let avgRecall = 0;
                                if (layerWords.length > 0) {
                                    avgRecall = layerWords.reduce((sum, w) => {
                                        const recall = w.is_checked ? 1 : getRecallProbability(toFSRSCard(w, w));
                                        return sum + recall;
                                    }, 0) / layerWords.length;
                                }
                                const layerColor = getMemoryColor(avgRecall);
                                return (
                                    <Group key={`layer-${layout.level}`} onClick={() => { handleLayerClick(layout.level); }} onTap={() => { handleLayerClick(layout.level); }}>
                                        <Rect x={layout.x} y={layout.y} width={layout.width} height={layout.height} fill={layerColor} cornerRadius={4} shadowColor="black" shadowBlur={4} shadowOpacity={0.2} />
                                        <Text x={layout.x} y={layout.y} width={layout.width} height={layout.height} text={`Level ${layout.level} (${layout.startIdx + 1} - ${layout.endIdx})`} fill="white" fontSize={14} align="center" verticalAlign="middle" />
                                    </Group>
                                );
                            })}
                        </Layer>
                    </Stage>

                    {viewMode === 'layer' && (
                        <div style={{ padding: isMobile ? '12px 8px' : '24px 32px' }}>
                            {sortMode === 'pos' ? (
                                Object.entries(groupedByPos).map(([pos, groupWords]) => (
                                    <React.Fragment key={pos}>
                                        <div style={{ margin: '24px 0 8px 0', fontWeight: 700, fontSize: isMobile ? 16 : 18, color: POS_COLORS[pos] || POS_COLORS.default, letterSpacing: 1, textTransform: 'uppercase' }}>{pos}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12, marginBottom: 8 }}>
                                            {groupWords.map(renderWordBlock)}
                                        </div>
                                    </React.Fragment>
                                ))
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12, marginBottom: 8 }}>
                                    {displayedWords.map(renderWordBlock)}
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'all' && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#2c2c2e', padding: '20px 24px', borderRadius: '12px', color: 'white', minWidth: '300px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)', zIndex: 1000 }}>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px', fontWeight: 'bold' }}>전체 진도율</div>
                            <div style={{ height: '8px', background: '#444', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                                <div style={{ width: `${totalStats.percent}%`, height: '100%', background: '#4FC3F7', transition: 'width 0.3s ease', borderRadius: '4px' }} />
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4FC3F7' }}>{totalStats.percent}% <span style={{ fontSize: '16px', color: '#aaa', marginLeft: '8px' }}>({totalStats.learnedCount}/{totalStats.total})</span></div>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#aaa', borderTop: '1px solid #444', paddingTop: '16px' }}>
                            <span>미학습: {totalStats.notStarted}</span>
                            <span>복습필요: {totalStats.reviewNeeded}</span>
                        </div>
                    </div>}
                </div>
            </div>

            {selectedWord && <WordDetailModal word={selectedWord} setWords={setWords} onClose={() => setSelectedWord(null)} />}
        </div>
    );
};

export default Pyramid;