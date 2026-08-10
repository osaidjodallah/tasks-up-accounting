import emailjs from '@emailjs/browser';
import { supabaseGet, supabaseSet } from './supabase';

const EMAILJS_DEFAULTS = {
  serviceId:  'service_rx6ond2',
  templateId: 'template_rrda9pk',
  publicKey:  'IMRFWSyOMFgmthprM',
  appUrl:     'https://tasks-up.com'
};

export async function getEmailJSConfig() {
  const s = localStorage.getItem('mkt_emailjs_config');
  if (s) return { ...EMAILJS_DEFAULTS, ...JSON.parse(s) };
  const remote = await supabaseGet('mkt_emailjs_config').catch(() => null);
  if (remote) {
    localStorage.setItem('mkt_emailjs_config', JSON.stringify(remote));
    return { ...EMAILJS_DEFAULTS, ...remote };
  }
  return EMAILJS_DEFAULTS;
}

export async function saveEmailJSConfig(cfg) {
  localStorage.setItem('mkt_emailjs_config', JSON.stringify(cfg));
  await supabaseSet('mkt_emailjs_config', cfg);
}

export async function sendTasksupEmail(toEmail, toName, messageBody, actionLink, actionText) {
  const cfg = await getEmailJSConfig();
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    console.warn('EmailJS not fully configured');
    return false;
  }
  try {
    await emailjs.send(
      cfg.serviceId,
      cfg.templateId,
      {
        to_email:     toEmail,
        user_name:    toName,
        message_body: messageBody,
        action_link:  actionLink,
        action_text:  actionText,
        app_name:     'Tasksup'
      },
      { publicKey: cfg.publicKey }
    );
    return true;
  } catch (e) {
    console.error('Email send failed:', e);
    return false;
  }
}

// Build a self-contained signed reset token: base64(email|expiry).signature
export async function buildResetToken(email, accountHash) {
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
  const payload = btoa(unescape(encodeURIComponent(email + '|' + expiry)));
  const sigInput = payload + accountHash + 'tasksup_reset_v1';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sigInput));
  const sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 24);
  return payload + '~' + sig;
}

export function getForgetPasswordAccount(email, authData) {
  if (!authData) return null;
  const em = email.toLowerCase().trim();
  if (authData.superAdmin?.email?.toLowerCase() === em) return authData.superAdmin;
  const client = (authData.clients || []).find(c => c.email.toLowerCase() === em);
  if (client) return client;
  for (const c of (authData.clients || [])) {
    const emp = (c.employees || []).find(e => e.email.toLowerCase() === em);
    if (emp) return emp;
  }
  return null;
}

export async function verifyResetToken(token) {
  try {
    const [payload, sig] = token.split('~');
    if (!payload || !sig) return null;
    const decoded = decodeURIComponent(escape(atob(payload)));
    const lastPipe = decoded.lastIndexOf('|');
    const email = decoded.slice(0, lastPipe).toLowerCase();
    const expiry = parseInt(decoded.slice(lastPipe + 1));
    if (!email || isNaN(expiry) || expiry < Date.now()) return null;
    
    // Fetch latest auth data
    const remote = await supabaseGet('mkt_auth_v2');
    const account = getForgetPasswordAccount(email, remote);
    if (!account) return null;
    
    const sigInput = payload + account.hash + 'tasksup_reset_v1';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sigInput));
    const expectedSig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 24);
    
    if (sig !== expectedSig) return null;
    return { email, account };
  } catch(e) {
    console.error('[Reset] Verify error:', e);
    return null;
  }
}
