import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';

// Core Pages
import Login from './pages/Login';
import RolePicker from './pages/RolePicker';
import AccountPicker from './pages/AccountPicker';
import SuperAdmin from './pages/SuperAdmin';

// Placeholder Pages (To be implemented in detail next)
const Dashboard = () => <div><h2>لوحة تحكم الخدمات والمحاسبة</h2><p>تحت التطوير...</p></div>;
const Clients = () => <div><h2>إدارة العملاء والمشتركين</h2><p>تحت التطوير...</p></div>;
const PaymentsDue = () => <div><h2>الدفعات المستحقة</h2><p>تحت التطوير...</p></div>;
const Expenses = () => <div><h2>المصاريف العامة</h2><p>تحت التطوير...</p></div>;
const Services = () => <div><h2>الخدمات والأسعار</h2><p>تحت التطوير...</p></div>;
const Invoices = () => <div><h2>مصمم الفواتير PDF</h2><p>تحت التطوير...</p></div>;
const Settings = () => <div><h2>إعدادات الحساب</h2><p>تحت التطوير...</p></div>;

// Store Pages Placeholders
const StoreDashboard = () => <div><h2>لوحة تحكم المتجر الإلكتروني</h2><p>تحت التطوير...</p></div>;
const StoreOrders = () => <div><h2>سجل طلبات المتجر</h2><p>تحت التطوير...</p></div>;
const StoreProducts = () => <div><h2>المنتجات والمستودع</h2><p>تحت التطوير...</p></div>;
const StoreProfit = () => <div><h2>الأرباح والمصاريف</h2><p>تحت التطوير...</p></div>;
const StoreLoyalty = () => <div><h2>برنامج النقاط والولاء</h2><p>تحت التطوير...</p></div>;
const StoreWhatsApp = () => <div><h2>إرسال واتساب مجمّع</h2><p>تحت التطوير...</p></div>;

// Clix Pages Placeholders
const ClixOrders = () => <div><h2>طلبات كروت Clix</h2><p>تحت التطوير...</p></div>;

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/role-picker" element={<RolePicker />} />
            <Route path="/select-account" element={<AccountPicker />} />
            <Route path="/superadmin" element={<SuperAdmin />} />

            {/* Accounting Subsystem Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/payments-due" element={<PaymentsDue />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/services" element={<Services />} />
            <Route path="/invoices" element={<Invoices />} />

            {/* Store Subsystem Routes */}
            <Route path="/store" element={<StoreDashboard />} />
            <Route path="/store/orders" element={<StoreOrders />} />
            <Route path="/store/products" element={<StoreProducts />} />
            <Route path="/store/profit" element={<StoreProfit />} />
            <Route path="/store/loyalty" element={<StoreLoyalty />} />
            <Route path="/store/whatsapp" element={<StoreWhatsApp />} />

            {/* Clix Subsystem Routes */}
            <Route path="/clix" element={<ClixOrders />} />

            {/* Settings & General */}
            <Route path="/settings" element={<Settings />} />

            {/* Fallback to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
