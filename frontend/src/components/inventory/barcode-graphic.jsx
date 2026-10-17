import { getEan13Modules } from '@/services/barcodeEngine';

export default function BarcodeGraphic({ value }) {
  const modules = getEan13Modules(value);
  return (
    <svg
      className="barcode-graphic"
      viewBox={`0 0 ${modules.length} 52`}
      role="img"
      aria-label={`EAN-13 barcode ${value}`}
      shapeRendering="crispEdges"
    >
      {modules.map((isBar, index) => isBar && (
        <rect
          key={index}
          x={index}
          y={0}
          width={1}
          height={index < 3 || (index >= 45 && index < 50) || index >= 92 ? 43 : 38}
          fill="#111827"
        />
      ))}
      <text x="47.5" y="51" textAnchor="middle" fontSize="7" fill="#111827">{value}</text>
    </svg>
  );
}
