import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  const { session, currentAccount, loading, canView, getPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSystem, setCurrentSystem] = useState('accounting');
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current system based on location path or currentAccount
  useEffect(() => {
    if (currentAccount) {
      if (currentAccount.type === 'store') setCurrentSystem('store');
      else if (currentAccount.type === 'clix') setCurrentSystem('clix');
      else setCurrentSystem('accounting');
    } else {
      if (location.pathname.startsWith('/store')) setCurrentSystem('store');
      else if (location.pathname.startsWith('/clix')) setCurrentSystem('clix');
      else setCurrentSystem('accounting');
    }
  }, [location.pathname, currentAccount]);

  // Protect route: Redirect to login if session doesn't exist
  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    } else if (!loading && session && !session.currentAccountId && location.pathname !== '/select-account' && location.pathname !== '/role-picker' && session.type !== 'superadmin') {
      navigate('/select-account');
    }
  }, [session, loading, navigate, location.pathname]);

  // Redirect employees from unauthorized pages
  useEffect(() => {
    if (!loading && session && session.type === 'employee' && session.currentAccountId) {
      const path = location.pathname;
      const pagePermMap = currentAccount?.type === 'store'
        ? { '/store': 'dashboard', '/store/orders': 'orders', '/store/products': 'settings', '/store/profit': 'analysis', '/store/loyalty': 'clients', '/store/whatsapp': 'whatsapp' }
        : currentAccount?.type === 'clix'
        ? { '/clix': 'orders' }
        : { '/dashboard': 'dashboard', '/clients': 'clients', '/payments-due': 'payments', '/expenses': 'expenses', '/services': 'settings', '/invoices': 'analysis', '/settings': 'settings' };
      
      const requiredPerm = pagePermMap[path];
      if (requiredPerm && !canView(requiredPerm)) {
        // Find the first accessible page
        const firstAllowed = Object.entries(pagePermMap).find(([, perm]) => canView(perm));
        if (firstAllowed) {
          navigate(firstAllowed[0]);
        }
      }
    }
  }, [session, loading, location.pathname, currentAccount, canView, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>Tasksup</div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>جاري تحميل النظام والبيانات...</div>
      </div>
    );
  }

  if (!session) return null;

  // Don't show layout on special screens
  const isSpecialScreen = ['/login', '/role-picker', '/select-account', '/superadmin'].includes(location.pathname);
  if (isSpecialScreen) {
    return <>{children}</>;
  }

  const getAccountTypeLabel = (type) => {
    if (type === 'store') return '🛒 متجر إلكتروني';
    if (type === 'clix') return '🎮 Clix';
    return '💼 خدمات تسويقية';
  };

  const getPagePermKey = () => {
    const path = location.pathname;
    const pagePermMap = currentAccount?.type === 'store'
      ? { '/store': 'dashboard', '/store/orders': 'orders', '/store/products': 'settings', '/store/profit': 'analysis', '/store/loyalty': 'clients', '/store/whatsapp': 'whatsapp' }
      : currentAccount?.type === 'clix'
      ? { '/clix': 'orders' }
      : { '/dashboard': 'dashboard', '/clients': 'clients', '/payments-due': 'payments', '/expenses': 'expenses', '/services': 'settings', '/invoices': 'analysis', '/settings': 'settings' };
    return pagePermMap[path];
  };

  const currentPermKey = getPagePermKey();
  const currentPermLevel = currentPermKey ? getPermission(currentPermKey) : null;

  return (
    <>
      {/* Mobile Header */}
      <Header onToggleSidebar={() => setSidebarOpen(true)} />

      {/* Sidebar Overlay (Mobile) */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        currentSystem={currentSystem}
        setCurrentSystem={setCurrentSystem}
      />

      {/* Main Content Area */}
      <main className="main">
        {/* Desktop Context Bar */}
        <div className="context-bar">
          <span className="acc-name-badge" id="ctx-acc-name">{currentAccount ? currentAccount.name : '—'}</span>
          <span className="acc-type-badge" id="ctx-acc-type">
            <span id="ctx-icon" style={{ marginLeft: '4px' }}>
              {currentAccount?.type === 'store' ? '🛒' : currentAccount?.type === 'clix' ? '🎮' : '💼'}
            </span>
            {currentAccount ? getAccountTypeLabel(currentAccount.type) : ''}
          </span>
          <div className="user-info">
            <span>مرحباً، <strong id="ctx-user-name">{session.name}</strong></span>
          </div>
        </div>

        {/* View-only Banner for Employees */}
        {session.type === 'employee' && currentPermLevel === 'view' && (
          <div className="view-only-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            👁 أنت في وضع العرض فقط — لا يمكنك تعديل البيانات في هذه الصفحة
          </div>
        )}

        {/* Dynamic page content */}
        {children}
      </main>
    </>
  );
}
