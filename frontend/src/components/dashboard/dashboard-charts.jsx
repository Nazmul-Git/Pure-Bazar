'use client';

import { useId, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export const GREEN = '#82C341';
export const ORANGE = '#F58220';
const METHOD_COLORS = { CASH: GREEN, BKASH: '#E2136E', NAGAD: ORANGE, CARD: '#3B82F6', WALLET: '#8B5CF6' };
const METHOD_NAMES = { CASH: 'Cash', BKASH: 'bKash', NAGAD: 'Nagad', CARD: 'Card', WALLET: 'Wallet' };
const AXIS = { fontSize: 11, fill: 'var(--muted)' };

const full = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-BD', { notation: 'compact', maximumFractionDigits: 1 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortLabel(label) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return `${label.slice(8)} ${MONTHS[Number(label.slice(5, 7)) - 1]}`;
  if (/^\d{4}-\d{2}$/.test(label)) return `${MONTHS[Number(label.slice(5)) - 1]} ${label.slice(2, 4)}`;
  return label;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <p>{shortLabel(label ?? payload[0].name)}</p>
      {payload.map((item) => (
        <div key={item.dataKey || item.name}>
          <i style={{ background: item.color || item.payload?.fill }} />
          <span>{item.name}</span>
          <b>{full.format(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];

export function SalesTrendChart({ trend }) {
  const [period, setPeriod] = useState('daily');
  const uid = useId().replace(/:/g, '');
  const data = trend?.[period] || [];
  return (
    <>
      <div className="dash-toggle" role="tablist" aria-label="Sales trend period">
        {PERIODS.map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={period === key}
            className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{text}</button>
        ))}
      </div>
      <div className="dash-chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={GREEN} /><stop offset="100%" stopColor={ORANGE} />
              </linearGradient>
              <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.45} />
                <stop offset="60%" stopColor={ORANGE} stopOpacity={0.18} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tickFormatter={shortLabel} tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tickFormatter={(v) => compact.format(v)} tick={AXIS} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="sales" name="Sales" stroke={`url(#${uid}-stroke)`} strokeWidth={3}
              fill={`url(#${uid}-fill)`} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function PaymentDonut({ byMethod }) {
  const data = Object.entries(byMethod || {})
    .map(([method, amount]) => ({ name: METHOD_NAMES[method] || method, value: Number(amount) || 0, fill: METHOD_COLORS[method] || '#94A3B8' }))
    .filter((item) => item.value > 0);
  if (!data.length) return <p className="dashboard-empty">No sales recorded today yet.</p>;
  return (
    <div className="dash-chart-box dash-chart-box-pie" role="img" aria-label="Today's sales by payment method">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} stroke="none">
            {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueExpenseBars({ data }) {
  return (
    <div className="dash-chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tickFormatter={shortLabel} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => compact.format(v)} tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(130,195,65,.08)' }} />
          <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue" fill={GREEN} radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name="Expenses" fill={ORANGE} radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
