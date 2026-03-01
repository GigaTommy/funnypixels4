import React from 'react';
import { AuthService } from '../../services/auth';

interface LoginButtonProps {
  onLoginClick: () => void;
}

export default function LoginButton({ onLoginClick }: LoginButtonProps) {
  // 检查是否为游客模式
  const isGuest = AuthService.isGuest();
  
  // 如果不是游客模式，不显示登录按钮
  if (!isGuest) {
    return null;
  }

  return (
    <div 
      className="fixed top-4 right-4 z-[1003]"
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 1003
      }}
    >
      <button
        onClick={onLoginClick}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          borderRadius: '8px',
          border: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'background-color 0.2s ease',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10,17 15,12 10,7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        登录
      </button>
    </div>
  );
}
