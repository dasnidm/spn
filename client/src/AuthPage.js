
import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import supabase from './supabaseClient';
import './App.css';

const AuthPage = () => {
  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2 className="page-title">로그인</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          localization={{
            variables: {
              sign_in: {
                email_label: '이메일 주소',
                password_label: '비밀번호',
                email_input_placeholder: '이메일 주소를 입력하세요',
                password_input_placeholder: '비밀번호를 입력하세요',
                button_label: '로그인',
                social_provider_text: '{{provider}} 계정으로 로그인',
                link_text: '이미 계정이 있으신가요? 로그인',
              },
              sign_up: {
                email_label: '이메일 주소',
                password_label: '비밀번호',
                email_input_placeholder: '이메일 주소를 입력하세요',
                password_input_placeholder: '비밀번호를 입력하세요',
                button_label: '회원가입',
                social_provider_text: '{{provider}} 계정으로 회원가입',
                link_text: '계정이 없으신가요? 회원가입',
              },
              forgotten_password: {
                email_label: '이메일 주소',
                email_input_placeholder: '이메일 주소를 입력하세요',
                button_label: '비밀번호 재설정 링크 보내기',
                link_text: '비밀번호를 잊으셨나요?',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default AuthPage;
