import { formatDate, money, productStock, totalStock } from './vendor-format';

const th = 'border border-slate-400 px-2 py-1 text-left';
const td = 'border border-slate-300 px-2 py-1';

export default function VendorStatementInvoice({ data }) {
  const { vendor, products, summary, period } = data;
  const range = period.startDate || period.endDate
    ? `${period.startDate ? formatDate(period.startDate) : 'Beginning'} – ${period.endDate ? formatDate(period.endDate) : 'Today'}`
    : 'All time';

  return (
    <section className="print-document mx-auto hidden max-w-4xl space-y-5 text-sm text-slate-900 print:block">
      <header className="border-b-2 border-slate-800 pb-3 text-center">
        <h1 className="text-2xl font-bold">PureBazar</h1>
        <p className="font-semibold">Vendor Stock &amp; Sales Statement</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p><strong>Vendor:</strong> {vendor.name}</p>
          <p><strong>Member ID:</strong> {vendor.memberId}</p>
          <p><strong>Shop:</strong> {vendor.shopName}</p>
          <p><strong>Category:</strong> {vendor.productCategory}</p>
        </div>
        <div className="text-right">
          <p><strong>Period:</strong> {range}</p>
          <p><strong>Generated:</strong> {formatDate(new Date())}</p>
          <p><strong>Contact:</strong> {vendor.mobile}</p>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Product', 'Received', 'Warehouse', 'Outlets', 'Stock', 'Sold', 'Unit price', 'Valuation', 'Payable'].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.productId}>
              <td className={td}>{p.name}</td>
              <td className={td}>{productStock(p.receivedQty, p)}</td>
              <td className={td}>{productStock(p.warehouseStock, p)}</td>
              <td className={td}>{productStock(p.outletStock, p)}</td>
              <td className={td}>{productStock(p.currentStock, p)}</td>
              <td className={td}>{productStock(p.soldQty, p)}</td>
              <td className={td}>{money(p.unitPrice)}</td>
              <td className={td}>{money(p.valuation)}</td>
              <td className={td}>{money(p.payable)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={td}>Total ({summary.totalProducts})</td>
            <td className={td} colSpan={3} />
            <td className={td}>{totalStock(summary.totalAvailableStock, products)}</td>
            <td className={td}>{totalStock(summary.totalSoldUnits, products)}</td>
            <td className={td} />
            <td className={td}>{money(summary.totalValuation)}</td>
            <td className={td}>{money(summary.totalPayable)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="text-right text-lg font-bold">Net Payable Amount: {money(summary.totalPayable)}</p>

      <footer className="grid grid-cols-3 gap-6 pt-16 text-center">
        {['Vendor signature', 'Prepared by', 'Authorized / Audit'].map((label) => (
          <div key={label} className="border-t border-slate-800 pt-1">{label}</div>
        ))}
      </footer>
      <p className="text-center text-xs text-slate-500">
        System-generated statement. Stock reflects current holdings; sales and payable are net of returns for the period.
      </p>
    </section>
  );
}
