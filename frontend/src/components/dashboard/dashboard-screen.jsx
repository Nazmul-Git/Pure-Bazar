'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Activity, BadgeDollarSign, Package, RefreshCw, Wallet } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { getDashboard } from '@/services/dashboard';

const currency = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' });
const timeFormat = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const dateFormat = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'full',
  timeZone: 'Asia/Dhaka',
});

const formatMoney = (amount) => currency.format(Number(amount) || 0);
const readable = (value) => String(value || '').replaceAll('_', ' ').toLowerCase();

function MetricCard({ label, value, description, icon: Icon, tone }) {
  return (
    <Card className="dashboard-metric">
      <div className="dashboard-metric-top">
        <span className="dashboard-metric-label">{label}</span>
        <span className={`dashboard-metric-icon dashboard-icon-${tone}`}><Icon size={18} /></span>
      </div>
      <strong className="dashboard-metric-value">{value}</strong>
      <span className="dashboard-metric-description">{description}</span>
    </Card>
  );
}

export default function DashboardScreen() {
  const { token, user } = useSelector((state) => state.auth);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getDashboard(token)
      .then(({ data }) => {
        if (active) setDashboard(data.dashboard);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reload, token]);

  const paymentMethods = Object.entries(dashboard?.todayByPaymentMethod || {});
  const largestPayment = Math.max(0, ...paymentMethods.map(([, amount]) => Number(amount) || 0));
  const lowStock = dashboard?.lowStockAlerts || [];
  const recentActivity = dashboard?.recentActivity || [];

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-date">{dateFormat.format(new Date())}</p>
          <h1>Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="dashboard-subtitle">Here’s what’s happening across your business today.</p>
        </div>
        <Button variant="secondary" onClick={() => setReload((current) => current + 1)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'dashboard-spinning' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => setReload((current) => current + 1)}>Try again</Button>
        </div>
      )}

      {loading && !dashboard ? (
        <p className="dashboard-status" role="status">Loading your dashboard...</p>
      ) : dashboard && (
        <>
          <div className="dashboard-metrics">
            <MetricCard label="Today's sales" value={formatMoney(dashboard.todaySales)} description={`${dashboard.todayBillCount} bills today`} icon={BadgeDollarSign} tone="blue" />
            <MetricCard label="Total sales" value={formatMoney(dashboard.totalSales)} description="All paid orders" icon={Activity} tone="green" />
            <MetricCard label="Margin income" value={formatMoney(dashboard.marginIncome)} description="Company net from vendor ledger" icon={Wallet} tone="violet" />
            <MetricCard label="Vendor payables due" value={formatMoney(dashboard.vendorPayablesDue)} description="Approved statements awaiting payment" icon={Package} tone="amber" />
          </div>

          <div className="dashboard-panels">
            <Card title="Today's sales by payment method" description="Payment totals from today's paid bills.">
              {paymentMethods.length ? (
                <div className="dashboard-chart" aria-label="Today's sales by payment method">
                  {paymentMethods.map(([method, amount]) => {
                    const percentage = largestPayment > 0 ? (Number(amount) / largestPayment) * 100 : 0;
                    return (
                      <div className="dashboard-chart-row" key={method}>
                        <div className="dashboard-chart-label">
                          <span>{readable(method)}</span>
                          <strong>{formatMoney(amount)}</strong>
                        </div>
                        <div className="dashboard-chart-track" role="img" aria-label={`${readable(method)}: ${formatMoney(amount)}`}>
                          <span style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="dashboard-empty">No sales recorded today yet.</p>
              )}
              <div className="dashboard-chart-footer">
                <span>Wallet bills</span>
                <strong>{formatMoney(dashboard.walletBillTotal)}</strong>
              </div>
            </Card>

            <Card title="Stock to watch" description={`Products at or below ${dashboard.lowStockThreshold} units.`}>
              <div className="dashboard-panel-summary">
                <span className="dashboard-summary-icon"><Package size={17} /></span>
                <strong>{lowStock.length}</strong>
                <span>low-stock {lowStock.length === 1 ? 'product' : 'products'}</span>
              </div>
              {lowStock.length ? (
                <ul className="dashboard-list">
                  {lowStock.slice(0, 5).map((product) => (
                    <li key={product.productId}>
                      <span><strong>{product.productName}</strong><small>{product.barcode || 'No barcode'}</small></span>
                      <b>{product.quantity} units</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-empty">No products are below the stock threshold.</p>
              )}
            </Card>

            <Card title="Recent activity" description="Latest recorded actions.">
              {recentActivity.length ? (
                <ul className="dashboard-list dashboard-activity">
                  {recentActivity.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <span><strong>{readable(item.action)}</strong><small>{readable(item.entity)}</small></span>
                      <time dateTime={item.createdAt}>{timeFormat.format(new Date(item.createdAt))}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-empty">No recent activity.</p>
              )}
            </Card>

            <Card title="This month" description="A quick view of monthly costs.">
              <div className="dashboard-month-total">
                <span>Expenses</span>
                <strong>{formatMoney(dashboard.monthExpenses)}</strong>
              </div>
              <p className="dashboard-month-note">Expenses recorded this month.</p>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
