'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { Activity, ArrowDownRight, ArrowUpRight, BadgeDollarSign, Package, RefreshCw, Wallet } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { getDashboard } from '@/services/dashboard';
import { PaymentDonut, RevenueExpenseBars, SalesTrendChart } from './dashboard-charts';
import './dashboard.css';

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

function ChangeBadge({ change }) {
  if (change === null || change === undefined) return null;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const Icon = change < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`dash-kpi-badge ${direction}`}>
      <Icon size={12} />{change > 0 ? '+' : ''}{change.toFixed(1)}% vs yesterday
    </span>
  );
}

function MetricCard({ label, value, description, icon: Icon, tint, badge }) {
  return (
    <Card className="dash-kpi">
      <div className="dashboard-metric-top">
        <span className="dashboard-metric-label">{label}</span>
        <span className="dash-kpi-icon"><Icon size={18} /></span>
      </div>
      <strong className="dashboard-metric-value">{value}</strong>
      {badge}
      <span className="dashboard-metric-description">{description}</span>
    </Card>
  );
}

function percentChange(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / before) * 100;
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

  const lowStock = dashboard?.lowStockAlerts || [];
  const recentActivity = dashboard?.recentActivity || [];
  const salesChange = percentChange(dashboard?.todaySales, dashboard?.yesterdaySales);

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
          <div className="dash-metrics">
            <MetricCard label="Today's sales" value={formatMoney(dashboard.todaySales)} description={`${dashboard.todayBillCount} bills today`} icon={BadgeDollarSign} tint="#82C341" badge={<ChangeBadge change={salesChange} />} />
            <MetricCard label="Total sales" value={formatMoney(dashboard.totalSales)} description="All paid orders" icon={Activity} tint="#3B82F6" />
            <MetricCard label="Margin income" value={formatMoney(dashboard.marginIncome)} description="Company net from vendor ledger" icon={Wallet} tint="#8B5CF6" />
            <MetricCard label="Vendor payables due" value={formatMoney(dashboard.vendorPayablesDue)} description="Approved statements awaiting payment" icon={Package} tint="#F58220" />
          </div>

          <div className="dash-grid">
            <Card title="Sales trend" description="Paid sales over time (Asia/Dhaka).">
              <SalesTrendChart trend={dashboard.salesTrend} />
            </Card>
            <Card title="Today's sales by payment method" description="Payment totals from today's paid bills.">
              <PaymentDonut byMethod={dashboard.todayByPaymentMethod} />
              <div className="dashboard-chart-footer">
                <span>Wallet bills</span>
                <strong>{formatMoney(dashboard.walletBillTotal)}</strong>
              </div>
            </Card>
          </div>

          <div className="dash-grid even">
            <Card title="Revenue vs expenses" description="Last six months, side by side.">
              <RevenueExpenseBars data={dashboard.monthlyFinance} />
              <div className="dashboard-chart-footer">
                <span>Expenses this month</span>
                <strong>{formatMoney(dashboard.monthExpenses)}</strong>
              </div>
            </Card>

            <Card title="Stock to watch" description={`Products at or below ${dashboard.lowStockThreshold} units.`}
              actions={<Link className="dash-action" href="/inventory/goods-receives/new">Restock</Link>}>
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
                      <span className="dash-row-end">
                        <span className={`dash-badge ${product.quantity <= 0 ? 'critical' : 'low'}`}>
                          {product.quantity <= 0 ? 'Out of stock' : 'Low'}
                        </span>
                        <b>{product.quantity} units</b>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-empty">No products are below the stock threshold.</p>
              )}
            </Card>
          </div>

          <Card title="Recent activity" description="Latest recorded actions."
            actions={<Link className="dash-action" href="/reports/audit-trail">View all</Link>}>
            {recentActivity.length ? (
              <ul className="dashboard-list dashboard-activity">
                {recentActivity.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <span><strong>{readable(item.action)}</strong><small>{readable(item.entity)}</small></span>
                    <span className="dash-row-end">
                      <span className="dash-badge action">{readable(item.entity)}</span>
                      <time dateTime={item.createdAt}>{timeFormat.format(new Date(item.createdAt))}</time>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dashboard-empty">No recent activity.</p>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
