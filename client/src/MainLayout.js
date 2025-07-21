import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import { fetchAndCacheWords, mergeWordsWithProgress, clearWordsFromIndexedDB } from './utils/wordStorage';
import './App.css';

const getStats = (words) => {
    const total = words.length;
    if (total === 0) return { total: 0, completed: 0, notStarted: 0, reviewNeeded: 0, percent: 0 };
    const completed = words.filter(w => w.status === 'completed').length;
    const notStarted = words.filter(w => !w.status || w.status === 'not_started').length;
    const reviewNeeded = words.filter(w => w.status === 'review_needed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, notStarted, reviewNeeded, percent };
};

const MainLayout = () => {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const loadWords = async () => {
            try {
                setLoading(true);
                console.log('단어 데이터 가져오는 중...');
                const fetchedWords = await fetchAndCacheWords();
                console.log('가져온 단어 데이터:', fetchedWords);
                if (!fetchedWords) {
                    console.error('단어 데이터를 가져오지 못했습니다');
                    return;
                }
                const mergedWords = await mergeWordsWithProgress(fetchedWords);
                console.log('진도 데이터와 병합된 단어:', mergedWords);
                setWords(mergedWords);
            } catch (error) {
                console.error('단어 데이터 로드 중 오류:', error);
            } finally {
                setLoading(false);
            }
        };

        loadWords();
    }, []);

    const handleRefresh = async () => {
        try {
            setLoading(true);
            await clearWordsFromIndexedDB();
            const ws = await fetchAndCacheWords().then(mergeWordsWithProgress);
            setWords(ws);
        } catch (error) {
            console.error('Error refreshing words:', error);
        } finally {
            setLoading(false);
        }
    };

    async function signOut() {
        await supabase.auth.signOut();
    }

    const stats = getStats(words);

    if (loading) {
        return (
            <div style={{ 
                width: '100vw', 
                height: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#1a1a1a',
                color: 'white',
                fontSize: '1.2rem'
            }}>
                <div>단어 데이터를 불러오는 중...</div>
            </div>
        );
    }

    if (!words || words.length === 0) {
        return (
            <div style={{ 
                width: '100vw', 
                height: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#1a1a1a',
                color: 'white',
                fontSize: '1.2rem',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <div>단어 데이터를 찾을 수 없습니다.</div>
                <button 
                    onClick={handleRefresh}
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#4FC3F7',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    데이터 새로고침
                </button>
            </div>
        );
    }

    return (
        <div className="main-layout">
            <div className="homepage-overlay">
                <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'fixed', width: '100%', top: 0, left: 0, padding: '8px 24px', boxSizing: 'border-box', zIndex: 1200 }}>
                    <div className="dashboard-btns" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button className="sub-btn" onClick={signOut}>Sign Out</button>
                        <button className="main-btn" onClick={() => navigate('/learn')}>학습 메뉴로 이동</button>
                        <button className="main-btn" onClick={handleRefresh}>데이터 새로고침</button>
                    </div>
                </div>
            </div>
            <Outlet context={{ words, setWords, loading }} />
        </div>
    );
};

export default MainLayout; 