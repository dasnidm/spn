import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';
import Modal from 'react-modal';

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

// 서비스 워커를 등록하여 PWA 및 오프라인 기능을 활성화합니다.
// onUpdate 콜백은 새 버전이 감지되었을 때 실행됩니다.
serviceWorkerRegistration.register({
  onUpdate: registration => {
    const waitingServiceWorker = registration.waiting;

    if (waitingServiceWorker) {
      // 사용자에게 새 버전이 있음을 알리고 새로고침을 유도합니다.
      const userConfirmation = window.confirm(
        "새로운 버전이 있습니다. 앱을 업데이트하시겠습니까?"
      );
      if (userConfirmation) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        waitingServiceWorker.addEventListener('statechange', e => {
          if (e.target.state === 'activated') {
            window.location.reload();
          }
        });
      }
    }
  }
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
