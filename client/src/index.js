import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import HomePage from './HomePage'; // HomePage 임포트
// import LearnMenu from './LearnMenu'; // 나중에 만들 LearnMenu
import reportWebVitals from './reportWebVitals';
import Modal from 'react-modal'; // react-modal 임포트

// 스크린 리더 사용자를 위해 앱의 루트 요소를 알려줍니다.
Modal.setAppElement('#root');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
