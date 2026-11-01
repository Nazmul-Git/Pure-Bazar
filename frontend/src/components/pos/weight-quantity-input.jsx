'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { formatStockDisplay, fromGrams, toGrams } from '@/services/stock-units.cjs';

const STEP_GRAMS = { Kg: 1000, Gram: 100 };

// Cart quantity stays in grams; the cashier types Kg or Gram.
export default function WeightQuantityInput({ item, maxGrams, onChange }) {
  const [unit, setUnit] = useState('Kg');
  const grams = Number(item.quantity) || 0;
  const [text, setText] = useState(String(fromGrams(grams, 'Kg')));

  useEffect(() => {
    setText((current) => (toGrams(current, unit) === grams ? current : String(fromGrams(grams, unit))));
  }, [grams, unit]);

  function change(value) {
    setText(value);
    const next = toGrams(value, unit);
    if (next > 0) onChange(next);
  }

  const step = STEP_GRAMS[unit];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded border border-slate-300 p-2 disabled:opacity-40"
        aria-label={`Decrease ${item.name} quantity`}
        onClick={() => onChange(grams - step)}
        disabled={grams <= step}
      >
        <Minus size={14} />
      </button>
      <Input
        label={`Weight (${unit})`}
        type="number"
        min="0"
        step={unit === 'Kg' ? '0.001' : '1'}
        value={text}
        onChange={(event) => change(event.target.value)}
        className="w-24"
      />
      <Select label="Unit" value={unit} onChange={(event) => setUnit(event.target.value)}>
        <option value="Kg">Kg</option>
        <option value="Gram">Gram</option>
      </Select>
      <button
        type="button"
        className="rounded border border-slate-300 p-2 disabled:opacity-40"
        aria-label={`Increase ${item.name} quantity`}
        onClick={() => onChange(grams + step)}
        disabled={grams + 1 > maxGrams}
      >
        <Plus size={14} />
      </button>
      <span className="text-xs text-slate-500">{formatStockDisplay(grams, 'Gram')}</span>
    </div>
  );
}
