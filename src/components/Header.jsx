import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header({ onToggleSidebar }) {
  const { currentAccount } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="mobile-header">
      <button className="hamburger" onClick={onToggleSidebar}>☰</button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }} id="mobile-acc-name">
          {currentAccount ? currentAccount.name : 'Tasksup'}
        </div>
      </div>
      <button 
        className="btn-icon" 
        onClick={() => navigate('/select-account')} 
        title="تبديل الحساب" 
        style={{ border: 'none', background: 'none' }}
      >
        🔄
      </button>
    </header>
  );
}
