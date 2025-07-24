import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import FlashcardSetup from './FlashcardSetup';
import { filterWords } from './utils/wordFilter';
import { updateFSRSProgress } from './utils/fsrsUtils';
import { updateProgress } from './utils/wordStorage';
import './SentenceScramblePage.css';

// Fisher-Yates shuffle algorithm
const shuffleArray = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
};

const SentenceScramblePage = () => {
    const { words, setWords } = useOutletContext();
    const navigate = useNavigate();
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionSettings, setSessionSettings] = useState(null);
    const [sessionExamples, setSessionExamples] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Learning session state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState([]);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [isCorrect, setIsCorrect] = useState(null);
    const [sessionFinished, setSessionFinished] = useState(false);
    const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

    const currentExample = useMemo(() => {
        return sessionExamples.length > 0 ? sessionExamples[currentIndex] : null;
    }, [sessionExamples, currentIndex]);

    useEffect(() => {
        if (currentExample) {
            const exampleWords = currentExample.spanish_example.split(' ');
            setShuffledOptions(shuffleArray([...exampleWords]));
            setCurrentAnswer([]);
            setIsCorrect(null);
        }
    }, [currentExample]);

    const handleStartSession = async (settings) => {
        setSessionSettings(settings);
        setIsLoading(true);
        setSessionFinished(false);
        setSessionStats({ correct: 0, incorrect: 0 });
        setCurrentIndex(0);

        const filteredWords = filterWords(words, settings);
        const wordIds = filteredWords.map(word => word.id);

        if (wordIds.length === 0) {
            setIsLoading(false);
            return;
        }

        const { data: examples, error } = await supabase
            .from('generated_examples')
            .select('*')
            .in('word_id', wordIds);

        if (error) {
            setIsLoading(false);
            return;
        }
        
        const examplesToUse = shuffleArray(examples).slice(0, settings.count);
        setSessionExamples(examplesToUse);
        setSessionStarted(true);
        setIsLoading(false);
    };

    const handleOptionClick = (word, index) => {
        if (isCorrect !== null) return;
        setCurrentAnswer([...currentAnswer, word]);
        setShuffledOptions(shuffledOptions.filter((_, i) => i !== index));
    };

    const handleAnswerClick = (word, index) => {
        if (isCorrect !== null) return;
        setShuffledOptions([...shuffledOptions, word]);
        setCurrentAnswer(currentAnswer.filter((_, i) => i !== index));
    };

    const handleCheckAnswer = async () => {
        const userAnswer = currentAnswer.join(' ');
        const correctAnswer = currentExample.spanish_example;
        const isAnswerCorrect = userAnswer === correctAnswer;

        setIsCorrect(isAnswerCorrect);

        const targetWord = words.find(w => w.id === currentExample.word_id);
        if (targetWord) {
            const level = isAnswerCorrect ? 'good' : 'again';
            const fsrsResult = updateFSRSProgress(targetWord, targetWord, level);
            await updateProgress(targetWord.id, fsrsResult);
            const updatedWords = words.map(w =>
                w.id === targetWord.id ? { ...w, ...fsrsResult } : w
            );
            setWords(updatedWords);
        }

        setSessionStats(prev => ({
            ...prev,
            correct: prev.correct + (isAnswerCorrect ? 1 : 0),
            incorrect: prev.incorrect + (isAnswerCorrect ? 0 : 1),
        }));

        setTimeout(() => {
            if (currentIndex < sessionExamples.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setSessionFinished(true);
            }
        }, 1500);
    };

    if (!sessionStarted) {
        return <FlashcardSetup onStartSession={handleStartSession} isLoading={isLoading} />;
    }

    if (sessionFinished) {
        const accuracy = sessionExamples.length > 0 ? Math.round((sessionStats.correct / sessionExamples.length) * 100) : 0;
        return (
            <div className="flashcard-session-finish">
                <div className="finish-emoji">🎉</div>
                <div className="finish-title">세션 완료!</div>
                <div className="finish-sub">문장 구조 학습을 마쳤습니다.</div>
                <div className="finish-stats">
                    <div>정확도: <b>{accuracy}%</b></div>
                    <div>맞춘 문제: <b style={{color: '#30D158'}}>{sessionStats.correct}</b></div>
                    <div>틀린 문제: <b style={{color: '#FF453A'}}>{sessionStats.incorrect}</b></div>
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24 }}>
                    <button className="main-btn" onClick={() => setSessionStarted(false)}>다시 학습</button>
                    <button className="main-btn" onClick={() => navigate('/learn')}>학습 메뉴로</button>
                </div>
            </div>
        );
    }

    if (sessionExamples.length === 0 && !isLoading) {
        return (
            <div className="sentence-scramble-container" style={{justifyContent: 'center', alignItems: 'center'}}>
                <h1 style={{marginBottom: '1rem'}}>AI 예문 없음</h1>
                <p style={{marginBottom: '1.5rem', color: '#aaa'}}>학습할 AI 예문이 없습니다. 다른 단어를 선택하거나, 단어 상세 화면에서 AI 예문을 생성해주세요.</p>
                <button className="main-btn" onClick={() => setSessionStarted(false)}>설정으로 돌아가기</button>
            </div>
        );
    }
    
    const progressPercent = sessionExamples.length > 0 ? ((currentIndex + 1) / sessionExamples.length) * 100 : 0;

    return (
        <div className="sentence-scramble-container">
            <div className="flashcard-header">
                <button className="exit-btn" onClick={() => navigate('/learn')}>✕</button>
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="progress-text">{currentIndex + 1} / {sessionExamples.length}</span>
                </div>
            </div>

            <div className="scramble-content">
                <div className="scramble-question-area">
                    <p className="korean-translation">{currentExample?.korean_translation}</p>
                </div>

                <div className="scramble-answer-area" style={{ borderTopColor: isCorrect === true ? '#30D158' : isCorrect === false ? '#FF453A' : '#333' }}>
                    {currentAnswer.map((word, index) => (
                        <button key={index} className="word-chip" onClick={() => handleAnswerClick(word, index)}>
                            {word}
                        </button>
                    ))}
                    {currentAnswer.length === 0 && <div className="answer-placeholder">단어를 선택하여 문장을 완성하세요</div>}
                </div>

                <div className="scramble-options-area">
                    {shuffledOptions.map((word, index) => (
                        <button key={index} className="word-chip" onClick={() => handleOptionClick(word, index)}>
                            {word}
                        </button>
                    ))}
                </div>
            </div>

            <div className="scramble-footer" style={{ backgroundColor: isCorrect === true ? '#30D15820' : isCorrect === false ? '#FF453A20' : '#1a1a1a' }}>
                {isCorrect === null && <button className="check-btn" onClick={handleCheckAnswer} disabled={currentAnswer.length === 0}>확인하기</button>}
                {isCorrect === true && <div className="feedback-correct">정답입니다! молодец!</div>}
                {isCorrect === false && <div className="feedback-incorrect">아쉬워요, 다시 시도해보세요.</div>}
            </div>
        </div>
    );
};

export default SentenceScramblePage;
