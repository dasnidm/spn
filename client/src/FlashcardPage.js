import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient'; // supabase 클라이언트 임포트
import './FlashcardPage.css';
import './FlashcardSetup.css'; // Setup CSS import
import FlashcardSetup from './FlashcardSetup'; // Setup Component import
import { updateFSRSProgress } from './utils/fsrsUtils';
import { updateProgress } from './utils/wordStorage';
import { getRecallProbability, getMemoryColor, toFSRSCard } from './utils/fsrsUtils';
import { filterWords } from './utils/wordFilter';

const FlashcardPage = () => {
    const { words, setWords } = useOutletContext();
    const navigate = useNavigate();
    const [sessionWords, setSessionWords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [user, setUser] = useState(null);
    const [swipeStartX, setSwipeStartX] = useState(null);
    const [swipeDeltaX, setSwipeDeltaX] = useState(0);
    const cardRef = useRef();
    const wasSwiped = useRef(false); // 스와이프 동작을 추적하기 위한 ref
    const [sessionFinished, setSessionFinished] = useState(false);
    
    // New state for session management
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionSettings, setSessionSettings] = useState(null);

    

    // 세션 단어 선정 useEffect
    useEffect(() => {
        if (sessionStarted && sessionSettings) {
            const filtered = filterWords(words, sessionSettings);
            setSessionWords(filtered);
            setCurrentIndex(0);
            setIsFlipped(false);
            setSessionFinished(false);
        }
    }, [sessionStarted, sessionSettings]);

    // 사용자 정보 가져오기
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    const handleStartSession = (settings) => {
        setSessionSettings(settings);
        setSessionStarted(true);
    };
    
    if (!sessionStarted) {
        return <FlashcardSetup onStartSession={handleStartSession} />;
    }
    
    const handleFlip = () => {
        // 스와이프 직후의 클릭 이벤트는 무시합니다.
        if (wasSwiped.current) {
            wasSwiped.current = false;
            return;
        }
        setIsFlipped(!isFlipped);
    };

    const handleNext = async (level) => {
        if (!user) return;

        const currentWord = sessionWords[currentIndex];
        // 기존 user_word_progress 정보 추출 (words에서)
        const userWordProgress = words.find(w => w.id === currentWord.id) || {};
        // FSRS 상태 갱신
        const fsrsResult = updateFSRSProgress(userWordProgress, currentWord, level);

        // wordStorage.js의 updateProgress가 Supabase/IndexedDB 업데이트를 모두 처리
        await updateProgress(currentWord.id, fsrsResult);

        // 3. MainLayout의 전체 words 상태 실시간 업데이트
        const updatedWords = words.map(w =>
            w.id === currentWord.id ? { ...w, ...fsrsResult } : w
        );
        setWords(updatedWords);

        // 4. 다음 카드로 이동 또는 세션 종료
        if (currentIndex < sessionWords.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(i => i + 1); // 함수형 업데이트로 변경
        } else {
            setSessionFinished(true);
        }
    };
    
    // 스와이프/마우스 이벤트 핸들러
    const handleTouchStart = (e) => {
        // 클릭과 스와이프를 구분하기 위해, 스와이프 플래그를 여기서 리셋합니다.
        wasSwiped.current = false;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        setSwipeStartX(x);
    };
    const handleTouchMove = (e) => {
        if (swipeStartX === null) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        setSwipeDeltaX(x - swipeStartX);
    };
    const handleTouchEnd = (e) => {
        const isSwipeRight = swipeDeltaX > 60 && currentIndex > 0;
        const isSwipeLeft = swipeDeltaX < -60 && currentIndex < sessionWords.length - 1;

        if (isSwipeRight || isSwipeLeft) {
            // 스와이프가 발생했음을 기록합니다.
            wasSwiped.current = true;
            
            // 다음 카드는 앞면부터 보이도록 상태를 설정합니다.
            setIsFlipped(false);

            // 이전 또는 다음 카드로 이동합니다.
            if (isSwipeRight) {
                setCurrentIndex(currentIndex - 1);
            } else {
                setCurrentIndex(currentIndex + 1);
            }
        }
        
        // 스와이프 추적 상태를 리셋합니다.
        setSwipeStartX(null);
        setSwipeDeltaX(0);
    };

    const handleLevelSelect = async (level) => {
        // 버튼 애니메이션 등은 selectedLevel이 아니라 selectedLevels와 무관하게 동작
        await handleNext(level);
    };

    if (sessionWords.length === 0) {
        return (
            <div className="flashcard-container">
                <div style={{ color: '#aaa', fontSize: 18, textAlign: 'center', marginTop: 60 }}>
                    해당 조건에 맞는 단어가 없습니다.<br/>필터를 변경하여 다시 시도해 주세요.
                </div>
                <button className="main-btn" style={{ padding: '12px 28px', fontSize: 17, borderRadius: 10, background: '#232326', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 20 }} onClick={() => setSessionStarted(false)}>
                    학습 설정으로 돌아가기
                </button>
            </div>
        );
    }

    // 세션 종료 화면
    if (sessionFinished) {
        // 통계 계산
        let completed = 0, reviewNeeded = 0, notStarted = 0, recallSum = 0;
        const reviewList = [];
        const notStartedList = [];
        sessionWords.forEach(word => {
            const prog = words.find(w => w.id === word.id) || {};
            if (prog.status === 'completed') completed++;
            else if (prog.status === 'review_needed') { reviewNeeded++; reviewList.push({ ...word, ...prog }); }
            else { notStarted++; notStartedList.push({ ...word, ...prog }); }
            const card = toFSRSCard(prog, word);
            recallSum += getRecallProbability(card);
        });
        const avgRecall = sessionWords.length ? Math.round((recallSum / sessionWords.length) * 100) : 0;
        return (
            <div className="flashcard-session-finish">
                <div className="finish-emoji" style={{ fontSize: 54, marginBottom: 12 }}>🎉</div>
                <div className="finish-title" style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, color: '#5d5dff' }}>학습 세션 완료!</div>
                <div className="finish-sub" style={{ fontSize: 17, color: '#aaa', marginBottom: 18 }}>수고했어요! 오늘도 한 걸음 성장했어요.</div>
                <div className="finish-stats" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <div style={{ fontSize: 16, color: '#fff' }}>학습한 단어: <b>{sessionWords.length}</b></div>
                    <div style={{ fontSize: 15, color: '#66bb6a' }}>완료: <b>{completed}</b></div>
                    <div style={{ fontSize: 15, color: '#FFA726' }}>복습 필요: <b>{reviewNeeded}</b></div>
                    <div style={{ fontSize: 15, color: '#888' }}>미학습: <b>{notStarted}</b></div>
                    <div style={{ fontSize: 15, color: '#4FC3F7' }}>평균 암기 정도: <b>{avgRecall}%</b></div>
                </div>
                <div className="finish-progress-bar" style={{ width: '90%', maxWidth: 320, height: 12, background: '#333', borderRadius: 8, overflow: 'hidden', margin: '0 auto 18px auto' }}>
                    <div style={{ width: `${avgRecall}%`, height: '100%', background: '#4FC3F7', borderRadius: 8, transition: 'width 0.3s' }} />
                </div>
                {/* 오답노트/복습 필요 단어 */}
                {(reviewList.length > 0 || notStartedList.length > 0) && (
                    <div className="review-list-section" style={{ margin: '18px 0 0 0', width: '100%', maxWidth: 400 }}>
                        <div style={{ fontWeight: 700, fontSize: 17, color: '#FFA726', marginBottom: 8 }}>복습이 필요한 단어</div>
                        {reviewList.length === 0 && notStartedList.length === 0 && (
                            <div style={{ color: '#aaa', fontSize: 15 }}>모든 단어를 완벽하게 학습했어요!</div>
                        )}
                        {reviewList.map(word => {
                            const card = toFSRSCard(word, word);
                            const recall = Math.round(getRecallProbability(card) * 100);
                            return (
                                <div key={word.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #333' }}>
                                    <span style={{ fontWeight: 700, color: '#FFA726', minWidth: 60 }}>{word.spanish}</span>
                                    <span style={{ color: '#aaa', fontSize: 14 }}>{word.korean}</span>
                                    <span style={{ color: '#4FC3F7', fontWeight: 600, marginLeft: 'auto', fontSize: 14 }}>암기 {recall}%</span>
                                </div>
                            );
                        })}
                        {notStartedList.length > 0 && (
                            <div style={{ fontWeight: 700, fontSize: 16, color: '#888', margin: '12px 0 4px 0' }}>아직 학습하지 않은 단어</div>
                        )}
                        {notStartedList.map(word => (
                            <div key={word.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #333' }}>
                                <span style={{ fontWeight: 700, color: '#888', minWidth: 60 }}>{word.spanish}</span>
                                <span style={{ color: '#aaa', fontSize: 14 }}>{word.korean}</span>
                                <span style={{ color: '#aaa', fontWeight: 600, marginLeft: 'auto', fontSize: 14 }}>암기 0%</span>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24 }}>
                    <button className="main-btn" style={{ padding: '12px 28px', fontSize: 17, borderRadius: 10, background: '#5d5dff', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }} onClick={() => setSessionStarted(false)}>다시 학습</button>
                    <button className="main-btn" style={{ padding: '12px 28px', fontSize: 17, borderRadius: 10, background: '#232326', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }} onClick={() => navigate('/learn')}>학습 메뉴로</button>
                </div>
            </div>
        );
    }

    const currentWord = sessionWords[currentIndex] || {};
    const progressPercent = sessionWords.length > 0 ? ((currentIndex + 1) / sessionWords.length) * 100 : 0;

    // 카드 상태 계산
    const userWordProgress = words.find(w => w.id === currentWord.id) || {};
    const card = toFSRSCard(userWordProgress, currentWord);
    const recall = getRecallProbability(card);
    const color = getMemoryColor(recall);
    const percent = Math.round(recall * 100);
    let status = userWordProgress.status || 'not_started';
    let statusLabel = '';
    let statusColor = '#888';
    let statusIcon = '⏳';
    if (status === 'completed') { statusLabel = '완료'; statusColor = '#66bb6a'; statusIcon = '✔️'; }
    else if (status === 'review_needed') { statusLabel = '복습 필요'; statusColor = '#FFA726'; statusIcon = '🔄'; }
    else { statusLabel = '미학습'; statusColor = '#888'; statusIcon = '⏳'; }

    return (
        <div className="flashcard-container">
            <div className="flashcard-header">
                <button className="exit-btn" onClick={() => navigate('/learn')}>✕</button>
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="progress-text">{currentIndex + 1} / {sessionWords.length}</span>
                </div>
                <div className="card-status-bar" style={{ color: statusColor, fontWeight: 700, marginLeft: 12, display: 'flex', alignItems: 'center', fontSize: 15 }}>
                    <span style={{ fontSize: 18, marginRight: 4 }}>{statusIcon}</span>{statusLabel}
                </div>
            </div>

            <div
                className={`flashcard-scene ${isFlipped ? 'is-flipped' : ''}`}
                ref={cardRef}
                onClick={handleFlip}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
            >
                <div className="flashcard" style={{
                    transform: swipeDeltaX !== 0 ? `translateX(${swipeDeltaX}px)` : undefined,
                    transition: swipeDeltaX === 0 ? 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' : 'none',
                    border: `2.5px solid ${statusColor}`,
                    boxShadow: isFlipped ? `0 4px 32px ${color}44` : '0 2px 12px #0002',
                    background: isFlipped ? color + '11' : '#2c2c2e',
                }}>
                    <div className="card-face card-front">
                        <span className="part-of-speech">{currentWord.pos}</span>
                        <p>{currentWord.spanish}</p>
                        <div className="card-status-front" style={{ color: statusColor, fontWeight: 600, marginTop: 8, fontSize: 15 }}>
                            <span style={{ fontSize: 18, marginRight: 4 }}>{statusIcon}</span>{statusLabel}
                        </div>
                    </div>
                    <div className="card-face card-back">
                        <span className="part-of-speech">{currentWord.pos}</span>
                        <p>{currentWord.korean || '뜻 정보 없음'}</p>
                        <div className="recall-bar">
                            <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: 8, transition: 'width 0.3s, background 0.3s' }} />
                        </div>
                        <div className="card-status-back" style={{ color: color, fontWeight: 600, marginTop: 8, fontSize: 15 }}>
                            암기율: {percent}%
                        </div>
                    </div>
                </div>
            </div>

            {isFlipped && (
                <div className="difficulty-buttons duolingo-style">
                    <button
                        className={`level-btn again`}
                        onClick={() => handleLevelSelect('again')}
                        style={{}}
                        disabled={false}
                    >어려워요</button>
                    <button
                        className={`level-btn hard`}
                        onClick={() => handleLevelSelect('hard')}
                        style={{}}
                        disabled={false}
                    >애매해요</button>
                    <button
                        className={`level-btn good`}
                        onClick={() => handleLevelSelect('good')}
                        style={{}}
                        disabled={false}
                    >완벽해요</button>
                </div>
            )}
        </div>
    );
};

export default FlashcardPage; 