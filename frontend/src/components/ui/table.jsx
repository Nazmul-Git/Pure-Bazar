'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Table({ columns, rows, rowKey = 'id', pageSize = 10, emptyMessage = 'No records found' }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table className="ui-table">
          <thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row, index) => (
              <tr key={row[rowKey] ?? `${page}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>
                ))}
              </tr>
            )) : <tr><td className="table-empty" colSpan={columns.length}>{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="table-pagination">
          <span>{page * pageSize + 1}-{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span>
          <div>
            <button className="icon-button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button>
            <button className="icon-button" aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}