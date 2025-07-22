import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import { fetchAndCacheWords, mergeWordsWithProgress, clearWordsFromIndexedDB, syncProgressWithSupabase, getLastSyncDate } from './utils/wordStorage';
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
    const [syncStatus, setSyncStatus] = useState(null); // 'idle', 'syncing', 'success', 'error'
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSyncDate, setLastSyncDate] = useState(null);
    const navigate = useNavigate();

    const performSyncAndLoad = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.id) {
                await syncProgressWithSupabase(user.id);
            }
            await clearWordsFromIndexedDB();
            const fetchedWords = await fetchAndCacheWords();
            if (!fetchedWords) {
                console.error('단어 데이터를 가져오지 못했습니다');
                return;
            }
            const mergedWords = await mergeWordsWithProgress(fetchedWords);
            setWords(mergedWords);
            setSyncStatus('success');
            setSyncMessage('데이터 동기화 및 로드 완료!');
            const date = await getLastSyncDate();
            setLastSyncDate(date);
        } catch (error) {
            console.error('단어 데이터 로드/동기화 중 오류:', error);
            setSyncStatus('error');
            setSyncMessage('데이터 동기화 중 오류 발생: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        performSyncAndLoad();
    }, []);

    const handleManualSync = async () => {
        setSyncStatus('syncing');
        setSyncMessage('데이터 동기화 중...');
        await performSyncAndLoad();
    };

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
            <button
                onClick={handleManualSync}
                disabled={syncStatus === 'syncing'}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: '10px 15px',
                    background: syncStatus === 'success' ? '#30D158' : (syncStatus === 'error' ? '#FF453A' : '#4FC3F7'),
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    zIndex: 1000,
                    opacity: syncStatus === 'syncing' ? 0.7 : 1,
                }}
            >
                {syncStatus === 'syncing' ? '동기화 중...' : '수동 동기화'}
            </button>
            {syncMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '70px',
                    right: '20px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    zIndex: 1000,
                    fontSize: '0.9rem',
                }}>
                    {syncMessage}
                </div>
            )}
            {lastSyncDate && (
                <div style={{
                    position: 'fixed',
                    bottom: '120px',
                    right: '20px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    zIndex: 1000,
                    fontSize: '0.9rem',
                }}>
                    최근 동기화: {new Date(lastSyncDate).toLocaleString()}
                </div>
            )}
            <Outlet context={{ words, setWords, loading }} />
        </div>
    );
};

export default MainLayout;