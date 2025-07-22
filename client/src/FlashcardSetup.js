import React, { useState, useMemo } from 'react';
import './FlashcardSetup.css';

const LEVEL_COUNT = 50;
const LEVEL_OPTIONS = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
const FILTER_OPTIONS = [
    { value: 'recommended', label: '추천 학습' },
    { value: 'review_needed', label: '복습 필요' },
    { value: 'irregular_verbs', label: '불규칙 동사' },
    { value: 'custom', label: '직접 선택' },
];
const COUNT_OPTIONS = [10, 20, 50, 'all'];

const FlashcardSetup = ({ onStartSession }) => {
    const [filter, setFilter] = useState('recommended');
    const [selectedLevels, setSelectedLevels] = useState([1]);
    const [count, setCount] = useState(20);

    const handleLevelToggle = (level) => {
        setSelectedLevels(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        );
    };

    const summary = useMemo(() => {
        const countText = count === 'all' ? '모든' : `${count}개`;
        if (filter === 'recommended') return `AI가 추천하는 단어 ${countText}를 학습합니다.`;
        if (filter === 'review_needed') return `복습이 필요한 단어 ${countText}를 학습합니다.`;
        if (filter === 'irregular_verbs') return `불규칙 동사 ${countText}를 집중 학습합니다.`;
        if (filter === 'custom') {
            if (selectedLevels.length === 0) return '학습할 레벨을 선택해주세요.';
            // Summarize selected levels
            const ranges = [];
            let start = selectedLevels[0];
            let end = selectedLevels[0];
            for (let i = 1; i < selectedLevels.length; i++) {
                if (selectedLevels[i] === end + 1) {
                    end = selectedLevels[i];
                } else {
                    ranges.push(start === end ? `${start}` : `${start}-${end}`);
                    start = end = selectedLevels[i];
                }
            }
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            return `레벨 ${ranges.join(', ')}의 단어 ${countText}를 학습합니다.`;
        }
        return '';
    }, [filter, selectedLevels, count]);

    const isStartDisabled = filter === 'custom' && selectedLevels.length === 0;

    return (
        <div className="flashcard-setup-container">
            <div className="setup-content">
                <div className="setup-header">
                    <h1>학습 시작하기</h1>
                    <p>오늘의 학습 목표를 설정해 보세요.</p>
                </div>

                <div className="setup-section">
                    <h2>어떤 단어를 학습할까요?</h2>
                    <div className="segmented-control">
                        {FILTER_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                className={filter === opt.value ? 'active' : ''}
                                onClick={() => setFilter(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {filter === 'custom' && (
                    <div className="setup-section level-section">
                        <h2>학습 범위를 알려주세요.</h2>
                        <div className="level-grid">
                            {LEVEL_OPTIONS.map(lv => (
                                <button
                                    key={lv}
                                    className={`level-btn ${selectedLevels.includes(lv) ? 'active' : ''}`}
                                    onClick={() => handleLevelToggle(lv)}
                                >
                                    {lv}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="setup-section">
                    <h2>몇 개나 도전해 볼까요?</h2>
                    <div className="count-selector">
                        {COUNT_OPTIONS.map(opt => (
                            <button
                                key={opt}
                                className={count === opt ? 'active' : ''}
                                onClick={() => setCount(opt)}
                            >
                                {opt === 'all' ? '전체' : `${opt}개`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="start-session-footer">
                    <p className="summary-text">{summary}</p>
                    <button
                        className="start-learning-btn"
                        onClick={() => onStartSession({ filter, selectedLevels, count })}
                        disabled={isStartDisabled}
                    >
                        학습 시작!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FlashcardSetup;