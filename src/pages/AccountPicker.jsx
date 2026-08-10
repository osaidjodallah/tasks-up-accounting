import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function AccountPicker() {
  const { session, authData, selectAccount, saveAuth, logout } = useAuth();
  const navigate = useNavigate();
  
  // Renaming account states
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [newName, setNewName] = useState('');

  if (!session) return null;

  // Filter accounts accessible by the user based on role permissions
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

  const accounts = getAccessibleAccounts();

  const handleSelectAccount = async (acc) => {
    await selectAccount(acc.id);
    if (acc.type === 'store') {
      navigate('/store');
    } else if (acc.type === 'clix') {
      navigate('/clix');
    } else {
      navigate('/dashboard');
    }
  };

  const handleOpenRenameModal = (e, acc) => {
    e.stopPropagation(); // Prevent card click event (account selection)
    if (session.type !== 'client') {
      alert('فقط مالك الحساب يمكنه تعديل أسماء الحسابات');
      return;
    }
    setSelectedAcc(acc);
    setNewName(acc.name);
    setRenameModalOpen(true);
  };

  const handleRenameAccount = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const auth = { ...authData };
      const client = auth.clients?.find(c => c.id === session.clientId);
      const acc = client?.accounts?.find(a => a.id === selectedAcc.id);
      
      if (acc) {
        acc.name = newName.trim();
        await saveAuth(auth);
        setRenameModalOpen(false);
      }
    } catch (err) {
      alert('حدث خطأ أثناء تعديل اسم الحساب');
    }
  };

  const getAccountTypeLabel = (type) => {
    if (type === 'store') return '🛒 متجر إلكتروني';
    if (type === 'clix') return '🎮 Clix';
    return '💼 خدمات تسويقية';
  };

  const getAccountIconClass = (type) => {
    if (type === 'store') return 'acc-icon-store';
    if (type === 'clix') return 'acc-icon-clix';
    return 'acc-icon-services';
  };

  const getAccountEmoji = (type) => {
    if (type === 'store') return '🛒';
    if (type === 'clix') return '🎮';
    return '💼';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div id="account-picker-screen">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <div className="acc-picker-header">
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>مرحباً 👋</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }} id="picker-welcome-name">
              {session.name}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}>خروج</button>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>حساباتك المتاحة</div>

        <div className="acc-list" id="acc-picker-list">
          {accounts.length === 0 ? (
            <div className="empty" style={{ padding: '20px 0' }}>
              <p style={{ fontSize: '13px' }}>لا توجد حسابات متاحة لك في هذا الملف الشخصي.</p>
            </div>
          ) : (
            accounts.map((acc) => (
              <div 
                key={acc.id}
                className="acc-item"
                onClick={() => handleSelectAccount(acc)}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div className={`acc-icon ${getAccountIconClass(acc.type)}`}>
                    {getAccountEmoji(acc.type)}
                  </div>
                  <div className="acc-info" style={{ minWidth: 0 }}>
                    <div 
                      className="acc-name" 
                      style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: 700
                      }}
                    >
                      {acc.name}
                    </div>
                    <div className="acc-type">{getAccountTypeLabel(acc.type)}</div>
                  </div>
                </div>

                {session.type === 'client' && (
                  <button 
                    className="btn-icon"
                    title="تعديل الاسم"
                    onClick={(e) => handleOpenRenameModal(e, acc)}
                    style={{ fontSize: '12px', padding: '4px 6px', border: 'none', background: 'rgba(99,102,241,0.05)', color: 'var(--primary)' }}
                  >
                    ✏️
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {session.type === 'client' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
            اضغط على أيقونة القلم ✏️ لتغيير اسم الحساب
          </div>
        )}
      </div>

      {/* Rename Account Modal */}
      <Modal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="تعديل اسم الحساب"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRenameModalOpen(false)}>إلغاء</button>
            <button className="btn btn-primary" onClick={handleRenameAccount}>حفظ التعديل</button>
          </>
        }
      >
        <div className="form-group">
          <label>اسم الحساب الجديد</label>
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
