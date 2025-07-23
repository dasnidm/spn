import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { getRecallProbability, getMemoryColor, toFSRSCard } from '../utils/fsrsUtils';
import { updateProgress } from '../utils/wordStorage';

// --- 스타일 상수 ---
const buttonStyle = {
    background: '#2c2c2e', color: 'white', border: 'none', padding: '8px 20px',
    borderRadius: '8px', cursor: 'pointer', marginLeft: 8, minWidth: 110,
    fontSize: 15, whiteSpace: 'nowrap'
};
const CHECKED_ICON_COLOR = '#FF453A'; // 체크 아이콘을 위한 빨간색

const WordDetailModal = ({ word, setWords, onClose }) => {
    const [currentWord, setCurrentWord] = useState(word);
    const [generatedExample, setGeneratedExample] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [generationError, setGenerationError] = useState(null);

    useEffect(() => {
        setCurrentWord(word);
    }, [word]);

    // AI 예문 관련 로직
    useEffect(() => {
        if (!currentWord) return;

        setGeneratedExample(null);
        setJobStatus(null);
        setGenerationError(null);

        const fetchInitialData = async () => {
            const { data: exampleData } = await supabase
                .from('generated_examples')
                .select('*')
                .eq('word_id', currentWord.id)
                .single();

            if (exampleData) {
                setGeneratedExample(exampleData);
                return;
            }

            const { data: jobData } = await supabase
                .from('example_generation_jobs')
                .select('status, error_message')
                .eq('word_id', currentWord.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (jobData) {
                setJobStatus(jobData.status);
                if (jobData.status === 'failed') {
                    setGenerationError(jobData.error_message || '예문 생성 중 오류가 발생했습니다.');
                }
            }
        };

        fetchInitialData();

        const channel = supabase.channel(`word-detail-${currentWord.id}`);
        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_examples', filter: `word_id=eq.${currentWord.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setGeneratedExample(payload.new);
                        setJobStatus('completed');
                    }
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'example_generation_jobs', filter: `word_id=eq.${currentWord.id}` },
                (payload) => {
                    const newStatus = payload.new?.status;
                    if (newStatus) {
                        setJobStatus(newStatus);
                        if (newStatus === 'failed') {
                            setGenerationError(payload.new.error_message || '예문 생성에 실패했습니다.');
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentWord]);

    const handleCreateJob = async () => {
        setJobStatus('pending');
        setGenerationError(null);
        setGeneratedExample(null);
        
        const { error } = await supabase.functions.invoke('create-example-request', {
            body: { word_id: currentWord.id },
        });

        if (error) {
            setGenerationError('예문 생성 요청에 실패했습니다. 다시 시도해 주세요.');
            setJobStatus(null);
        }
    };

    const handleToggleCheck = async () => {
        const newCheckedState = !(currentWord.is_checked || false);
        
        const progressToUpdate = {
            ...(currentWord.last_reviewed_at && {
                stability: currentWord.stability,
                difficulty: currentWord.difficulty,
                state: currentWord.state,
                lapses: currentWord.lapses,
                status: currentWord.status,
            }),
            is_checked: newCheckedState,
            last_reviewed_at: new Date().toISOString(),
        };

        await updateProgress(currentWord.id, progressToUpdate);

        const updatedWord = { ...currentWord, ...progressToUpdate };
        setCurrentWord(updatedWord);
        setWords(prevWords => prevWords.map(w => w.id === currentWord.id ? updatedWord : w));
    };

    const isChecked = currentWord.is_checked || false;
    const recall = isChecked ? 1 : getRecallProbability(toFSRSCard(currentWord, currentWord));
    const displayColor = getMemoryColor(recall);
    const displayPercent = Math.round(recall * 100);

    const renderExampleSection = () => {
        if (jobStatus === 'pending' || jobStatus === 'processing') {
            return <div style={{ color: '#aaa', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI가 예문을 만들고 있어요...</div>;
        }
        if (generatedExample) {
            return (
                <div style={{ position: 'relative', paddingRight: '30px' }}>
                    <p style={{ fontSize: 16, color: '#fff', margin: '0 0 4px 0' }}>{generatedExample.spanish_example}</p>
                    <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>{generatedExample.korean_translation}</p>
                    <button onClick={handleCreateJob} title="더 나은 예문으로 업데이트" style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '5px' }}>
                        ↻
                    </button>
                </div>
            );
        }
        if (jobStatus === 'failed') {
            return <div style={{ color: '#FF453A' }}>{generationError}</div>;
        }
        return (
            <button style={{ ...buttonStyle, background: '#64D2FF', color: '#1a1a1a', marginLeft: 0, fontSize: 14, padding: '8px 16px' }} onClick={handleCreateJob}>
                AI 예문 보기
            </button>
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: '#222', borderRadius: 16, padding: '32px 24px', minWidth: 260, maxWidth: 360, color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <span style={{ position: 'absolute', top: 18, right: 22, fontSize: 26, color: isChecked ? CHECKED_ICON_COLOR : '#888', cursor: 'pointer', zIndex: 2 }} title={isChecked ? '체크 해제' : '체크하여 암기 완료로 표시'} onClick={handleToggleCheck}>✔️</span>
                <h2 style={{ margin: '0 0 12px 0', fontSize: 28 }}>{currentWord.spanish}</h2>
                <div style={{ fontSize: 15, color: '#4FC3F7', marginBottom: 8 }}>{currentWord.pos}</div>
                <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{currentWord.korean}</div>
                {currentWord.english_meaning && <div style={{ fontSize: 16, color: '#FFD60A', marginBottom: 8 }}>영어 뜻: {currentWord.english_meaning}</div>}
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>빈도수: #{currentWord.frequency_rank}</div>
                <div style={{ margin: '12px 0 8px 0', fontSize: 15, fontWeight: 700, color: displayColor, background: displayColor + '22', borderRadius: 8, padding: '6px 0', display: 'inline-block', minWidth: 100 }}>
                    암기 정도: {displayPercent}%
                </div>
                {currentWord.status && <div style={{ fontSize: 13, color: '#FFA726', marginBottom: 8 }}>학습상태: {currentWord.status}</div>}
                <div style={{ margin: '16px 0 8px 0', padding: '12px 10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#64D2FF' }}>AI 동적 예문</div>
                    {renderExampleSection()}
                </div>
                <button style={{ marginTop: 16, padding: '8px 20px', background: '#4FC3F7', color: '#222', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer' }} onClick={onClose}>닫기</button>
            </div>
        </div>
    );
};

export default WordDetailModal;
