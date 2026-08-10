import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEmailJSConfig, saveEmailJSConfig, sendTasksupEmail } from '../lib/email';
import Modal from '../components/Modal';

// Password hashing function to match system hashing
async function hashPwd(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd + '_mkt_v2_salt'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default function SuperAdmin() {
  const { session, authData, saveAuth, syncAuth, logout } = useAuth();
  const navigate = useNavigate();

  // Stats states
  const [stats, setStats] = useState({ clientsCount: 0, totalAccounts: 0, totalEmployees: 0 });
  const [clients, setClients] = useState([]);
  
  // Modals States
  const [emailConfigModal, setEmailConfigModal] = useState(false);
  const [createClientModal, setCreateClientModal] = useState(false);
  const [editClientModal, setEditClientModal] = useState(false);

  // Email Config Fields
  const [ejsConfig, setEjsConfig] = useState({ serviceId: '', templateId: '', publicKey: '', appUrl: '' });

  // Create Client Fields
  const [ccName, setCcName] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [ccPassword, setCcPassword] = useState('');
  const [ccStores, setCcStores] = useState(0);
  const [ccServices, setCcServices] = useState(1);
  const [ccClix, setCcClix] = useState(0);
  const [ccNote, setCcNote] = useState('');
  const [ccLoading, setCcLoading] = useState(false);

  // Edit Client Fields
  const [editingClient, setEditingClient] = useState(null);
  const [ecName, setEcName] = useState('');
  const [ecEmail, setEcEmail] = useState('');
  const [ecPassword, setEcPassword] = useState('');
  const [ecStores, setEcStores] = useState(0);
  const [ecServices, setEcServices] = useState(1);
  const [ecClix, setEcClix] = useState(0);
  const [ecNote, setEcNote] = useState('');
  const [ecLoading, setEcLoading] = useState(false);

  // Sync and render SA panel
  useEffect(() => {
    if (!session || session.type !== 'superadmin') {
      navigate('/login');
      return;
    }
    
    async function loadSAPanelData() {
      const auth = await syncAuth();
      if (auth) {
        const clientList = auth.clients || [];
        setClients(clientList);
        const accountsCount = clientList.reduce((sum, c) => sum + (c.accounts || []).length, 0);
        const employeesCount = clientList.reduce((sum, c) => sum + (c.employees || []).length, 0);
        setStats({
          clientsCount: clientList.length,
          totalAccounts: accountsCount,
          totalEmployees: employeesCount
        });
      }
    }
    loadSAPanelData();
  }, [session, navigate]);

  // Handle open email JS config
  const handleOpenEmailJS = async () => {
    const cfg = await getEmailJSConfig();
    setEjsConfig({
      serviceId: cfg.serviceId || '',
      templateId: cfg.templateId || '',
      publicKey: cfg.publicKey || '',
      appUrl: cfg.appUrl || window.location.origin
    });
    setEmailConfigModal(true);
  };

  // Handle save email JS config
  const handleSaveEmailJS = async (e) => {
    e.preventDefault();
    await saveEmailJSConfig(ejsConfig);
    setEmailConfigModal(false);
    alert('تم حفظ إعدادات الإيميل');
  };

  // Handle create client
  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!ccName || !ccEmail || !ccPassword) {
      alert('أدخل الاسم والإيميل وكلمة المرور');
      return;
    }
    if (ccStores + ccServices + ccClix === 0) {
      alert('حدد على الأقل حساباً واحداً (متجر أو خدمات أو Clix)');
      return;
    }

    setCcLoading(true);

    try {
      const auth = await syncAuth();
      const exists = (auth.clients || []).find(c => c.email.toLowerCase() === ccEmail.toLowerCase().trim());
      if (exists) {
        alert('هذا البريد الإلكتروني موجود مسبقاً');
        setCcLoading(false);
        return;
      }

      const hash = await hashPwd(ccPassword);
      const clientId = 'cl_' + Date.now();
      const accounts = [];

      for (let i = 0; i < ccStores; i++) {
        accounts.push({
          id: `acc_${Date.now()}_${i}s`,
          type: 'store',
          name: ccStores === 1 ? 'متجري' : `متجر ${i + 1}`,
          createdAt: new Date().toISOString()
        });
      }
      for (let i = 0; i < ccServices; i++) {
        accounts.push({
          id: `acc_${Date.now()}_${i}v`,
          type: 'services',
          name: ccServices === 1 ? 'حساب الخدمات' : `خدمات ${i + 1}`,
          createdAt: new Date().toISOString()
        });
      }
      for (let i = 0; i < ccClix; i++) {
        accounts.push({
          id: `acc_${Date.now()}_${i}c`,
          type: 'clix',
          name: ccClix === 1 ? 'Clix' : `Clix ${i + 1}`,
          createdAt: new Date().toISOString()
        });
      }

      const client = {
        id: clientId,
        name: ccName.trim(),
        email: ccEmail.trim().toLowerCase(),
        hash,
        allowance: { stores: ccStores, services: ccServices, clix: ccClix },
        accounts,
        employees: [],
        note: ccNote.trim(),
        features: { whatsapp: false },
        createdAt: new Date().toISOString()
      };

      if (!auth.clients) auth.clients = [];
      auth.clients.push(client);
      await saveAuth(auth);

      // Send onboarding email
      const cfg = await getEmailJSConfig();
      sendTasksupEmail(
        client.email,
        client.name,
        `أهلاً بك في Tasksup لإدارة المحاسبة والمتاجر! تم تفعيل اشتراكك بنجاح. نوع الحساب: ${ccStores} متجر و ${ccServices} خدمات. يمكنك الدخول الآن باستخدام بريدك الإلكتروني وكلمة المرور الخاصة بك.`,
        cfg.appUrl || window.location.origin,
        'دخول النظام'
      ).catch(e => console.warn('Failed to send onboarding email:', e));

      // Reset fields
      setCcName('');
      setCcEmail('');
      setCcPassword('');
      setCcStores(0);
      setCcServices(1);
      setCcClix(0);
      setCcNote('');
      setCreateClientModal(false);

      // Reload list
      const clientList = auth.clients || [];
      setClients(clientList);
      setStats({
        clientsCount: clientList.length,
        totalAccounts: clientList.reduce((sum, c) => sum + (c.accounts || []).length, 0),
        totalEmployees: clientList.reduce((sum, c) => sum + (c.employees || []).length, 0)
      });

      alert('تم إنشاء الحساب بنجاح وإرسال إيميل الترحيب');
    } catch (err) {
      alert('حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setCcLoading(false);
    }
  };

  // Open Edit Client Modal
  const handleOpenEditClient = (client) => {
    setEditingClient(client);
    setEcName(client.name);
    setEcEmail(client.email);
    setEcPassword('');
    setEcStores(client.allowance?.stores ?? 0);
    setEcServices(client.allowance?.services ?? 0);
    setEcClix(client.allowance?.clix ?? 0);
    setEcNote(client.note || '');
    setEditClientModal(true);
  };

  // Save edit client
  const handleSaveEditClient = async (e) => {
    e.preventDefault();
    if (!ecName || !ecEmail) {
      alert('الاسم والإيميل مطلوبان');
      return;
    }

    setEcLoading(true);

    try {
      const auth = { ...authData };
      const c = auth.clients.find(x => x.id === editingClient.id);
      if (!c) {
        setEcLoading(false);
        return;
      }

      c.name = ecName.trim();
      c.email = ecEmail.trim().toLowerCase();
      c.note = ecNote.trim();

      if (ecPassword) {
        c.hash = await hashPwd(ecPassword);
      }

      // Adjust account slots
      const curStores = c.accounts.filter(a => a.type === 'store');
      const curSvcs = c.accounts.filter(a => a.type === 'services');
      const curClix = c.accounts.filter(a => a.type === 'clix');

      const addStores = ecStores - curStores.length;
      const addSvcs = ecServices - curSvcs.length;
      const addClix = ecClix - curClix.length;

      // Add slots
      for (let i = 0; i < addStores; i++) {
        c.accounts.push({
          id: `acc_${Date.now()}_${i}s`,
          type: 'store',
          name: `متجر ${curStores.length + i + 1}`,
          createdAt: new Date().toISOString()
        });
      }
      for (let i = 0; i < addSvcs; i++) {
        c.accounts.push({
          id: `acc_${Date.now()}_${i}v`,
          type: 'services',
          name: `خدمات ${curSvcs.length + i + 1}`,
          createdAt: new Date().toISOString()
        });
      }
      for (let i = 0; i < addClix; i++) {
        c.accounts.push({
          id: `acc_${Date.now()}_${i}c`,
          type: 'clix',
          name: curClix.length + i === 0 ? 'Clix' : `Clix ${curClix.length + i + 1}`,
          createdAt: new Date().toISOString()
        });
      }

      // Remove excess (from end)
      if (addStores < 0) {
        let rem = Math.abs(addStores);
        while (rem-- > 0) {
          const last = c.accounts.filter(a => a.type === 'store').pop();
          if (last) c.accounts = c.accounts.filter(a => a.id !== last.id);
        }
      }
      if (addSvcs < 0) {
        let rem = Math.abs(addSvcs);
        while (rem-- > 0) {
          const last = c.accounts.filter(a => a.type === 'services').pop();
          if (last) c.accounts = c.accounts.filter(a => a.id !== last.id);
        }
      }
      if (addClix < 0) {
        let rem = Math.abs(addClix);
        while (rem-- > 0) {
          const last = c.accounts.filter(a => a.type === 'clix').pop();
          if (last) c.accounts = c.accounts.filter(a => a.id !== last.id);
        }
      }

      c.allowance = { stores: ecStores, services: ecServices, clix: ecClix };
      await saveAuth(auth);
      setEditClientModal(false);

      // Reload list
      setClients(auth.clients || []);
      alert('تم تحديث بيانات العميل بنجاح');
    } catch (err) {
      alert('حدث خطأ أثناء تعديل الحساب');
    } finally {
      setEcLoading(false);
    }
  };

  // Delete Client Account
  const handleDeleteClient = async () => {
    if (!confirm(`تحذير! حذف حساب "${editingClient.name}" وجميع بياناته ومتاجره وقواعد بياناته نهائياً؟`)) {
      return;
    }

    try {
      const auth = { ...authData };
      const c = auth.clients.find(x => x.id === editingClient.id);
      if (c) {
        // Clear all local mkt_data caches
        (c.accounts || []).forEach(a => localStorage.removeItem('mkt_data_' + a.id));
        auth.clients = auth.clients.filter(x => x.id !== editingClient.id);
        await saveAuth(auth);
        setEditClientModal(false);
        setClients(auth.clients || []);
        alert('تم حذف الحساب بالكامل');
      }
    } catch (err) {
      alert('حدث خطأ أثناء حذف الحساب');
    }
  };

  // Toggle WhatsApp Feature for Client
  const handleToggleWhatsApp = async (client) => {
    try {
      const auth = { ...authData };
      const c = auth.clients.find(x => x.id === client.id);
      if (c) {
        if (!c.features) c.features = {};
        c.features.whatsapp = !c.features.whatsapp;
        await saveAuth(auth);
        setClients(auth.clients || []);
      }
    } catch (err) {
      alert('حدث خطأ أثناء تبديل ميزة الواتساب');
    }
  };

  // Impersonate / Login As Client for preview
  const handleLoginAsClient = (client) => {
    // Store impersonation session in sessionStorage
    const sess = {
      type: 'client',
      clientId: client.id,
      name: client.name,
      email: client.email,
      currentAccountId: null,
      superAdminMode: true
    };
    sessionStorage.setItem('mkt_sess_v2', JSON.stringify(sess));
    // Trigger window location reload or context update
    window.location.href = '/select-account';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', width: '100%', paddingBottom: '40px' }}>
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ color: 'white' }}>
          <div style={{ fontSize: '18px', fontWeight: 800 }}>⚡ لوحة الإدارة العليا</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>أسيد سامر — Super Admin</div>
        </div>
        <button 
          className="btn btn-sm" 
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
          onClick={handleLogout}
        >
          تسجيل خروج
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{stats.clientsCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>حسابات عملاء مُنشأة</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)' }}>{stats.totalAccounts}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>إجمالي المتاجر والحسابات</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)' }}>{stats.totalEmployees}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>إجمالي الموظفين</div>
          </div>
        </div>

        {/* EmailJS Settings */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>📧 إعدادات إرسال البريد الإلكتروني (EmailJS)</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>مطلوبة لميزة استعادة كلمة المرور وإرسال الترحيب للعملاء</div>
          </div>
          <button className="btn btn-outline" onClick={handleOpenEmailJS}>⚙️ إعداد EmailJS</button>
        </div>

        {/* WhatsApp Setup Guide Details */}
        <details style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
          <summary style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 700, color: '#166534', listStyle: 'none', userSelect: 'none' }}>
            <span style={{ fontSize: '20px' }}>📱</span>
            <span>كيف تفعل ميزة البث عبر الواتساب لأي عميل؟</span>
            <span style={{ marginRight: 'auto', fontSize: '11px', fontWeight: 500, color: '#16a34a', background: '#dcfce7', padding: '2px 10px', borderRadius: '99px' }}>دليل الإعداد</span>
          </summary>
          <div style={{ padding: '0 18px 18px', borderTop: '1px solid #bbf7d0' }}>
            <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
                <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ fontSize: '12px' }}>
                  <strong style={{ display: 'block', color: '#166534', marginBottom: '2px' }}>فعّل الميزة للعميل في الأسفل</strong>
                  اضغط على زر 📱 واتساب ❌ للعميل المطلوب ليتحول إلى واتساب ✅. سيظهر للعميل بعد ذلك قسم الواتساب في قائمته الجانبية.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
                <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: '12px' }}>
                  <strong style={{ display: 'block', color: '#166534', marginBottom: '2px' }}>التسجيل في UltraMsg</strong>
                  يجب على العميل إنشاء حساب على ultramsg.com، والحصول على Instance ID و Token ومسح الـ QR Code بهاتفه لربط رقمه.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
                <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                <div style={{ fontSize: '12px' }}>
                  <strong style={{ display: 'block', color: '#166534', marginBottom: '2px' }}>إدخال البيانات في إعدادات العميل</strong>
                  يقوم العميل بنسخ الـ Instance ID والـ Token وإدخالهما في قسم الإعدادات داخل حسابه في Tasksup.
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* Clients list section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>الحسابات المُنشأة</h2>
          <button className="btn btn-primary" onClick={() => setCreateClientModal(true)}>＋ إنشاء حساب جديد</button>
        </div>

        <div id="sa-clients-list" style={{ display: 'grid', gap: '10px' }}>
          {clients.length === 0 ? (
            <div className="empty">
              <div className="icon">👥</div>
              <h4>لا توجد حسابات بعد</h4>
              <p>أنشئ أول حساب عميل للمتابعة</p>
            </div>
          ) : (
            clients.map((c) => {
              const stores = (c.accounts || []).filter(a => a.type === 'store').length;
              const svcs = (c.accounts || []).filter(a => a.type === 'services').length;
              const clix = (c.accounts || []).filter(a => a.type === 'clix').length;
              const employees = c.employees || [];

              return (
                <div 
                  key={c.id} 
                  style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                      {c.name ? c.name[0].toUpperCase() : '؟'}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {c.email} • {stores} متجر • {svcs} خدمات {clix > 0 && `• ${clix} Clix`} • {employees.length} موظفين
                      </div>
                      {c.note && <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '2px' }}>📝 {c.note}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button 
                      className={`wa-toggle-btn ${c.features?.whatsapp ? 'wa-toggle-on' : 'wa-toggle-off'}`} 
                      onClick={() => handleToggleWhatsApp(c)}
                    >
                      📱 {c.features?.whatsapp ? 'واتساب ✅' : 'واتساب ❌'}
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleOpenEditClient(c)}>✏️ تعديل</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleLoginAsClient(c)}>👁 دخول</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* EmailJS Configuration Modal */}
      <Modal
        isOpen={emailConfigModal}
        onClose={() => setEmailConfigModal(false)}
        title="إعدادات إرسال الإيميلات (EmailJS)"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEmailConfigModal(false)}>إلغاء</button>
            <button className="btn btn-primary" onClick={handleSaveEmailJS}>حفظ الإعدادات</button>
          </>
        }
      >
        <form onSubmit={handleSaveEmailJS} className="form-grid">
          <div className="form-group">
            <label>Service ID</label>
            <input 
              type="text" 
              value={ejsConfig.serviceId} 
              onChange={e => setEjsConfig({ ...ejsConfig, serviceId: e.target.value })} 
              placeholder="e.g. service_xxxxxx"
              dir="ltr"
              required
            />
          </div>
          <div className="form-group">
            <label>Template ID</label>
            <input 
              type="text" 
              value={ejsConfig.templateId} 
              onChange={e => setEjsConfig({ ...ejsConfig, templateId: e.target.value })} 
              placeholder="e.g. template_xxxxxx"
              dir="ltr"
              required
            />
          </div>
          <div className="form-group">
            <label>Public Key (API Key)</label>
            <input 
              type="text" 
              value={ejsConfig.publicKey} 
              onChange={e => setEjsConfig({ ...ejsConfig, publicKey: e.target.value })} 
              placeholder="e.g. xxxxxxxxxxxxxxxxx"
              dir="ltr"
              required
            />
          </div>
          <div className="form-group">
            <label>رابط التطبيق الرئيسي (لروابط الاسترجاع)</label>
            <input 
              type="text" 
              value={ejsConfig.appUrl} 
              onChange={e => setEjsConfig({ ...ejsConfig, appUrl: e.target.value })} 
              placeholder="e.g. https://tasks-up.com"
              dir="ltr"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Create Client Modal */}
      <Modal
        isOpen={createClientModal}
        onClose={() => setCreateClientModal(false)}
        title="إنشاء حساب عميل جديد"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateClientModal(false)}>إلغاء</button>
            <button className="btn btn-primary" disabled={ccLoading} onClick={handleCreateClient}>
              {ccLoading ? 'جاري الحفظ...' : 'إنشاء الحساب'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateClient} className="form-grid">
          <div className="form-group">
            <label>اسم العميل / الشركة</label>
            <input 
              type="text" 
              value={ccName} 
              onChange={e => setCcName(e.target.value)} 
              placeholder="الاسم الكامل"
              required 
            />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني للعميل</label>
            <input 
              type="email" 
              value={ccEmail} 
              onChange={e => setCcEmail(e.target.value)} 
              placeholder="example@email.com" 
              dir="ltr"
              required 
            />
          </div>
          <div className="form-group">
            <label>كلمة المرور الابتدائية</label>
            <input 
              type="text" 
              value={ccPassword} 
              onChange={e => setCcPassword(e.target.value)} 
              placeholder="••••••••" 
              dir="ltr"
              required 
            />
          </div>
          <div className="form-grid-3">
            <div className="form-group">
              <label>عدد حسابات الخدمات</label>
              <input 
                type="number" 
                min="0" 
                value={ccServices} 
                onChange={e => setCcServices(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="form-group">
              <label>عدد حسابات المتاجر</label>
              <input 
                type="number" 
                min="0" 
                value={ccStores} 
                onChange={e => setCcStores(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="form-group">
              <label>عدد حسابات Clix</label>
              <input 
                type="number" 
                min="0" 
                value={ccClix} 
                onChange={e => setCcClix(parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>
          <div className="form-group">
            <label>ملاحظة عامة</label>
            <textarea 
              rows="3" 
              value={ccNote} 
              onChange={e => setCcNote(e.target.value)} 
              placeholder="أي ملاحظات حول هذا الاشتراك..."
            />
          </div>
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={editClientModal}
        onClose={() => setEditClientModal(false)}
        title="تعديل حساب العميل"
        footer={
          <>
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={handleDeleteClient}>
              حذف الحساب نهائياً 🗑
            </button>
            <button className="btn btn-outline" onClick={() => setEditClientModal(false)}>إلغاء</button>
            <button className="btn btn-primary" disabled={ecLoading} onClick={handleSaveEditClient}>
              {ecLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveEditClient} className="form-grid">
          <div className="form-group">
            <label>اسم العميل / الشركة</label>
            <input 
              type="text" 
              value={ecName} 
              onChange={e => setEcName(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني للعميل</label>
            <input 
              type="email" 
              value={ecEmail} 
              onChange={e => setEcEmail(e.target.value)} 
              dir="ltr"
              required 
            />
          </div>
          <div className="form-group">
            <label>تغيير كلمة المرور (اتركه فارغاً لعدم التعديل)</label>
            <input 
              type="text" 
              value={ecPassword} 
              onChange={e => setEcPassword(e.target.value)} 
              placeholder="اكتب كلمة مرور جديدة لتعديلها" 
              dir="ltr"
            />
          </div>
          <div className="form-grid-3">
            <div className="form-group">
              <label>عدد حسابات الخدمات</label>
              <input 
                type="number" 
                min="0" 
                value={ecServices} 
                onChange={e => setEcServices(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="form-group">
              <label>عدد حسابات المتاجر</label>
              <input 
                type="number" 
                min="0" 
                value={ecStores} 
                onChange={e => setEcStores(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="form-group">
              <label>عدد حسابات Clix</label>
              <input 
                type="number" 
                min="0" 
                value={ecClix} 
                onChange={e => setEcClix(parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>
          <div className="form-group">
            <label>ملاحظة عامة</label>
            <textarea 
              rows="3" 
              value={ecNote} 
              onChange={e => setEcNote(e.target.value)} 
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
