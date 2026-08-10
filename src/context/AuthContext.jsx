import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseGet, supabaseSet } from '../lib/supabase';

const AuthContext = createContext(null);

// Default structure of the store/accounting DB for a client account
const getDefaultDB = () => ({
  clients: [],
  expenses: [],
  services: [],
  invoiceSettings: { nextNumber: 1, prefix: 'INV-', vatRate: 0, notes: '', signature: '' },
  store: { products: [], orders: [] },
  expenseCategories: [],
  storeCustomers: [],
  loyaltySettings: { pointsPerDollar: 10, redeemThreshold: 100 },
  clixOrders: []
});

// SHA-256 password hashing to match original implementation
async function hashPwd(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd + '_mkt_v2_salt'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [authData, setAuthData] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [db, setDb] = useState(getDefaultDB());
  const [loading, setLoading] = useState(true);

  // Load initial session on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const storedSess = sessionStorage.getItem('mkt_sess_v2') || localStorage.getItem('mkt_sess_v2');
        let initialSession = null;
        if (storedSess) {
          try {
            initialSession = JSON.parse(storedSess);
            setSessionState(initialSession);
          } catch (e) {
            console.warn('Error parsing stored session:', e);
          }
        }

        // Fetch auth data from supabase
        let currentAuth = null;
        const remoteAuth = await supabaseGet('mkt_auth_v2');
        if (remoteAuth) {
          currentAuth = remoteAuth;
          setAuthData(remoteAuth);
          localStorage.setItem('mkt_auth_v2', JSON.stringify(remoteAuth));
        } else {
          const localAuth = localStorage.getItem('mkt_auth_v2');
          if (localAuth) {
            currentAuth = JSON.parse(localAuth);
            setAuthData(currentAuth);
          }
        }

        // If session exists with currentAccountId, load the account data
        if (initialSession && initialSession.currentAccountId) {
          await loadAccountData(initialSession.currentAccountId, initialSession, currentAuth);
        }
      } catch (err) {
        console.error('Initialization error in AuthProvider:', err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  // Save session state helper
  const saveSession = (sess, rememberMe = true) => {
    setSessionState(sess);
    const sessStr = JSON.stringify(sess);
    sessionStorage.setItem('mkt_sess_v2', sessStr);
    if (rememberMe) {
      localStorage.setItem('mkt_sess_v2', sessStr);
    }
  };

  // Sync auth data from Supabase
  const syncAuth = async () => {
    const remote = await supabaseGet('mkt_auth_v2');
    if (remote) {
      setAuthData(remote);
      localStorage.setItem('mkt_auth_v2', JSON.stringify(remote));
      return remote;
    }
    return authData;
  };

  // Save auth data to Supabase and LocalStorage
  const saveAuth = async (newAuthData) => {
    setAuthData(newAuthData);
    localStorage.setItem('mkt_auth_v2', JSON.stringify(newAuthData));
    await supabaseSet('mkt_auth_v2', newAuthData);
  };

  // Load account data (mkt_data_<accountId>)
  const loadAccountData = async (accountId, activeSession, overrideAuth) => {
    if (!accountId) {
      setDb(getDefaultDB());
      setCurrentAccount(null);
      return;
    }

    const sess = activeSession || session;
    const auth = overrideAuth || authData || JSON.parse(localStorage.getItem('mkt_auth_v2') || '{}');
    
    // Find account info
    const client = auth?.clients?.find(c => c.id === sess?.clientId);
    const acc = client?.accounts?.find(a => a.id === accountId);
    setCurrentAccount(acc || null);

    // Read local cache first
    const saved = localStorage.getItem('mkt_data_' + accountId);
    let currentDB = getDefaultDB();
    if (saved) {
      try {
        currentDB = { ...currentDB, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Error parsing cached db:', e);
      }
    }

    setDb(currentDB);

    // Fetch fresh copy from Supabase
    try {
      const remote = await supabaseGet('mkt_data_' + accountId);
      if (remote) {
        const merged = {
          ...getDefaultDB(),
          ...remote,
          store: {
            products: remote.store?.products || [],
            orders: remote.store?.orders || []
          },
          clixOrders: remote.clixOrders || []
        };
        setDb(merged);
        localStorage.setItem('mkt_data_' + accountId, JSON.stringify(merged));
      }
    } catch (e) {
      console.warn('Supabase fetch for account data failed, using cached version:', e);
    }
  };

  // Save database modifications to LocalStorage & Supabase
  const saveDB = async (updatedDB) => {
    if (!session?.currentAccountId) return;
    setDb(updatedDB);
    localStorage.setItem('mkt_data_' + session.currentAccountId, JSON.stringify(updatedDB));
    await supabaseSet('mkt_data_' + session.currentAccountId, updatedDB);
  };

  // Handle Login
  const login = async (email, password) => {
    const freshAuth = await syncAuth();
    if (!freshAuth) {
      throw new Error('تعذر الاتصال بقاعدة البيانات. تأكد من اتصالك بالإنترنت وحاول مجدداً.');
    }

    const hash = await hashPwd(password);
    const lowerEmail = email.toLowerCase().trim();

    // 1. Super Admin
    if (lowerEmail === freshAuth.superAdmin?.email?.toLowerCase() && hash === freshAuth.superAdmin?.hash) {
      const superAdminSess = { type: 'superadmin', name: 'أسيد سامر', email: lowerEmail };
      saveSession(superAdminSess);
      return { success: true, roles: [{ type: 'superadmin' }] };
    }

    // 2. Collect all roles
    const roles = [];
    const asClient = (freshAuth.clients || []).find(c => c.email?.toLowerCase() === lowerEmail && c.hash === hash);
    if (asClient) {
      roles.push({ type: 'client', client: asClient });
    }

    for (const cl of (freshAuth.clients || [])) {
      const emp = (cl.employees || []).find(e => e.email?.toLowerCase() === lowerEmail && e.hash === hash);
      if (emp) {
        roles.push({ type: 'employee', client: cl, emp });
      }
    }

    if (roles.length === 0) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    return { success: true, roles };
  };

  // Apply chosen role
  const applyRole = async (role) => {
    if (role.type === 'superadmin') {
      const superSess = { type: 'superadmin', name: 'أسيد سامر', email: authData?.superAdmin?.email };
      saveSession(superSess);
      setCurrentAccount(null);
      return { route: '/superadmin' };
    }

    if (role.type === 'client') {
      const newSess = {
        type: 'client',
        clientId: role.client.id,
        name: role.client.name,
        email: role.client.email,
        currentAccountId: null
      };
      saveSession(newSess);
      setCurrentAccount(null);
      return { route: '/select-account' };
    } else {
      // Employee role
      const accessibleAccounts = role.client.accounts.filter(a => role.emp.permissions?.[a.id]?.access);
      const firstAcc = accessibleAccounts[0];
      const newSess = {
        type: 'employee',
        clientId: role.client.id,
        userId: role.emp.id,
        name: role.emp.name,
        email: role.emp.email,
        currentAccountId: firstAcc?.id || null
      };
      saveSession(newSess);
      if (firstAcc) {
        await loadAccountData(firstAcc.id, newSess);
        return { route: firstAcc.type === 'store' ? '/store' : firstAcc.type === 'clix' ? '/clix' : '/dashboard' };
      } else {
        return { route: '/select-account' };
      }
    }
  };

  // Select current active account
  const selectAccount = async (accountId) => {
    if (!session) return;
    const updatedSess = { ...session, currentAccountId: accountId };
    saveSession(updatedSess);
    await loadAccountData(accountId, updatedSess);
  };

  // Helper to check employee permissions
  const getPermission = (page) => {
    if (!session) return false;
    if (session.type === 'client' || session.type === 'superadmin') return 'manage';
    if (session.type === 'employee') {
      const auth = authData || JSON.parse(localStorage.getItem('mkt_auth_v2') || '{}');
      const client = auth?.clients?.find(c => c.id === session.clientId);
      const emp = client?.employees?.find(e => e.id === session.userId);
      const perms = emp?.permissions?.[session.currentAccountId];
      if (!perms) return false;
      return perms[page] || false;
    }
    return false;
  };

  const canView = (page) => {
    const p = getPermission(page);
    return p === 'view' || p === 'manage';
  };

  const canManage = (page) => {
    return getPermission(page) === 'manage';
  };

  const logout = () => {
    setSessionState(null);
    setDb(getDefaultDB());
    setCurrentAccount(null);
    sessionStorage.removeItem('mkt_sess_v2');
    localStorage.removeItem('mkt_sess_v2');
  };

  return (
    <AuthContext.Provider value={{
      session,
      authData,
      currentAccount,
      db,
      loading,
      login,
      applyRole,
      selectAccount,
      logout,
      saveDB,
      saveAuth,
      syncAuth,
      getPermission,
      canView,
      canManage
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
