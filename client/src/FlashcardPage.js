import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient'; // supabase 클라이언트 임포트
import './FlashcardPage.css';

const FlashcardPage = () => {
    const { words, setWords } = useOutletContext();
    const navigate = useNavigate();
    const [sessionWords, setSessionWords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [user, setUser] = useState(null);

    // 사용자 정보 가져오기
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    // 학습 세션에 사용할 단어 10개 선택 (미학습 단어 우선)
    useEffect(() => {
        if (words && words.length > 0) {
            const notStartedWords = words
                .filter(w => !w.status || w.status === 'not_started')
                .sort((a, b) => a.frequency_rank - b.frequency_rank);
            
            setSessionWords(notStartedWords.slice(0, 10));
        }
    }, [words]);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleNext = async (level) => {
        if (!user) return;

        const currentWord = sessionWords[currentIndex];
        const newStatus = level === 'good' ? 'completed' : 'review_needed';

        // 1. Supabase에 학습 결과 업데이트 또는 삽입
        const { error } = await supabase
            .from('user_word_progress')
            .upsert({
                user_id: user.id,
                word_id: currentWord.id,
                status: newStatus,
                last_reviewed_at: new Date().toISOString(),
                // TODO: 여기에 SRS 알고리즘에 따른 next_review_at, ease_factor 등 추가
            }, {
                onConflict: 'user_id, word_id'
            });

        if (error) {
            console.error('Error updating word progress:', error);
        } else {
            // 2. MainLayout의 전체 words 상태 실시간 업데이트
            const updatedWords = words.map(w =>
                w.id === currentWord.id ? { ...w, status: newStatus } : w
            );
            setWords(updatedWords);
        }

        // 3. 다음 카드로 이동 또는 세션 종료
        if (currentIndex < sessionWords.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(currentIndex + 1);
        } else {
            alert('학습 세션 완료!');
            navigate('/learn');
        }
    };
    
    if (sessionWords.length === 0) {
        return <div className="loading-flashcard">학습할 단어를 불러오는 중...</div>;
    }

    const currentWord = sessionWords[currentIndex];
    const progressPercent = ((currentIndex + 1) / sessionWords.length) * 100;

    return (
        <div className="flashcard-container">
            <div className="flashcard-header">
                <button className="exit-btn" onClick={() => navigate('/learn')}>✕</button>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </div>

            <div className={`flashcard-scene ${isFlipped ? 'is-flipped' : ''}`} onClick={handleFlip}>
                <div className="flashcard">
                    <div className="card-face card-front">
                        <span className="part-of-speech">{currentWord.pos}</span>
                        <p>{currentWord.spanish}</p>
                    </div>
                    <div className="card-face card-back">
                        <p>{currentWord.korean}</p>
                    </div>
                </div>
            </div>

            {isFlipped && (
                <div className="difficulty-buttons">
                    <button onClick={() => handleNext('again')}>어려워요</button>
                    <button onClick={() => handleNext('hard')}>애매해요</button>
                    <button onClick={() => handleNext('good')}>완벽해요</button>
                </div>
            )}
        </div>
    );
};

export default FlashcardPage; 