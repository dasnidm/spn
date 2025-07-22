import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import FlashcardSetup from './FlashcardSetup';
import { fetchAndCacheVerbs } from './utils/wordStorage';
import { updateFSRSProgress } from './utils/fsrsUtils';
import { updateProgress } from './utils/wordStorage';
import './VerbPracticePage.css';

const TRANSLATIONS = {
    // Moods
    indicative: '직설법',
    subjunctive: '접속법',
    imperative: '명령법',
    // Tenses
    present: '현재',
    preterite: '단순 과거',
    imperfect: '불완전 과거',
    future: '미래',
    conditional: '가능',
    // Persons
    yo: '1인칭 단수 (yo)',
    tú: '2인칭 단수 (tú)',
    él: '3인칭 단수 (él/ella/usted)',
    nosotros: '1인칭 복수 (nosotros)',
    vosotros: '2인칭 복수 (vosotros)',
    ellos: '3인칭 복수 (ellos/ellas/ustedes)',
    // Imperative Persons
    affirmative: '긍정',
    negative: '부정',
};

const VerbPracticePage = () => {
    const { words, setWords } = useOutletContext();
    const navigate = useNavigate();
    const [verbs, setVerbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [practiceMode, setPracticeMode] = useState('multiple_choice'); // 기본값을 '객관식'으로 변경

    // Session and quiz state
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionVerbs, setSessionVerbs] = useState([]);
    const [sessionFinished, setSessionFinished] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [multipleChoiceOptions, setMultipleChoiceOptions] = useState([]);
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState(null); // {isCorrect: boolean, correctAnswer: string}

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            const verbData = await fetchAndCacheVerbs();
            if (verbData) {
                setVerbs(verbData);
            }
            setLoading(false);
        };
        init();
    }, []);

    const generateQuestion = (verb) => {
        const moods = Object.keys(verb.conjugations);
        const mood = moods[Math.floor(Math.random() * moods.length)];
        const tenses = Object.keys(verb.conjugations[mood]);
        const tense = tenses[Math.floor(Math.random() * tenses.length)];
        const persons = Object.keys(verb.conjugations[mood][tense]);
        const person = persons[Math.floor(Math.random() * persons.length)];
        const correctAnswer = verb.conjugations[mood][tense][person];

        // --- 개선된 오답 생성 로직 ---
        const options = [correctAnswer];
        
        // 1. 현재 동사의 모든 변화형을 하나의 리스트로 만듭니다.
        const verbForms = Object.values(verb.conjugations)
            .flatMap(mood => Object.values(mood))
            .flatMap(tense => Object.values(tense));
        
        // 2. 중복을 제거하고, 정답을 제외하여 '오답 풀'을 만듭니다.
        const wrongOptionPool = [...new Set(verbForms)].filter(form => form !== correctAnswer);

        // 3. 오답 풀을 무작위로 섞습니다.
        for (let i = wrongOptionPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wrongOptionPool[i], wrongOptionPool[j]] = [wrongOptionPool[j], wrongOptionPool[i]];
        }

        // 4. 오답 풀에서 3개를 선택지에 추가합니다.
        options.push(...wrongOptionPool.slice(0, 3));

        // 5. (안전장치) 만약 선택지가 4개 미만이면, 다른 동사에서라도 채워넣습니다.
        if (options.length < 4) {
            const allConjugations = verbs.flatMap(v => 
                Object.values(v.conjugations).flatMap(mood => 
                    Object.values(mood).flatMap(tense => Object.values(tense))
                )
            );
            const uniqueConjugations = [...new Set(allConjugations)];
            while (options.length < 4) {
                const randomOption = uniqueConjugations[Math.floor(Math.random() * uniqueConjugations.length)];
                if (!options.includes(randomOption)) {
                    options.push(randomOption);
                }
            }
        }
        
        // 6. 최종 선택지를 다시 한번 섞어 정답 위치를 무작위로 만듭니다.
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        setMultipleChoiceOptions(options);

        return { verb, mood, tense, person, correctAnswer };
    };

    const handleStartSession = (settings) => {
        let filteredVerbs = [];

        if (settings.filter === 'irregular_verbs') {
            filteredVerbs = verbs.filter(v => v.is_irregular);
        } else {
            // 기존 필터링 로직 (여기서는 단순 무작위 추출)
            // 추후 추천, 레벨별 등 고도화 가능
            filteredVerbs = [...verbs];
        }

        // 개수 적용
        const shuffled = filteredVerbs.sort(() => 0.5 - Math.random());
        const finalVerbs = settings.count === 'all' ? shuffled : shuffled.slice(0, settings.count);

        setSessionVerbs(finalVerbs);
        setSessionStarted(true);
        setCurrentIndex(0);
        setSessionFinished(false);
    };

    useEffect(() => {
        if (sessionStarted && currentIndex < sessionVerbs.length) {
            setCurrentQuestion(generateQuestion(sessionVerbs[currentIndex]));
            setUserAnswer('');
            setFeedback(null);
        } else if (sessionStarted && currentIndex >= sessionVerbs.length && sessionVerbs.length > 0) {
            setSessionFinished(true);
        }
    }, [sessionStarted, currentIndex, sessionVerbs]);

    const handleAnswer = async (answer) => {
        if (feedback) return;

        const isCorrect = answer.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
        setFeedback({ isCorrect, correctAnswer: currentQuestion.correctAnswer });

        // FSRS Update (await 없이 비동기 처리)
        if (user) {
            const level = isCorrect ? 'good' : 'again';
            const wordForProgress = words.find(w => w.id === currentQuestion.verb.word_id) || {};
            const fsrsResult = updateFSRSProgress(wordForProgress, { id: currentQuestion.verb.word_id }, level);
            
            updateProgress(currentQuestion.verb.word_id, fsrsResult); // await 제거
            
            setWords(allWords => allWords.map(w => w.id === currentQuestion.verb.word_id ? { ...w, ...fsrsResult } : w));
        }
    };

    const handleSubmitTyping = (e) => {
        e.preventDefault();
        handleAnswer(userAnswer);
    };

    const handleSelectOption = (option) => {
        setUserAnswer(option); // For feedback consistency
        handleAnswer(option);
    };

    const handleNext = () => {
        setCurrentIndex(i => i + 1);
    };
    
    if (loading) {
        return <div className="verb-practice-container"><h2>동사 데이터 로딩 중...</h2></div>;
    }

    if (!sessionStarted) {
        return <FlashcardSetup onStartSession={handleStartSession} />;
    }
    
    if (sessionFinished) {
        return <div className="verb-practice-container"><h2>세션 완료!</h2></div>;
    }

    if (!currentQuestion) {
        return <div className="verb-practice-container"><h2>질문 생성 중...</h2></div>;
    }

    return (
        <div className="verb-practice-container">
            <div className="quiz-header">
                <button className="exit-btn" onClick={() => navigate('/learn')}>✕</button>
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${(currentIndex / sessionVerbs.length) * 100}%` }}></div>
                    </div>
                    <span className="progress-text">{currentIndex + 1} / {sessionVerbs.length}</span>
                </div>
                {/* Mode Toggle Switch */}
                <div className="mode-switch">
                    <button onClick={() => setPracticeMode('typing')} className={practiceMode === 'typing' ? 'active' : ''}>타이핑</button>
                    <button onClick={() => setPracticeMode('multiple_choice')} className={practiceMode === 'multiple_choice' ? 'active' : ''}>객관식</button>
                </div>
            </div>

            <div className="verb-quiz-content">
                <div className="verb-question-area">
                    <div className="verb-tense-info">
                        <span>{currentQuestion.mood} / {currentQuestion.tense} / {currentQuestion.person}</span>
                        <span className="verb-tense-info-ko">
                            {TRANSLATIONS[currentQuestion.mood]} / {TRANSLATIONS[currentQuestion.tense]} / {TRANSLATIONS[currentQuestion.person]}
                        </span>
                    </div>
                    <h2 className="verb-infinitive">{currentQuestion.verb.verb}</h2>
                </div>

                {practiceMode === 'typing' ? (
                    <form onSubmit={handleSubmitTyping} className="verb-answer-form">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="정답을 입력하세요"
                            className={`verb-input ${feedback ? (feedback.isCorrect ? 'correct' : 'incorrect') : ''}`}
                            disabled={!!feedback}
                            autoCapitalize="none"
                            autoFocus
                        />
                        <button type="submit" className="verb-submit-btn" disabled={!!feedback}>
                            확인
                        </button>
                    </form>
                ) : (
                    <div className="options-grid verb-options">
                        {multipleChoiceOptions.map((option, index) => {
                            let buttonClass = 'option-btn';
                            if (feedback) {
                                if (option === currentQuestion.correctAnswer) {
                                    buttonClass += ' correct';
                                } else if (option === userAnswer) {
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
                                    disabled={!!feedback}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {feedback && (
                <div className={`quiz-footer ${feedback.isCorrect ? 'correct-bg' : 'incorrect-bg'}`}>
                    <div className="feedback-text">
                        {feedback.isCorrect ? '정답입니다!' : `오답입니다. 정답: ${feedback.correctAnswer}`}
                    </div>
                    <button className="continue-btn" onClick={handleNext}>
                        계속하기
                    </button>
                </div>
            )}
        </div>
    );
};

export default VerbPracticePage;