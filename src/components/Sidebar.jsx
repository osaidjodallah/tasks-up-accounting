import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose, currentSystem, setCurrentSystem }) {
  const { session, authData, currentAccount, logout, canView } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) return null;

  // Determine which accounts are accessible
  const getAccessibleAccounts = () => {
    const auth = authData || JSON.parse(localStorage.getItem('mkt_auth_v2'));
    const client = auth?.clients?.find(c => c.id === session.clientId);
    let accounts = client?.accounts || [];
    
    if (session.type === 'employee') {
      const emp = client?.employees?.find(e => e.id === session.userId);
      accounts = accounts.filter(a => emp?.permissions?.[a.id]?.access);
    }
    return accounts;
  };

  const accessibleAccounts = getAccessibleAccounts();
  const hasStore = accessibleAccounts.some(a => a.type === 'store');
  const hasServices = accessibleAccounts.some(a => a.type === 'services');
  const hasClix = accessibleAccounts.some(a => a.type === 'clix');

  const handleSystemSwitch = (sys) => {
    setCurrentSystem(sys);
    
    // Auto-select corresponding account if type is different
    const targetType = sys === 'store' ? 'store' : sys === 'clix' ? 'clix' : 'services';
    if (currentAccount && currentAccount.type !== targetType) {
      const targetAcc = accessibleAccounts.find(a => a.type === targetType);
      if (targetAcc) {
        // Trigger account reload via navigate/select
        navigate('/select-account');
        return;
      }
    }

    // Go to default page for system
    if (sys === 'accounting') navigate('/dashboard');
    else if (sys === 'clix') navigate('/clix');
    else navigate('/store');
    
    if (onClose) onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Render navigation items based on current active system
  const renderNavItems = () => {
    const isEmp = session.type === 'employee';

    if (currentSystem === 'accounting') {
      return (
        <div id="nav-accounting">
          {(!isEmp || canView('dashboard')) && (
            <>
              <div className="nav-section">الرئيسية</div>
              <button 
                className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                onClick={() => { navigate('/dashboard'); onClose && onClose(); }}
              >
                <span className="icon">📊</span> لوحة التحكم
              </button>
            </>
          )}
          
          {(!isEmp || canView('clients') || canView('payments') || canView('expenses') || canView('settings')) && (
            <div className="nav-section">الإدارة والمالية</div>
          )}
          {(!isEmp || canView('clients')) && (
            <button 
              className={`nav-item ${isActive('/clients') ? 'active' : ''}`}
              onClick={() => { navigate('/clients'); onClose && onClose(); }}
            >
              <span className="icon">👥</span> العملاء والمشتركين
            </button>
          )}
          {(!isEmp || canView('payments')) && (
            <button 
              className={`nav-item ${isActive('/payments-due') ? 'active' : ''}`}
              onClick={() => { navigate('/payments-due'); onClose && onClose(); }}
            >
              <span className="icon">🔔</span> الدفعات المستحقة
            </button>
          )}
          {(!isEmp || canView('expenses')) && (
            <button 
              className={`nav-item ${isActive('/expenses') ? 'active' : ''}`}
              onClick={() => { navigate('/expenses'); onClose && onClose(); }}
            >
              <span className="icon">💸</span> المصاريف العامة
            </button>
          )}
          {(!isEmp || canView('settings')) && (
            <button 
              className={`nav-item ${isActive('/services') ? 'active' : ''}`}
              onClick={() => { navigate('/services'); onClose && onClose(); }}
            >
              <span className="icon">⚙️</span> الخدمات والأسعار
            </button>
          )}
          
          {(!isEmp || canView('analysis') || canView('settings')) && (
            <div className="nav-section">ميزات متقدمة</div>
          )}
          {(!isEmp || canView('analysis')) && (
            <button 
              className={`nav-item ${isActive('/invoices') ? 'active' : ''}`}
              onClick={() => { navigate('/invoices'); onClose && onClose(); }}
            >
              <span className="icon">📄</span> مصمم الفواتير PDF
            </button>
          )}
          {(!isEmp || canView('settings')) && (
            <button 
              className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => { navigate('/settings'); onClose && onClose(); }}
            >
              <span className="icon">🔧</span> الإعدادات الحسابية
            </button>
          )}
        </div>
      );
    } else if (currentSystem === 'store') {
      // Store System
      return (
        <div id="nav-store">
          {(!isEmp || canView('dashboard') || canView('orders') || canView('settings')) && (
            <div className="nav-section">المبيعات</div>
          )}
          {(!isEmp || canView('dashboard')) && (
            <button 
              className={`nav-item ${isActive('/store') ? 'active' : ''}`}
              onClick={() => { navigate('/store'); onClose && onClose(); }}
            >
              <span className="icon">📊</span> ملخص المبيعات
            </button>
          )}
          {(!isEmp || canView('orders')) && (
            <button 
              className={`nav-item ${isActive('/store/orders') ? 'active' : ''}`}
              onClick={() => { navigate('/store/orders'); onClose && onClose(); }}
            >
              <span className="icon">🛍</span> سجل الطلبات
            </button>
          )}
          {(!isEmp || canView('settings')) && (
            <button 
              className={`nav-item ${isActive('/store/products') ? 'active' : ''}`}
              onClick={() => { navigate('/store/products'); onClose && onClose(); }}
            >
              <span className="icon">📦</span> المنتجات والمخزن
            </button>
          )}
          
          {(!isEmp || canView('analysis')) && (
            <>
              <div className="nav-section">المالية والتحليلات</div>
              <button 
                className={`nav-item ${isActive('/store/profit') ? 'active' : ''}`}
                onClick={() => { navigate('/store/profit'); onClose && onClose(); }}
              >
                <span className="icon">💰</span> حاسبة الأرباح والمصاريف
              </button>
            </>
          )}
          
          {(!isEmp || canView('clients') || canView('whatsapp')) && (
            <div className="nav-section">العملاء والولاء</div>
          )}
          {(!isEmp || canView('clients')) && (
            <button 
              className={`nav-item ${isActive('/store/loyalty') ? 'active' : ''}`}
              onClick={() => { navigate('/store/loyalty'); onClose && onClose(); }}
            >
              <span className="icon">🎁</span> نادي الولاء والنقاط
            </button>
          )}
          {(!isEmp || canView('whatsapp')) && (
            <button 
              className={`nav-item ${isActive('/store/whatsapp') ? 'active' : ''}`}
              onClick={() => { navigate('/store/whatsapp'); onClose && onClose(); }}
            >
              <span className="icon">📱</span> إرسال واتساب مجمع
            </button>
          )}
          
          {(!isEmp || canView('settings')) && (
            <>
              <div className="nav-section">ميزات متقدمة</div>
              <button 
                className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
                onClick={() => { navigate('/settings'); onClose && onClose(); }}
              >
                <span className="icon">⚙️</span> إعدادات المتجر والواتساب
              </button>
            </>
          )}
        </div>
      );
    } else if (currentSystem === 'clix') {
      // Clix System
      return (
        <div id="nav-clix">
          {(!isEmp || canView('orders')) && (
            <>
              <div className="nav-section">الاشتراكات</div>
              <button 
                className={`nav-item ${isActive('/clix') ? 'active' : ''}`}
                onClick={() => { navigate('/clix'); onClose && onClose(); }}
              >
                <span className="icon">🎮</span> طلبات الكروت Clix
              </button>
            </>
          )}
          
          {(!isEmp || canView('settings')) && (
            <>
              <div className="nav-section">إعدادات النظام</div>
              <button 
                className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
                onClick={() => { navigate('/settings'); onClose && onClose(); }}
              >
                <span className="icon">⚙️</span> الإعدادات الحسابية
              </button>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  const getAccountTypeLabel = (type) => {
    if (type === 'store') return '🛒 متجر إلكتروني';
    if (type === 'clix') return '🎮 Clix';
    return '💼 خدمات تسويقية';
  };

  const getInitials = (name) => {
    return (name || '؟').trim().split(' ').map(w => w[0]).join('').slice(0, 2);
  };

  return (
    <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img 
          src="/logo.png.png" 
          alt="Tasksup" 
          style={{ width: '34px', height: '34px', objectFit: 'contain', flexShrink: 0 }}
          onError={(e) => { e.target.src = 'https://placehold.co/100'; }}
        />
        <div>
          <h2 id="sidebar-title" style={{ fontSize: '15px', fontWeight: 900, color: '#0d47a1', letterSpacing: '0.5px' }}>Tasksup</h2>
          <p id="sidebar-sub" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {currentSystem === 'accounting' ? 'نظام إدارة العملاء والمالية' : currentSystem === 'clix' ? 'إدارة اشتراكات Clix' : 'إدارة الطلبات والمبيعات'}
          </p>
        </div>
      </div>

      {/* Current Account Card */}
      <div className="sidebar-account" onClick={() => navigate('/select-account')}>
        <div className="sa-name" id="sidebar-acc-name">{currentAccount ? currentAccount.name : '—'}</div>
        <div className="sa-type" id="sidebar-acc-type">{currentAccount ? getAccountTypeLabel(currentAccount.type) : 'اضغط للتبديل'} ↕</div>
      </div>

      {/* System Switcher */}
      <div className="system-switcher">
        {hasServices && (
          <button 
            className={`sys-btn ${currentSystem === 'accounting' ? 'active' : ''}`}
            onClick={() => handleSystemSwitch('accounting')}
          >
            💼 المحاسبة
          </button>
        )}
        {hasStore && (
          <button 
            className={`sys-btn ${currentSystem === 'store' ? 'active' : ''}`}
            onClick={() => handleSystemSwitch('store')}
          >
            🛒 المتجر
          </button>
        )}
        {hasClix && (
          <button 
            className={`sys-btn ${currentSystem === 'clix' ? 'active' : ''}`}
            onClick={() => handleSystemSwitch('clix')}
          >
            🎮 Clix
          </button>
        )}
      </div>

      {/* System specific Nav Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderNavItems()}
      </div>

      {/* Current User Card */}
      <div className="sidebar-user">
        <div className="su-avatar" id="sidebar-user-avatar">{getInitials(session.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="su-name" id="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</div>
          <div className="su-role" id="sidebar-user-role">{session.type === 'employee' ? 'موظف' : session.type === 'superadmin' ? 'مدير عام' : 'مالك'}</div>
        </div>
        <button 
          onClick={handleLogout} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          title="تسجيل الخروج"
        >
          🚪
        </button>
      </div>
    </nav>
  );
}
