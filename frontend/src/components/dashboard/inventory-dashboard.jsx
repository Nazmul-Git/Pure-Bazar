import Link from 'next/link';
import { AlertTriangle, ClipboardList, PackageX, Truck } from 'lucide-react';
import { Card } from '@/components/ui';
import { MetricCard, ProgressBar, timeFormat } from './dashboard-shared';

export default function InventoryDashboard({ dashboard }) {
  const {
    fastMoving = [], pendingGrns = [], reorderRecommendations = [], recentAdjustments = [],
  } = dashboard;
  const topSold = fastMoving[0]?.soldQuantity || 0;

  return (
    <>
      <div className="dash-metrics">
        <MetricCard label="Stock out" value={dashboard.stockOutCount} description="Products with no stock" icon={PackageX}
          badge={dashboard.stockOutCount > 0 ? <span className="dash-badge critical">Needs attention</span> : null} />
        <MetricCard label="Low stock" value={dashboard.lowStockCount} description={`At or below ${dashboard.lowStockThreshold} units`} icon={AlertTriangle}
          badge={dashboard.lowStockCount > 0 ? <span className="dash-badge low">Restock soon</span> : null} />
        <MetricCard label="Pending GRN" value={dashboard.pendingGrnCount} description="Goods received awaiting approval" icon={Truck} />
        <MetricCard label="Pending adjustments" value={dashboard.pendingAdjustmentCount} description="Awaiting approval" icon={ClipboardList} />
      </div>

      <div className="dash-grid even">
        <Card title="Reorder recommendations" description="Suggested quantity restores twice the low-stock level."
          actions={<Link className="dash-action" href="/inventory/goods-receives/new">New GRN</Link>}>
          {reorderRecommendations.length ? (
            <ul className="dashboard-list">
              {reorderRecommendations.map((item) => (
                <li key={item.productId}>
                  <span><strong>{item.productName}</strong><small>{item.quantity} in stock</small></span>
                  <span className="dash-row-end">
                    <span className={`dash-badge ${item.quantity <= 0 ? 'critical' : 'low'}`}>{item.quantity <= 0 ? 'Out of stock' : 'Low'}</span>
                    <b>Order {item.suggestedQuantity}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">Nothing needs reordering.</p>
          )}
        </Card>

        <Card title="Fastest moving products" description="Units sold in the last 30 days.">
          {fastMoving.length ? (
            <ul className="dashboard-list">
              {fastMoving.map((item) => (
                <li key={item.productId} className="dash-bar-row">
                  <span className="dash-bar-head"><strong>{item.productName}</strong><b>{item.soldQuantity}</b></span>
                  <ProgressBar percent={topSold ? (item.soldQuantity / topSold) * 100 : 0} label={`${item.productName} units sold`} tone="orange" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No sales recorded in the last 30 days.</p>
          )}
        </Card>
      </div>

      <div className="dash-grid even">
        <Card title="Pending goods received" description="Draft GRNs awaiting approval."
          actions={<Link className="dash-action" href="/inventory/goods-receives">View all</Link>}>
          {pendingGrns.length ? (
            <ul className="dashboard-list">
              {pendingGrns.map((grn) => (
                <li key={grn.id}>
                  <span><strong>{grn.vendorChallanNumber || 'Company purchase'}</strong><small>{grn.lineCount} lines</small></span>
                  <time dateTime={grn.createdAt}>{timeFormat.format(new Date(grn.createdAt))}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No pending goods received.</p>
          )}
        </Card>

        <Card title="Recent stock adjustments" description="Latest adjustments and their status.">
          {recentAdjustments.length ? (
            <ul className="dashboard-list">
              {recentAdjustments.map((item) => (
                <li key={item.id}>
                  <span><strong>{item.reason}</strong><small>{item.lineCount} lines - {timeFormat.format(new Date(item.createdAt))}</small></span>
                  <span className={`dash-badge ${item.status === 'Rejected' ? 'critical' : item.status === 'Approved' ? 'action' : 'low'}`}>{item.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No stock adjustments yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
