'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import {
  availableStock, canSellPieces, isPiece, lineTotal, unitPrice,
} from '@/services/pos-cart-utils.cjs';
import { T } from '@/i18n/language-provider';

const money = (value) => (Number(value) || 0).toFixed(2);

export default function CartPanel({ items, onQuantity, onUnit, onRemove, onDiscount }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900"><T>{"Current bill"}</T></h2>
        <span className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500"><T>{"Scan an item barcode to start a bill."}</T></p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.productId} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-slate-900">{item.name}</h3>
                  <p className="text-xs text-slate-500">{item.barcode} · ৳{money(unitPrice(item))} per {isPiece(item) ? 'pc' : 'box'} · {availableStock(item)} {isPiece(item) ? 'pcs' : 'boxes'} in stock</p>
                </div>
                <button
                  type="button"
                  className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.productId)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_auto_1fr_1fr_1.5fr_auto] sm:items-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 p-2 disabled:opacity-40"
                    aria-label={`Decrease ${item.name} quantity`}
                    onClick={() => onQuantity(item.productId, Number(item.quantity) - 1)}
                    disabled={Number(item.quantity) <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <Input
                    label="Qty"
                    type="number"
                    min="1"
                    max={availableStock(item)}
                    step="1"
                    value={item.quantity}
                    onChange={(event) => onQuantity(item.productId, event.target.value)}
                    className="w-24"
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-300 p-2 disabled:opacity-40"
                    aria-label={`Increase ${item.name} quantity`}
                    onClick={() => onQuantity(item.productId, Number(item.quantity) + 1)}
                    disabled={Number(item.quantity) >= availableStock(item)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {canSellPieces(item) && (
                  <Select
                    label="Unit"
                    value={item.unit || 'PACKAGE'}
                    onChange={(event) => onUnit(item.productId, event.target.value)}
                  >
                    <option value="PACKAGE">{item.packageUnitName || 'Box'}</option>
                    <option value="PIECE"><T>{"Pcs"}</T></option>
                  </Select>
                )}
                <Select
                  label="Discount type"
                  value={item.discount?.type || 'PERCENT'}
                  onChange={(event) => onDiscount(item.productId, { type: event.target.value })}
                >
                  <option value="PERCENT"><T>{"Percent"}</T></option>
                  <option value="FIXED"><T>{"Fixed amount"}</T></option>
                </Select>
                <Input
                  label={item.discount?.type === 'FIXED' ? 'Discount (৳)' : 'Discount (%)'}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount?.value ?? ''}
                  onChange={(event) => onDiscount(item.productId, { value: event.target.value })}
                />
                <Input
                  label="Discount reason"
                  value={item.discount?.reason || ''}
                  onChange={(event) => onDiscount(item.productId, { reason: event.target.value })}
                  placeholder="Required when discount is applied"
                  maxLength={300}
                />
                <strong className="text-right text-slate-900">৳{money(lineTotal(item))}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
