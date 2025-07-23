import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import supabase from './supabaseClient';
import { fetchAndCacheWords, mergeWordsWithProgress, clearWordsFromIndexedDB, syncProgressWithSupabase, getLastSyncDate } from './utils/wordStorage';
import './App.css';

import BottomNav from './BottomNav'; // BottomNav 임포트

const MainLayout = () => {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const navigate = useNavigate();

    const runSyncAndLoad = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id) {
            await syncProgressWithSupabase(user.id);
        }
        const fetchedWords = await fetchAndCacheWords();
        if (!fetchedWords) {
            throw new Error('단어 데이터를 가져오지 못했습니다');
        }
        const mergedWords = await mergeWordsWithProgress(fetchedWords);
        setWords(mergedWords);
    }, []);

    useEffect(() => {
        const initialLoad = async () => {
            try {
                setLoading(true);
                await runSyncAndLoad();
            } catch (error) {
                console.error('초기 데이터 로드 중 오류:', error);
                setToast({ show: true, message: `데이터 로드 실패: ${error.message}`, type: 'error' });
                setTimeout(() => setToast(t => ({ ...t, show: false })), 5000);
            } finally {
                setLoading(false);
            }
        };
        initialLoad();
    }, [runSyncAndLoad]);

    const handleManualSync = async () => {
        setSyncStatus('syncing');
        setToast({ show: true, message: '데이터 동기화 중...', type: 'info' });

        try {
            await runSyncAndLoad();
            const date = await getLastSyncDate();
            setSyncStatus('success');
            setToast({ show: true, message: `동기화 완료! 최근 동기화: ${new Date(date).toLocaleString()}`, type: 'success' });
        } catch (error) {
            console.error('수동 동기화 중 오류:', error);
            setSyncStatus('error');
            setToast({ show: true, message: `오류 발생: ${error.message}`, type: 'error' });
        } finally {
            setTimeout(() => {
                setToast(t => ({ ...t, show: false }));
                setSyncStatus('idle');
            }, 5000);
        }
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

    const Toast = () => {
        if (!toast.show) return null;

        const toastStyles = {
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            zIndex: 1100,
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            opacity: toast.show ? 1 : 0,
            transform: toast.show ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.3s ease-in-out',
            background: '#333',
        };

        if (toast.type === 'success') {
            toastStyles.background = '#30D158';
        } else if (toast.type === 'error') {
            toastStyles.background = '#FF453A';
        } else {
            toastStyles.background = '#007AFF';
        }

        return <div style={toastStyles}>{toast.message}</div>;
    };

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
        <div className="main-layout" style={{ paddingBottom: '60px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Toast />
              <Outlet context={{ words, setWords, loading, handleManualSync }} />
            </div>
            <BottomNav />
        </div>
    );
};


export default MainLayout;
