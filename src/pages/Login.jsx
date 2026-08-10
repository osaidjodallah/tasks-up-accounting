import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildResetToken, sendTasksupEmail, getForgetPasswordAccount, getEmailJSConfig, verifyResetToken } from '../lib/email';
import Modal from '../components/Modal';

export default function Login() {
  const { login, applyRole, authData, saveAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot Password States
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpStatus, setFpStatus] = useState({ show: false, text: '', success: false });
  const [fpLoading, setFpLoading] = useState(false);

  // Reset Password Flow (from link)
  const [searchParams] = useSearchParams();
  const [newPasswordModalOpen, setNewPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [npLoading, setNpLoading] = useState(false);

  const navigate = useNavigate();

  // Check if password reset parameter is in URL
  useEffect(() => {
    const token = searchParams.get('reset');
    if (token) {
      handleResetToken(token);
    }
  }, [searchParams]);

  const handleResetToken = async (token) => {
    const result = await verifyResetToken(token);
    if (!result) {
      alert('رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.\nيرجى طلب رابط جديد.');
      return;
    }
    setResetEmail(result.email);
    setResetToken(token);
    setNewPasswordModalOpen(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await login(email, password);
      if (res.success) {
        if (res.roles.length === 1) {
          const redirect = await applyRole(res.roles[0]);
          navigate(redirect.route);
        } else {
          // Multiple roles → Navigate to role picker
          navigate('/role-picker', { state: { roles: res.roles, email } });
        }
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password request
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!fpEmail) {
      alert('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setFpLoading(true);
    setFpStatus({ show: false, text: '', success: false });

    try {
      const account = getForgetPasswordAccount(fpEmail, authData);
      if (!account) {
        setFpStatus({
          show: true,
          text: 'هذا البريد الإلكتروني غير مسجل في النظام',
          success: false
        });
        return;
      }

      const cfg = await getEmailJSConfig();
      const token = await buildResetToken(fpEmail, account.hash);
      const appUrl = cfg.appUrl || window.location.origin;
      const resetLink = `${appUrl}?reset=${token}`;

      const success = await sendTasksupEmail(
        fpEmail,
        account.name || fpEmail,
        'لقد طلبت إعادة تعيين كلمة المرور لحسابك في Tasksup. يرجى الضغط على الرابط أدناه للمتابعة. إذا لم تطلب ذلك، يمكنك تجاهل هذا الإيميل.',
        resetLink,
        'إعادة تعيين كلمة المرور'
      );

      if (success) {
        setFpStatus({
          show: true,
          text: `✓ تم إرسال رابط إعادة التعيين إلى ${fpEmail}. الرابط صالح لمدة ساعة واحدة.`,
          success: true
        });
      } else {
        setFpStatus({
          show: true,
          text: 'فشل إرسال الإيميل. تحقق من إعدادات EmailJS أو الاتصال بالإنترنت.',
          success: false
        });
      }
    } catch (err) {
      setFpStatus({
        show: true,
        text: 'حدث خطأ أثناء إرسال البريد الإلكتروني.',
        success: false
      });
    } finally {
      setFpLoading(false);
    }
  };

  // Save new password from token flow
  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 رموز على الأقل');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      alert('كلمتا المرور غير متطابقتين');
      return;
    }

    setNpLoading(true);

    try {
      // Find and update the user's password hash in the authData
      const auth = { ...authData };
      const em = resetEmail.toLowerCase().trim();
      let account = null;

      if (auth.superAdmin?.email?.toLowerCase() === em) {
        account = auth.superAdmin;
      }
      if (!account) {
        account = (auth.clients || []).find(c => c.email?.toLowerCase() === em);
      }
      if (!account) {
        for (const c of (auth.clients || [])) {
          const emp = (c.employees || []).find(e => e.email?.toLowerCase() === em);
          if (emp) {
            account = emp;
            break;
          }
        }
      }

      if (!account) {
        alert('حدث خطأ، المستخدم لم يعد موجوداً في النظام.');
        return;
      }

      // SHA-256 hashing to match AuthContext
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPassword + '_mkt_v2_salt'));
      const newHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

      account.hash = newHash;
      await saveAuth(auth);

      alert('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.');
      setNewPasswordModalOpen(false);
      navigate('/login');
    } catch (err) {
      alert('حدث خطأ أثناء حفظ كلمة المرور الجديدة');
    } finally {
      setNpLoading(false);
    }
  };

  return (
    <div id="login-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <img 
              src="/logo.png.png" 
              alt="Tasksup" 
              style={{ width: '90px', height: '90px', objectFit: 'contain' }}
              onError={(e) => { e.target.src = 'https://placehold.co/100'; }}
            />
          </div>
          <h1>Tasksup</h1>
          <p>إدارة الأعمال والمتاجر</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && <div className="auth-error show">{error}</div>}
          
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input 
              type="email" 
              placeholder="example@email.com" 
              dir="ltr" 
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>كلمة المرور</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              dir="ltr" 
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <button 
              type="button" 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              onClick={() => {
                setFpEmail('');
                setFpStatus({ show: false, text: '', success: false });
                setForgotModalOpen(true);
              }}
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          <button 
            type="submit" 
            className="btn-auth" 
            disabled={loading}
          >
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="استعادة كلمة المرور"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setForgotModalOpen(false)}>إلغاء</button>
            <button 
              className="btn btn-primary" 
              disabled={fpLoading} 
              onClick={handleForgotPassword}
            >
              {fpLoading ? 'جاري الإرسال...' : 'إرسال الرابط'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لتغيير كلمة المرور 📧
        </p>
        <div className="form-group">
          <label>البريد الإلكتروني</label>
          <input 
            type="email" 
            placeholder="example@email.com" 
            dir="ltr" 
            value={fpEmail}
            onChange={(e) => setFpEmail(e.target.value)}
            required
          />
        </div>
        {fpStatus.show && (
          <div 
            style={{ 
              display: 'block',
              background: fpStatus.success ? 'var(--success-light)' : 'var(--danger-light)',
              border: fpStatus.success ? '1px solid #6ee7b7' : '1px solid #fca5a5',
              color: fpStatus.success ? '#065f46' : '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginTop: '8px'
            }}
          >
            {fpStatus.text}
          </div>
        )}
      </Modal>

      {/* New Password Modal (from Link) */}
      <Modal
        isOpen={newPasswordModalOpen}
        onClose={() => setNewPasswordModalOpen(false)}
        title="تعيين كلمة مرور جديدة"
        footer={
          <button 
            className="btn btn-primary" 
            disabled={npLoading}
            onClick={handleSaveNewPassword}
          >
            {npLoading ? 'جاري الحفظ...' : 'حفظ وتسجيل الدخول'}
          </button>
        }
      >
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          تعيين كلمة مرور جديدة لـ: <strong>{resetEmail}</strong>
        </div>
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label>كلمة المرور الجديدة</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            dir="ltr"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>تأكيد كلمة المرور</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            dir="ltr"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
