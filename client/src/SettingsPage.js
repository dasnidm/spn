import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import supabase from './supabaseClient';
import { get, set } from 'idb-keyval';
import './SettingsPage.css';

const GOAL_KEY = 'daily_learning_goal';
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const SettingsPage = () => {
  const { handleManualSync } = useOutletContext();
  const [dailyGoal, setDailyGoal] = useState(10);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    get(GOAL_KEY).then(val => {
      if (val) setDailyGoal(val);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setIsSubscribed(true);
          }
          setSubscriptionLoading(false);
        });
      });
    } else {
      setSubscriptionLoading(false);
    }
  }, []);

  const handleSetGoal = (goal) => {
    setDailyGoal(goal);
    set(GOAL_KEY, goal);
    // TODO: DB에 사용자 목표 저장
  };

  const handleNotificationSubscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.error('VAPID 공개 키가 설정되지 않았습니다.');
      alert('알림 기능 설정에 오류가 발생했습니다.');
      return;
    }
    if (!('PushManager' in window)) {
      alert('이 브라우저에서는 푸시 알림을 지원하지 않습니다.');
      return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('알림 권한이 거부되었습니다.');
      return;
    }

    setSubscriptionLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { error } = await supabase.functions.invoke('save-push-subscription', {
          body: { subscription },
      });

      if (error) {
          throw error;
      }
      
      setIsSubscribed(true);
      alert('알림이 성공적으로 구독되었습니다!');
    } catch (error) {
      alert('알림 구독에 실패했습니다. 콘솔을 확인해주세요.');
      console.error('알림 구독 오류:', error);
      // 구독 실패 시, 사용자에게 다시 시도하도록 유도하거나 원인을 알려줄 수 있습니다.
      const existingSubscription = await navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription());
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };
  
  const handleNotificationUnsubscribe = async () => {
    setSubscriptionLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // TODO: 서버에 구독 취소 정보 전송
        await subscription.unsubscribe();
        setIsSubscribed(false);
        alert('알림이 해지되었습니다.');
      }
    } catch (error) {
      alert('알림 해지에 실패했습니다.');
      console.error('알림 해지 오류:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleForceSync = async () => {
    if (!window.confirm('정말로 로컬 데이터를 모두 지우고 서버 데이터로 덮어쓰시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    alert('강제 동기화 기능은 현재 개발 중입니다.');
  };

  return (
    <div className="settings-page-container">
      <div className="settings-card">
        <div className="settings-header">
          <h2>설정</h2>
        </div>

        <div className="settings-section">
          <h3>일일 학습 목표</h3>
          <p className="settings-description">
            하루에 학습할 단어 개수를 설정하세요.
          </p>
          <div className="goal-options">
            {[10, 20, 30, 50].map(goal => (
              <button key={goal} className={`goal-button ${dailyGoal === goal ? 'active' : ''}`} onClick={() => handleSetGoal(goal)}>
                {goal}개
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>학습 리마인더 알림</h3>
          <p className="settings-description">
            매일 저녁, 학습 목표를 달성하지 못했을 때 알림을 받아보세요.
          </p>
          <div className="sync-action">
            {isSubscribed ? (
              <button onClick={handleNotificationUnsubscribe} disabled={subscriptionLoading} className="sync-button-danger">
                {subscriptionLoading ? '처리 중...' : '알림 해지하기'}
              </button>
            ) : (
              <button onClick={handleNotificationSubscribe} disabled={subscriptionLoading} className="sync-button-manual">
                {subscriptionLoading ? '확인 중...' : '알림 받기'}
              </button>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3>데이터 동기화</h3>
          <p className="settings-description">
            다른 기기에서 학습한 내용을 현재 기기에 즉시 반영하고 싶을 때 사용하세요.
          </p>
          <div className="sync-action">
            <button onClick={handleManualSync} className="sync-button-manual">
              수동 동기화 실행
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>데이터 초기화 및 강제 동기화</h3>
          <p className="settings-description">
            <strong>주의:</strong> 데이터가 꼬이거나 문제가 발생했을 때만 사용하세요.
            이 기능은 현재 기기의 <strong>로컬 데이터를 모두 삭제</strong>하고, 서버의 최신 데이터로 강제 덮어쓰기합니다.
          </p>
          <div className="sync-action">
            <button onClick={handleForceSync} className="sync-button-danger">
              로컬 데이터 초기화 및 서버와 동기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
