import './App.css';
import { useState, useEffect } from 'react';
import supabase from './supabaseClient';
import AuthPage from './AuthPage';
import HomePage from './HomePage';
import LearnMenu from './LearnMenu';
import FlashcardPage from './FlashcardPage';
import QuizPage from './QuizPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './MainLayout';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<HomePage />} />
        <Route path="learn" element={<LearnMenu />} />
        <Route path="learn/flashcard" element={<FlashcardPage />} />
        <Route path="learn/quiz" element={<QuizPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
