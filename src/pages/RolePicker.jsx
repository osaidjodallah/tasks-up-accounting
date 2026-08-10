import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RolePicker() {
  const { applyRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract roles and email from navigation state
  const { roles, email } = location.state || { roles: [], email: '' };

  // Safety redirect if accessed directly without state
  React.useEffect(() => {
    if (!roles || roles.length === 0) {
      navigate('/login');
    }
  }, [roles, navigate]);

  const handlePickRole = async (role) => {
    const res = await applyRole(role);
    navigate(res.route);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div id="role-picker-screen">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>اختر طريقة الدخول</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }} id="role-picker-email">
            {email}
          </div>
        </div>

        <div id="role-picker-list" style={{ display: 'grid', gap: '12px' }}>
          {roles.map((r, i) => {
            if (r.type === 'client') {
              const stores = (r.client.accounts || []).filter(a => a.type === 'store').length;
              const svcs = (r.client.accounts || []).filter(a => a.type === 'services').length;
              const clix = (r.client.accounts || []).filter(a => a.type === 'clix').length;
              
              return (
                <button 
                  key={i}
                  onClick={() => handlePickRole(r)}
                  style={{
                    width: '100%',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    textAlign: 'right',
                    cursor: 'pointer',
                    transition: 'border-color .2s, box-shadow .2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      👤
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>حسابك الشخصي (مالك الحساب)</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.client.name} • {stores} متجر • {svcs} خدمات {clix > 0 && `• ${clix} اشتراكات Clix`}
                      </div>
                    </div>
                  </div>
                </button>
              );
            } else {
              // Employee role
              const accCount = Object.values(r.emp.permissions || {}).filter(p => p.access).length;
              
              return (
                <button 
                  key={i}
                  onClick={() => handlePickRole(r)}
                  style={{
                    width: '100%',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    textAlign: 'right',
                    cursor: 'pointer',
                    transition: 'border-color .2s, box-shadow .2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      💼
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>موظف في: {r.client.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        الموظف: {r.emp.name} • لديه صلاحية دخول لـ {accCount} حسابات
                      </div>
                    </div>
                  </div>
                </button>
              );
            }
          })}
        </div>
        
        <button 
          className="btn btn-outline" 
          style={{ width: '100%', marginTop: '16px' }} 
          onClick={handleLogout}
        >
          خروج
        </button>
      </div>
    </div>
  );
}
