import React, { useState } from 'react';
import { AlertTriangle, Save, X, ChevronDown } from 'lucide-react';
import RouteBuilder from './RouteBuilder';

export default function ConfigPanel({
  mode, callSign, flightRules, route, abbr, callSignWarning, callSignHistory,
  onCallSignChange, onFlightRulesChange, onRouteChange, onSaveCallSign, onDeleteCallSign
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Call Sign</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={callSign}
                onChange={(e) => onCallSignChange(e.target.value)}
                onFocus={() => callSignHistory?.length > 0 && setShowHistory(true)}
                onBlur={() => { if (callSign.trim()) onSaveCallSign(); }}
                placeholder="[Type] [N-Number], e.g., Skyhawk 12345"
                className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {callSignHistory?.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown size={16} />
                </button>
              )}
              {showHistory && callSignHistory?.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {callSignHistory.map(cs => (
                    <div key={cs} className="flex items-center group">
                      <button
                        onClick={() => { onCallSignChange(cs); setShowHistory(false); }}
                        className="flex-1 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {cs}
                      </button>
                      {onDeleteCallSign && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteCallSign(cs); }}
                          className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from history"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {onSaveCallSign && callSign && callSign.trim().length >= 3 && (
              <button
                onClick={() => { onSaveCallSign(); }}
                className="px-3 py-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="Save call sign to history"
              >
                <Save size={18} />
              </button>
            )}
          </div>
          {/* Click outside to close */}
          {showHistory && (
            <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
          )}
          <p className="text-xs text-slate-400 mt-1">Abbreviated: {abbr || '[Type] [###]'}</p>
          {callSignWarning && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Please enter a call sign (e.g., Skyhawk 12345)
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Flight Rules</label>
          <select
            value={flightRules}
            onChange={(e) => onFlightRulesChange(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          >
            <option value="vfr">VFR</option>
            <option value="ifr">IFR</option>
          </select>
        </div>
      </div>

      {mode === 'template' && (
        <RouteBuilder route={route} onRouteChange={onRouteChange} />
      )}
    </div>
  );
}
