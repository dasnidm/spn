import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LearnMenu.css'; // 스타일시트 임포트

const LearnMenu = () => {
    const navigate = useNavigate();

    return (
        <div className="learn-menu-container">
            <div className="learn-menu-header">
                <h1>학습 메뉴</h1>
                <p>원하는 학습 모드를 선택하여 어휘력을 향상시키세요.</p>
            </div>
            <div className="learn-mode-grid">
                <div 
                    className="learn-mode-card return-to-pyramid"
                    onClick={() => navigate('/')}
                >
                    <div className="card-icon">△</div>
                    <h2>피라미드로 돌아가기</h2>
                    <p>전체 단어 지도를 보며 진행 상황을 확인합니다.</p>
                    <div className="card-status">이동하기</div>
                </div>
                <div 
                    className="learn-mode-card active" 
                    onClick={() => navigate('/learn/flashcard')}
                >
                    <div className="card-icon">📚</div>
                    <h2>플래시카드</h2>
                    <p>새로운 단어를 배우거나, 아는 단어를 빠르게 복습하세요. SRS 시스템을 통해 가장 효율적인 학습 경로를 제공합니다.</p>
                    <div className="card-status">학습 시작하기</div>
                </div>

                <div 
                    className="learn-mode-card active"
                    onClick={() => navigate('/learn/quiz')}
                >
                    <div className="card-icon">✍️</div>
                    <h2>객관식 퀴즈</h2>
                    <p>네 가지 선택지 중 올바른 뜻을 고르며 단어 인지 능력을 테스트합니다.</p>
                    <div className="card-status">도전하기</div>
                </div>
                
                <div 
                    className="learn-mode-card active"
                    onClick={() => navigate('/learn/verb-practice')}
                >
                    <div className="card-icon">🗣️</div>
                    <h2>동사 변화 연습</h2>
                    <p>스페인어의 핵심인 동사 변화를 집중적으로 훈련합니다.</p>
                    <div className="card-status">연습하기</div>
                </div>
            </div>
        </div>
    );
};

export default LearnMenu; 