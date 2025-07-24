import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import FlashcardSetup from './FlashcardSetup'; // Setup Component 재사용
import { updateFSRSProgress } from './utils/fsrsUtils';
import { updateProgress } from './utils/wordStorage';
import './QuizPage.css'; // 새로운 CSS 파일
import { filterWords } from './utils/wordFilter';

// 퀴즈 생성 로직 (기존 로직 활용)
function getQuiz(words, answerWord) {
    const pool = words.filter(w => w.id !== answerWord.id);
    const options = [answerWord];
    while (options.length < 4 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        options.push(pool[idx]);
        pool.splice(idx, 1);
    }
    // 셔플
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    return { answer: answerWord, options };
}

const QuizPage = () => {
    const { words, setWords } = useOutletContext();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    // 세션 관리
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionSettings, setSessionSettings] = useState(null);
    const [sessionWords, setSessionWords] = useState([]);
    const [sessionFinished, setSessionFinished] = useState(false);

    // 퀴즈 상태
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    
    // 통계
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);

    // 사용자 정보 가져오기
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    

    // 세션 시작 핸들러
    const handleStartSession = (settings) => {
        setSessionSettings(settings);
        const filtered = filterWords(words, settings);
        setSessionWords(filtered);
        setSessionStarted(true);
        setCurrentIndex(0);
        setCorrectCount(0);
        setWrongCount(0);
        setSessionFinished(false);
    };

    // 퀴즈 생성 로직
    useEffect(() => {
        if (sessionStarted && currentIndex < sessionWords.length) {
            const answerWord = sessionWords[currentIndex];
            // words prop 대신 sessionWords를 기반으로 오답 선택지를 만듭니다.
            setCurrentQuiz(getQuiz(sessionWords, answerWord));
            setSelectedOption(null);
            setIsCorrect(null);
        } else if (sessionStarted && currentIndex >= sessionWords.length && sessionWords.length > 0) {
            setSessionFinished(true);
        }
    }, [sessionStarted, currentIndex, sessionWords]);

    // 선택지 클릭 핸들러
    const handleSelectOption = (option) => {
        if (selectedOption) return; // 이미 선택했으면 무시

        const correct = option.id === currentQuiz.answer.id;
        setSelectedOption(option);
        setIsCorrect(correct);

        if (correct) {
            setCorrectCount(c => c + 1);
        } else {
            setWrongCount(w => w + 1);
            // 오답인 경우, 즉시 FSRS 업데이트
            if (user) {
                const userWordProgress = words.find(w => w.id === currentQuiz.answer.id) || {};
                const fsrsResult = updateFSRSProgress(userWordProgress, currentQuiz.answer, 'again');
                updateProgress(currentQuiz.answer.id, fsrsResult);
                setWords(allWords => allWords.map(w => w.id === currentQuiz.answer.id ? { ...w, ...fsrsResult } : w));
            }
        }
    };

    // 다음 문제로 이동
    const handleNext = (level = 'good') => { // 기본값을 'good'으로 설정
        // 정답을 맞춘 경우, 여기서 FSRS 업데이트
        if (isCorrect && user) {
            const userWordProgress = words.find(w => w.id === currentQuiz.answer.id) || {};
            const fsrsResult = updateFSRSProgress(userWordProgress, currentQuiz.answer, level);
            updateProgress(currentQuiz.answer.id, fsrsResult);
            setWords(allWords => allWords.map(w => w.id === currentQuiz.answer.id ? { ...w, ...fsrsResult } : w));
        }
        setCurrentIndex(i => i + 1);
    };

    // 초기 렌더링: 설정 화면
    if (!sessionStarted) {
        return <FlashcardSetup onStartSession={handleStartSession} />;
    }

    // 로딩 또는 단어 없음
    if (sessionWords.length === 0) {
        return (
            <div className="quiz-container">
                <div style={{ color: '#aaa', fontSize: 18, textAlign: 'center', marginTop: 60 }}>
                    해당 조건에 맞는 단어가 없습니다.<br/>필터를 변경하여 다시 시도해 주세요.
                </div>
                <button className="main-btn" onClick={() => setSessionStarted(false)}>
                    학습 설정으로 돌아가기
                </button>
            </div>
        );
    }
    
    // 세션 종료 화면
    if (sessionFinished) {
        return (
            <div className="quiz-session-finish">
                <h1>🎉 퀴즈 완료!</h1>
                <p>오늘도 한 걸음 성장했어요.</p>
                <div className="quiz-stats">
                    <div>정답: <span className="correct">{correctCount}</span></div>
                    <div>오답: <span className="wrong">{wrongCount}</span></div>
                    <div>정답률: <span>{Math.round((correctCount / sessionWords.length) * 100)}%</span></div>
                </div>
                <div className="finish-buttons">
                    <button onClick={() => setSessionStarted(false)}>다시하기</button>
                    <button onClick={() => navigate('/learn')}>학습 메뉴로</button>
                </div>
            </div>
        );
    }

    if (!currentQuiz) {
        return <div className="quiz-container">퀴즈를 불러오는 중...</div>;
    }

    const progressPercent = (currentIndex / sessionWords.length) * 100;

    return (
        <div className="quiz-container">
            <div className="quiz-header">
                <button className="exit-btn" onClick={() => navigate('/learn')}>✕</button>
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="progress-text">{currentIndex + 1} / {sessionWords.length}</span>
                </div>
                <div className="score-display">
                    <span className="correct">✓ {correctCount}</span>
                    <span className="wrong">✕ {wrongCount}</span>
                </div>
            </div>

            <div className="quiz-content">
                <div className="question-area">
                    <h2>{currentQuiz.answer.spanish}</h2>
                    <p>{currentQuiz.answer.pos}</p>
                </div>

                <div className="options-grid">
                    {currentQuiz.options.map((option, index) => {
                        let buttonClass = 'option-btn';
                        if (selectedOption) {
                            if (option.id === currentQuiz.answer.id) {
                                buttonClass += ' correct';
                            } else if (option.id === selectedOption.id) {
                                buttonClass += ' incorrect';
                            } else {
                                buttonClass += ' disabled';
                            }
                        }
                        return (
                            <button
                                key={index}
                                className={buttonClass}
                                onClick={() => handleSelectOption(option)}
                                disabled={!!selectedOption}
                            >
                                {option.korean}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedOption && (
                <div className={`quiz-footer ${isCorrect ? 'correct-bg' : 'incorrect-bg'}`}>
                    <div className="feedback-text">
                        {isCorrect ? '정답입니다!' : `오답입니다. 정답: ${currentQuiz.answer.korean}`}
                    </div>
                    {isCorrect ? (
                        <div className="correct-feedback-buttons">
                            <button className="continue-btn hard" onClick={() => handleNext('hard')}>
                                어려웠어요
                            </button>
                            <button className="continue-btn" onClick={() => handleNext('good')}>
                                계속하기
                            </button>
                        </div>
                    ) : (
                        <button className="continue-btn" onClick={() => handleNext()}>
                            계속하기
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuizPage;