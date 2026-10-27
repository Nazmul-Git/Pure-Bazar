import Link from 'next/link';
import { BadgeDollarSign, Banknote, Receipt, ShoppingCart } from 'lucide-react';
import { Card } from '@/components/ui';
import { MetricCard, ProgressBar, formatMoney, timeFormat } from './dashboard-shared';
import { T } from '@/i18n/language-provider';

const SPLIT_LABELS = [['cash', 'Cash'], ['bkash', 'bKash'], ['card', 'Card'], ['other', 'Other']];

export default function CashierDashboard({ dashboard }) {
  const { shift, recentBills = [], paymentSplit = {} } = dashboard;
  const hasTarget = dashboard.targetProgressPercent !== null && dashboard.targetProgressPercent !== undefined;

  return (
    <>
      <div className="dash-cta">
        <Link className="dash-cta-button" href="/orders/pos">
          <ShoppingCart size={20} />Open POS Billing
        </Link>
      </div>

      <div className="dash-metrics">
        <MetricCard label="My today's sales" value={formatMoney(dashboard.todaySales)} description="Your paid bills today" icon={BadgeDollarSign} />
        <MetricCard label="Completed bills" value={dashboard.todayBillCount} description="Bills you completed today" icon={Receipt} />
        <MetricCard label="Shift cash expected" value={shift ? formatMoney(shift.expectedCash) : '-'} description={shift ? 'Opening cash plus cash sales' : 'No open shift'} icon={Banknote} />
      </div>

      <div className="dash-grid even">
        <Card title="Daily sales target" description="Progress toward today's target.">
          {hasTarget ? (
            <>
              <ProgressBar percent={dashboard.targetProgressPercent} label="Daily sales target progress" />
              <div className="dashboard-chart-footer">
                <span>{formatMoney(dashboard.todaySales)} of {formatMoney(dashboard.dailySalesTarget)}</span>
                <strong>{dashboard.targetProgressPercent}%</strong>
              </div>
            </>
          ) : (
            <p className="dashboard-empty"><T>{"No daily sales target has been set. Ask an admin to set one in Settings."}</T></p>
          )}
        </Card>

        <Card title="Payment collection" description="Today's collection by payment mode.">
          <ul className="dashboard-list">
            {SPLIT_LABELS.map(([key, label]) => (
              <li key={key}><span><strong>{label}</strong></span><b>{formatMoney(paymentSplit[key])}</b></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="dash-grid even">
        <Card title="Shift cash summary" description="Your current open shift.">
          {shift ? (
            <ul className="dashboard-list">
              <li><span><strong><T>{"Opened"}</T></strong></span><b>{timeFormat.format(new Date(shift.openedAt))}</b></li>
              <li><span><strong><T>{"Opening cash"}</T></strong></span><b>{formatMoney(shift.openingCash)}</b></li>
              <li><span><strong><T>{"Cash sales"}</T></strong></span><b>{formatMoney(shift.cashSales)}</b></li>
              <li><span><strong><T>{"Expected cash in drawer"}</T></strong></span><b>{formatMoney(shift.expectedCash)}</b></li>
              <li><span><strong><T>{"Bills this shift"}</T></strong></span><b>{shift.billCount}</b></li>
            </ul>
          ) : (
            <p className="dashboard-empty"><T>{"No open shift. Open a shift from POS Billing to start."}</T></p>
          )}
        </Card>

        <Card title="My recent completed bills" description="Latest bills you completed today.">
          {recentBills.length ? (
            <ul className="dashboard-list">
              {recentBills.map((bill) => (
                <li key={bill.id}>
                  <span><strong>{bill.orderNumber}</strong><small>{timeFormat.format(new Date(bill.soldAt))} - {bill.itemCount} items</small></span>
                  <span className="dash-row-end">
                    <span className="dash-badge action">{bill.methods.join(', ')}</span>
                    <b>{formatMoney(bill.grandTotal)}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty"><T>{"You have not completed any bills today."}</T></p>
          )}
        </Card>
      </div>
    </>
  );
}
