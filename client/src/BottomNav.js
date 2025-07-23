import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/dashboard" className="nav-link">
        <span className="icon">📚</span>
        <span>대시보드</span>
      </NavLink>
      <NavLink to="/learn" className="nav-link">
        <span className="icon">🔥</span>
        <span>학습</span>
      </NavLink>
      <NavLink to="/stats" className="nav-link">
        <span className="icon">📊</span>
        <span>통계</span>
      </NavLink>
      <NavLink to="/settings" className="nav-link">
        <span className="icon">⚙️</span>
        <span>설정</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
