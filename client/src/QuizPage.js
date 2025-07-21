import React, { useEffect, useState } from 'react';
import { fetchAndCacheWords } from './utils/wordStorage';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './App.css';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function filterWords(words, range) {
  if (range === 'not_started') return words.filter(w => !w.status || w.status === 'not_started');
  if (range === 'review_needed') return words.filter(w => w.status === 'review_needed');
  if (range === 'b3') return words.filter(w => w.category_code === 'B-3');
  if (range === 'random20') {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 20);
  }
  return words;
}

function getQuiz(words) {
  const answerIdx = getRandomInt(words.length);
  const answer = words[answerIdx];
  const pool = words.filter((w, i) => i !== answerIdx);
  const options = [answer];
  while (options.length < 4 && pool.length > 0) {
    const idx = getRandomInt(pool.length);
    options.push(pool[idx]);
    pool.splice(idx, 1);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { answer, options };
}

const QuizPage = () => {
  const [words, setWords] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [current, setCurrent] = useState(1);
  const [finished, setFinished] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const range = searchParams.get('range') || 'all';

  useEffect(() => {
    fetchAndCacheWords().then(ws => {
      const filtered = filterWords(ws, range);
      setWords(filtered);
      setLoading(false);
      setCorrect(0);
      setWrong(0);
      setCurrent(1);
      setFinished(false);
    });
  }, [range]);

  useEffect(() => {
    if (words.length > 0 && current <= words.length) {
      setQuiz(getQuiz(words));
      setSelected(null);
      setFeedback('');
    }
  }, [words, current]);

  const handleSelect = (opt) => {
    if (selected) return;
    setSelected(opt);
    if (opt.spanish === quiz.answer.spanish) {
      setFeedback('정답입니다! 🎉');
      setCorrect(c => c + 1);
    } else {
      setFeedback(`오답입니다. 정답: ${quiz.answer.spanish}`);
      setWrong(w => w + 1);
    }
  };

  const handleNext = () => {
    if (current >= words.length) {
      setFinished(true);
    } else {
      setQuiz(getQuiz(words));
      setSelected(null);
      setFeedback('');
      setCurrent(c => c + 1);
    }
  };

  if (loading) return <div className="loading-screen">단어 데이터를 불러오는 중...</div>;
  if (!words.length) return (
    <div className="empty-screen">
      <div className="empty-title">학습할 단어가 없습니다! 🎉</div>
      <div className="empty-sub">정답: {correct} / 오답: {wrong}</div>
      <button className="main-btn" onClick={() => navigate('/learn')}>
        학습 메뉴로 이동
      </button>
    </div>
  );
  if (finished) return (
    <div className="finish-screen">
      <div className="finish-title">🎉 퀴즈가 완료되었습니다!</div>
      <div className="finish-sub">정답: {correct} / 오답: {wrong}</div>
      <div className="finish-btns">
        <button className="main-btn" onClick={() => navigate('/dashboard')}>대시보드로 이동</button>
        <button className="main-btn" onClick={() => navigate('/learn')}>학습 메뉴로 이동</button>
      </div>
    </div>
  );
  if (!quiz) return null;

  return (
    <div className="flashcard-root">
      <button className="back-btn" onClick={() => navigate(-1)}>←</button>
      <h2 className="page-title">퀴즈 모드 (4지선다)</h2>
      <div className="progress-bar">
        <div className="progress-label">진도: {current} / {words.length} | 정답: {correct} / 오답: {wrong}</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(current / words.length) * 100}%` }} />
        </div>
      </div>
      <div className="card-area">
        <div className="flashcard" style={{ cursor: 'default', minHeight: 80 }}>
          <div className="word-ko" style={{ fontSize: '1.3rem', marginBottom: 8 }}>{quiz.answer.korean}</div>
        </div>
      </div>
      <div className="btn-group">
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            className={`main-btn ${selected ? (opt.spanish === quiz.answer.spanish ? 'know' : (opt === selected ? 'dontknow' : '')) : ''}`}
            style={{ margin: '0.2rem 0', fontSize: 20, opacity: selected && opt !== selected && opt.spanish !== quiz.answer.spanish ? 0.7 : 1 }}
            onClick={() => handleSelect(opt)}
            disabled={!!selected}
          >
            {opt.spanish}
          </button>
        ))}
      </div>
      {feedback && <div style={{ margin: '1.2rem 0', fontWeight: 'bold', color: feedback.includes('정답') ? '#4fc3f7' : '#f44336', fontSize: '1.1rem' }}>{feedback}</div>}
      {selected && <button className="sub-btn" onClick={handleNext} style={{ marginTop: 12 }}>다음 문제</button>}
    </div>
  );
};

export default QuizPage; 