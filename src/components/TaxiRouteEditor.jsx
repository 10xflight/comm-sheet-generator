import React from 'react';
import { PlusCircle } from 'lucide-react';
import { parseTaxiRoute } from '../utils/taxiParser';

export default function TaxiRouteEditor({ runway, route, onChangeRunway, onChangeRoute, callSignAbbr, onAddToSheet }) {
  const formatFullReadback = () => {
    const parsed = parseTaxiRoute(route, '');
    if (!parsed) return '';
    return `Runway ${runway}, taxi via ${parsed}, ${callSignAbbr || '[Call Sign]'}`;
  };

  const readback = runway && route ? formatFullReadback() : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200">
        <span className="text-xs text-slate-500 shrink-0">RWY</span>
        <input
          type="text"
          value={runway}
          onChange={(e) => onChangeRunway(e.target.value)}
          placeholder="##"
          className="w-12 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-xs text-slate-400">&rarr;</span>
        <input
          type="text"
          value={route}
          onChange={(e) => onChangeRoute(e.target.value)}
          placeholder="a, b, cross 14, hold short c, back taxi..."
          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      {readback && (
        <div className="flex items-center gap-2">
          <div className="flex-1 text-sm text-slate-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="font-medium">{readback}</span>
          </div>
          {onAddToSheet && (
            <button
              onClick={() => onAddToSheet(readback)}
              className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 font-medium shrink-0"
              title="Add this readback to comm sheet"
            >
              <PlusCircle size={14} /> Add
            </button>
          )}
        </div>
      )}
    </div>
  );
}
