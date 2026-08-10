import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmailJSConfig } from '../lib/email';
import Modal from '../components/Modal';

export default function Dashboard() {
  const { db, saveDB, currentAccount } = useAuth();
  const [stats, setStats] = useState({ monthRevenue: 0, totalRevenue: 0, totalExpenses: 0, overdueCount: 0 });
  const [urgentClients, setUrgentClients] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [upcomingPreview, setUpcomingPreview] = useState([]);
  
  // WhatsApp Modal States
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waClient, setWaClient] = useState(null);
  const [waMessage, setWaMessage] = useState('');
  
  // Revenue Analysis States
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisFrom, setAnalysisFrom] = useState('');
  const [analysisTo, setAnalysisTo] = useState('');
  const [analysisScope, setAnalysisScope] = useState('all'); // 'all' or 'specific'
  const [selectedClients, setSelectedClients] = useState([]); // client IDs
  const [analysisResult, setAnalysisResult] = useState(null);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Load and calculate dashboard statistics
  useEffect(() => {
    if (!db) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    // 1. Stats calculations
    const allPayments = (db.clients || []).flatMap(c => (c.payments || []).map(p => ({ ...p, clientId: c.id, clientName: c.name })));
    const monthPayments = allPayments.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const monthRev = monthPayments.reduce((s, p) => s + p.amount, 0);
    const totalRev = allPayments.reduce((s, p) => s + p.amount, 0);
    const totalExp = (db.expenses || []).reduce((s, e) => s + e.amount, 0);

    const overdue = (db.clients || []).filter(c => {
      if (!c.dueDate) return false;
      const due = new Date(c.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;

    setStats({
      monthRevenue: monthRev,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      overdueCount: overdue
    });

    // 2. Urgent Alerts (overdue or due today)
    const urgent = (db.clients || []).filter(c => {
      if (!c.dueDate) return false;
      const due = new Date(c.dueDate);
      due.setHours(0, 0, 0, 0);
      return Math.ceil((due - today) / (1000 * 60 * 60 * 24)) <= 0;
    });
    setUrgentClients(urgent);

    // 3. Recent Payments (sorted descending)
    const sortedPayments = [...allPayments]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
    setRecentPayments(sortedPayments);

    // 4. Upcoming Preview (sorted ascending by days left)
    const upcoming = (db.clients || [])
      .filter(c => c.dueDate)
      .map(c => {
        const due = new Date(c.dueDate);
        due.setHours(0, 0, 0, 0);
        return {
          ...c,
          days: Math.ceil((due - today) / (1000 * 60 * 60 * 24))
        };
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
    setUpcomingPreview(upcoming);

    // Set default dates for analysis
    const firstOfMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    setAnalysisFrom(firstOfMonthStr);
    setAnalysisTo(todayStr);

  }, [db]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-JO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Open WhatsApp Modal
  const openWAReminder = (client, type) => {
    setWaClient(client);
    let msg = '';
    if (type === 'due') {
      const amount = client.amount ? `${client.amount.toLocaleString()} ${client.currency}` : 'الدفعة المستحقة';
      const dueDate = client.dueDate ? formatDate(client.dueDate) : 'قريباً';
      msg = `السلام عليكم ${client.name} 😊\n\nنود تذكيركم بأن دفعة ${client.service || 'الخدمة'} بقيمة ${amount} مستحقة بتاريخ ${dueDate}.\n\nشكراً لتعاملكم معنا 🙏`;
    } else {
      const amount = client.amount ? `${client.amount.toLocaleString()} ${client.currency}` : '';
      msg = `السلام عليكم ${client.name} 😊\n\n${amount ? 'تذكير بدفعة ' + (client.service || '') + ' بقيمة ' + amount + '.' : 'تواصلنا معك بخصوص حسابك.'}\n\nشكراً 🙏`;
    }
    setWaMessage(msg);
    setWaModalOpen(true);
  };

  // Send WhatsApp reminder
  const sendWAReminder = () => {
    if (!waClient) return;
    const phone = waClient.phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setWaModalOpen(false);
  };

  // Set predefined date ranges for Analysis
  const handleSetAnalysisRange = (range) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let from;

    if (range === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (range === 'quarter') {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      from = d.toISOString().split('T')[0];
    } else if (range === 'year') {
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else {
      // all time
      const allPayDates = (db.clients || []).flatMap(c => (c.payments || []).map(p => p.date)).sort();
      from = allPayDates[0] || new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    setAnalysisFrom(from);
    setAnalysisTo(todayStr);
  };

  // Run Revenue Analysis calculations
  const runRevenueAnalysis = () => {
    if (!analysisFrom || !analysisTo) {
      alert('حدد الفترة الزمنية');
      return;
    }
    if (analysisFrom > analysisTo) {
      alert('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    const allScopeSelected = analysisScope === 'all';
    const activeClientSet = new Set(selectedClients);

    if (!allScopeSelected && activeClientSet.size === 0) {
      alert('اختر عميلاً واحداً على الأقل');
      return;
    }

    const matchedPayments = [];
    (db.clients || []).forEach(c => {
      if (!allScopeSelected && !activeClientSet.has(c.id)) return;
      (c.payments || []).forEach(p => {
        if (p.date >= analysisFrom && p.date <= analysisTo) {
          matchedPayments.push({ ...p, clientId: c.id, clientName: c.name });
        }
      });
    });

    matchedPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Summary calculations
    const total = matchedPayments.reduce((s, p) => s + p.amount, 0);
    const payCount = matchedPayments.length;
    const uniqueClientCount = new Set(matchedPayments.map(r => r.clientId)).size;
    const average = payCount ? Math.round(total / payCount) : 0;

    // Breakdown by client
    const byClient = {};
    matchedPayments.forEach(r => {
      byClient[r.clientName] = (byClient[r.clientName] || 0) + r.amount;
    });
    const clientEntries = Object.entries(byClient).sort((a, b) => b[1] - a[1]);
    const maxClientValue = clientEntries[0]?.[1] || 1;

    // Breakdown by service
    const byService = {};
    matchedPayments.forEach(r => {
      const serviceName = r.service || 'غير محدد';
      byService[serviceName] = (byService[serviceName] || 0) + r.amount;
    });
    const svcEntries = Object.entries(byService).sort((a, b) => b[1] - a[1]);
    const maxSvcValue = svcEntries[0]?.[1] || 1;

    // Breakdown by currency
    const byCurrency = {};
    matchedPayments.forEach(r => {
      byCurrency[r.currency] = (byCurrency[r.currency] || 0) + r.amount;
    });

    setAnalysisResult({
      payments: matchedPayments,
      total,
      payCount,
      clientCount: uniqueClientCount,
      average,
      clientBreakdown: clientEntries.map(([name, val]) => ({ name, val, percentage: (val / maxClientValue * 100).toFixed(1) })),
      serviceBreakdown: svcEntries.map(([name, val]) => ({ name, val, percentage: (val / maxSvcValue * 100).toFixed(1) })),
      currencyBreakdown: Object.entries(byCurrency).sort((a, b) => b[1] - a[1])
    });
  };

  const handleClientScopeChange = (e) => {
    setAnalysisScope(e.target.value);
    if (e.target.value === 'specific' && selectedClients.length === 0) {
      // Default select all
      setSelectedClients((db.clients || []).map(c => c.id));
    }
  };

  const handleClientCheckboxChange = (clientId) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSelectAllClients = (state) => {
    if (state) {
      setSelectedClients((db.clients || []).map(c => c.id));
    } else {
      setSelectedClients([]);
    }
  };

  return (
    <div className="page active" id="page-dashboard">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1>لوحة تحكم الخدمات والمحاسبة</h1>
          <p id="dashboard-date" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ar-JO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => {
            setAnalysisOpen(!analysisOpen);
            if (!analysisOpen) setTimeout(runRevenueAnalysis, 50);
          }}
        >
          {analysisOpen ? '▲ إخفاء التحليل المالي' : '▼ عرض التحليل المالي'}
        </button>
      </div>

      {/* Urgent Alerts Banner */}
      {urgentClients.length > 0 && (
        <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            ⚠️ لديك <strong>{urgentClients.length}</strong> دفعة متأخرة أو مستحقة اليوم: {urgentClients.map(c => c.name).join('، ')}
          </div>
          <button 
            className="btn btn-sm btn-primary"
            style={{ background: 'var(--warning)', color: 'white' }}
            onClick={() => window.location.hash = '#/payments-due'}
          >
            عرض التفاصيل
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-green">
          <div className="label">إيرادات هذا الشهر</div>
          <div className="value">{stats.monthRevenue.toLocaleString()}</div>
          <div className="sub">من دفعات هذا الشهر</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="label">إجمالي الإيرادات</div>
          <div className="value">{stats.totalRevenue.toLocaleString()}</div>
          <div className="sub">{db.clients?.length || 0} عميل مسجل</div>
        </div>
        <div className="stat-card stat-red">
          <div className="label">إجمالي المصاريف</div>
          <div className="value">{stats.totalExpenses.toLocaleString()}</div>
          <div className="sub">{db.expenses?.length || 0} مصروف مسجل</div>
        </div>
        <div className={`stat-card ${stats.overdueCount > 0 ? 'stat-red' : 'stat-green'}`}>
          <div className="label">دفعات متأخرة</div>
          <div className="value">{stats.overdueCount}</div>
          <div className="sub">عملاء متأخرون بالدفع</div>
        </div>
      </div>

      {/* Revenue Analysis Panel */}
      {analysisOpen && (
        <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: '24px' }}>
          <div className="card-header" style={{ background: 'var(--primary-light)' }}>
            <h3>📊 تحليل إيرادات الخدمات والمحاسبة</h3>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>من تاريخ</label>
                  <input type="date" value={analysisFrom} onChange={e => setAnalysisFrom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>إلى تاريخ</label>
                  <input type="date" value={analysisTo} onChange={e => setAnalysisTo(e.target.value)} />
                </div>
                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <label>الفترة السريعة</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => handleSetAnalysisRange('month')}>الشهر</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleSetAnalysisRange('quarter')}>ربع سنوي</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleSetAnalysisRange('year')}>عام</button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>نطاق البحث عن العملاء</label>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', margin: '4px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" value="all" checked={analysisScope === 'all'} onChange={handleClientScopeChange} />
                    جميع العملاء
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" value="specific" checked={analysisScope === 'specific'} onChange={handleClientScopeChange} />
                    عملاء محددين
                  </label>
                </div>
              </div>

              {analysisScope === 'specific' && (
                <div className="form-group" style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => handleSelectAllClients(true)}>تحديد الكل</button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => handleSelectAllClients(false)}>إلغاء التحديد</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {(db.clients || []).map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', background: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedClients.includes(c.id)} 
                          onChange={() => handleClientCheckboxChange(c.id)} 
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={runRevenueAnalysis}>تطبيق التحليل 📈</button>
            </div>

            {analysisResult && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="divider"></div>
                
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  <div className="analysis-stat">
                    <div className="lbl">إجمالي الإيرادات</div>
                    <div className="val" style={{ color: 'var(--success)' }}>{analysisResult.total.toLocaleString()}</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="lbl">عدد الدفعات</div>
                    <div className="val" style={{ color: 'var(--primary)' }}>{analysisResult.payCount}</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="lbl">عدد العملاء</div>
                    <div className="val" style={{ color: 'var(--text)' }}>{analysisResult.clientCount}</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="lbl">متوسط الدفعة</div>
                    <div className="val" style={{ color: 'var(--warning)' }}>{analysisResult.average.toLocaleString()}</div>
                  </div>
                </div>

                {/* Distributions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="form-grid-2">
                  <div className="card">
                    <div className="card-header"><h3>توزيع الدخل حسب العملاء</h3></div>
                    <div className="card-body">
                      {analysisResult.clientBreakdown.length > 0 ? (
                        analysisResult.clientBreakdown.map((item, idx) => (
                          <div className="analysis-bar-row" key={idx}>
                            <div className="analysis-bar-label" title={item.name}>{item.name}</div>
                            <div className="analysis-bar-track">
                              <div className="analysis-bar-fill" style={{ width: `${item.percentage}%`, background: colors[idx % colors.length] }}></div>
                            </div>
                            <div className="analysis-bar-amount">{item.val.toLocaleString()}</div>
                          </div>
                        ))
                      ) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><h3>توزيع الدخل حسب نوع الخدمة</h3></div>
                    <div className="card-body">
                      {analysisResult.serviceBreakdown.length > 0 ? (
                        analysisResult.serviceBreakdown.map((item, idx) => (
                          <div className="analysis-bar-row" key={idx}>
                            <div className="analysis-bar-label" title={item.name}>{item.name}</div>
                            <div className="analysis-bar-track">
                              <div className="analysis-bar-fill" style={{ width: `${item.percentage}%`, background: colors[(idx + 2) % colors.length] }}></div>
                            </div>
                            <div className="analysis-bar-amount">{item.val.toLocaleString()}</div>
                          </div>
                        ))
                      ) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
                    </div>
                  </div>
                </div>

                {/* Currency breakdown */}
                <div>
                  <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>إيرادات الفلاتر حسب العملة:</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {analysisResult.currencyBreakdown.length > 0 ? (
                      analysisResult.currencyBreakdown.map(([cur, val], idx) => (
                        <div className="currency-pill" key={idx}>
                          <span className="cur">{cur}</span>
                          <strong className="amt">{val.toLocaleString()}</strong>
                        </div>
                      ))
                    ) : <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
                  </div>
                </div>

                {/* Payments list inside period */}
                <div className="card">
                  <div className="card-header"><h3>قائمة الدفعات في هذه الفترة</h3></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <table style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th>العميل</th>
                          <th>الخدمة</th>
                          <th>المبلغ</th>
                          <th>العملة</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.payments.length > 0 ? (
                          analysisResult.payments.map((p, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(p.date)}</td>
                              <td><strong>{p.clientName}</strong></td>
                              <td>{p.service || '-'}</td>
                              <td style={{ fontWeight: 700, color: 'var(--success)' }}>+{p.amount.toLocaleString()}</td>
                              <td><span className="badge badge-gray">{p.currency}</span></td>
                              <td>{p.note || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                              لا توجد دفعات مطابقة
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Recent Payments & Scheduled Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="form-grid-2">
        {/* Recent payments card */}
        <div className="card">
          <div className="card-header">
            <h3>💸 آخر الدفعات المستلمة</h3>
            <button className="btn btn-sm btn-outline" onClick={() => window.location.hash = '#/clients'}>إدارة العملاء</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentPayments.length === 0 ? (
              <div className="empty">
                <p>لا توجد دفعات مسجلة بعد</p>
              </div>
            ) : (
              recentPayments.map((p, idx) => (
                <div className="payment-row" style={{ padding: '12px 20px' }} key={idx}>
                  <div className="payment-date">{formatDate(p.date)}</div>
                  <div className="payment-service">
                    <strong>{p.clientName}</strong> {p.service ? `• ${p.service}` : ''}
                  </div>
                  <div className="payment-amount">
                    +{p.amount.toLocaleString()} <span className="payment-currency">{p.currency}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming payments preview */}
        <div className="card">
          <div className="card-header">
            <h3>🔔 الدفعات القادمة والمجدولة</h3>
            <button className="btn btn-sm btn-outline" onClick={() => window.location.hash = '#/payments-due'}>عرض كل الدفعات</button>
          </div>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            {upcomingPreview.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>
                <p>لا توجد دفعات قادمة مجدولة</p>
              </div>
            ) : (
              <div className="upcoming-list">
                {upcomingPreview.map((c, idx) => {
                  const dayText = c.days < 0 ? `متأخر ${Math.abs(c.days)} يوم` : c.days === 0 ? 'اليوم' : `خلال ${c.days} يوم`;
                  const cls = c.days <= 0 ? 'urgent' : c.days <= 3 ? 'soon' : '';
                  return (
                    <div className={`upcoming-item ${cls}`} key={idx}>
                      <div className={`upcoming-days ${c.days <= 0 ? 'urgent' : c.days <= 3 ? 'soon' : ''}`} style={{ minWidth: '60px' }}>
                        {dayText}
                      </div>
                      <div className="upcoming-name">{c.name}</div>
                      <div className="upcoming-amount" style={{ fontSize: '13px', fontWeight: 700 }}>
                        {c.amount ? `${c.amount.toLocaleString()} ${c.currency}` : ''}
                      </div>
                      <button 
                        className="btn btn-sm btn-wa" 
                        onClick={() => openWAReminder(c, 'due')} 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        title="أرسل تذكير بالواتساب"
                      >
                        📱 تنبيه
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Custom Message Modal */}
      <Modal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        title="إرسال تذكير عبر الواتساب"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setWaModalOpen(false)}>إلغاء</button>
            <button className="btn btn-wa" onClick={sendWAReminder}>فتح واتساب ويب 📱</button>
          </>
        }
      >
        {waClient && (
          <div className="form-grid">
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
              سيتم توجيهك لرقم الهاتف: <strong dir="ltr">{waClient.phone}</strong> لإرسال رسالة التذكير للعميل: <strong>{waClient.name}</strong>.
            </div>
            <div className="form-group">
              <label>نص الرسالة</label>
              <textarea 
                rows="6" 
                value={waMessage} 
                onChange={e => setWaMessage(e.target.value)}
                style={{ direction: 'rtl', fontFamily: 'inherit', fontSize: '13px', padding: '10px' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
