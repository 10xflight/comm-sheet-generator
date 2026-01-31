import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { searchAirports } from '../data/airports';

export default function RouteBuilder({ route, onRouteChange }) {
  const [searchValues, setSearchValues] = useState({});
  const [activeStop, setActiveStop] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const inputRefs = useRef({});

  const getSearch = (idx) => searchValues[idx] || '';

  const setSearch = (idx, val) => {
    setSearchValues(prev => ({ ...prev, [idx]: val }));
  };

  const handleSearch = (term, idx) => {
    setSearch(idx, term);
    setActiveStop(idx);
    setSearchResults(searchAirports(term));
    setHighlightIdx(0);
  };

  const handleKeyDown = (e, idx, stop) => {
    if (e.key === 'Escape') {
      setActiveStop(null);
      setSearch(idx, '');
      setSearchResults([]);
      setEditingName(null);
      e.target.blur();
      return;
    }
    // Backspace on empty input removes chip
    if (e.key === 'Backspace' && getSearch(idx) === '' && stop.airport && editingName !== idx) {
      e.preventDefault();
      clearAirport(idx);
      return;
    }
    if (searchResults.length === 0 || activeStop !== idx) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (editingName === idx) {
        saveEditName(idx);
      } else {
        selectAirport(searchResults[highlightIdx], idx);
      }
    }
  };

  const selectAirport = (apt, idx) => {
    const newRoute = [...route];
    newRoute[idx] = { ...newRoute[idx], airport: apt };
    onRouteChange(newRoute);
    setSearch(idx, '');
    setSearchResults([]);
    setActiveStop(null);
  };

  const clearAirport = (idx) => {
    const newRoute = [...route];
    newRoute[idx] = { ...newRoute[idx], airport: null };
    onRouteChange(newRoute);
    setSearch(idx, '');
    setSearchResults([]);
    setActiveStop(idx);
    requestAnimationFrame(() => {
      inputRefs.current[idx]?.focus();
    });
  };

  const startEditName = (idx, stop) => {
    setEditingName(idx);
    setEditNameValue(stop.airport.name);
    requestAnimationFrame(() => {
      inputRefs.current[idx]?.focus();
    });
  };

  const saveEditName = (idx) => {
    if (editNameValue.trim()) {
      const newRoute = [...route];
      newRoute[idx] = {
        ...newRoute[idx],
        airport: { ...newRoute[idx].airport, name: editNameValue.trim(), abridged: editNameValue.trim() }
      };
      onRouteChange(newRoute);
    }
    setEditingName(null);
  };

  const addStop = () => {
    const newRoute = [...route];
    newRoute.splice(route.length - 1, 0, { airport: null, type: 'stop', intention: 'full_stop' });
    onRouteChange(newRoute);
  };

  const updateStopIntention = (idx, intention) => {
    const newRoute = [...route];
    newRoute[idx] = { ...newRoute[idx], intention };
    onRouteChange(newRoute);
  };

  const removeStop = (idx) => {
    if (route.length > 2) {
      onRouteChange(route.filter((_, i) => i !== idx));
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-3">Route</label>
      <div className="space-y-3">
        {route.map((stop, idx) => (
          <div key={idx} className="flex items-center gap-3 flex-wrap">
            <span className="w-24 text-sm font-medium text-slate-500">
              {stop.type === 'dep' ? 'Departure' : stop.type === 'arr' ? 'Arrival' : `Stop ${idx}`}
            </span>
            <div className="flex-1 relative min-w-48">
              {/* Gmail-style chip-in-input */}
              <div
                className={`flex items-center flex-wrap gap-1.5 w-full px-3 py-2.5 bg-slate-50 border rounded-xl transition-all cursor-text ${
                  activeStop === idx ? 'border-blue-500 ring-2 ring-blue-500 bg-white' : 'border-slate-200'
                }`}
                onClick={() => {
                  if (editingName !== idx) {
                    inputRefs.current[idx]?.focus();
                  }
                }}
              >
                {/* Chip */}
                {stop.airport && (
                  editingName === idx ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border-2 border-blue-300 rounded-lg">
                      <span className="font-mono font-bold text-blue-700 text-sm">{stop.airport.id}</span>
                      <span className="text-slate-400 text-sm">—</span>
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onBlur={() => saveEditName(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditName(idx);
                          if (e.key === 'Escape') setEditingName(null);
                          e.stopPropagation();
                        }}
                        className="text-sm text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); clearAirport(idx); setEditingName(null); }}
                        className="p-0.5 text-slate-400 hover:text-red-500 rounded"
                        title="Remove airport"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer select-none hover:border-blue-300 transition-colors"
                      onClick={(e) => { e.stopPropagation(); startEditName(idx, stop); }}
                    >
                      <span className="font-mono font-bold text-blue-700 text-sm">{stop.airport.id}</span>
                      <span className="text-slate-400 text-sm">—</span>
                      <span className="text-sm text-slate-700">{stop.airport.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stop.airport.towered ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                        {stop.airport.towered ? 'TWR' : 'NT'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearAirport(idx); }}
                        className="p-0.5 text-slate-400 hover:text-red-500 rounded"
                        title="Remove airport"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                )}

                {/* Search input - always visible */}
                {editingName !== idx && (
                  <input
                    ref={el => inputRefs.current[idx] = el}
                    type="text"
                    value={getSearch(idx)}
                    onChange={(e) => handleSearch(e.target.value, idx)}
                    onFocus={() => { setActiveStop(idx); }}
                    onKeyDown={(e) => handleKeyDown(e, idx, stop)}
                    placeholder={stop.airport ? '' : 'Search airports...'}
                    className="flex-1 min-w-20 bg-transparent focus:outline-none text-sm"
                  />
                )}
              </div>

              {/* Search results dropdown */}
              {activeStop === idx && searchResults.length > 0 && editingName !== idx && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map((apt, ri) => (
                    <button key={apt.id} onClick={() => selectAirport(apt, idx)} className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-slate-100 last:border-0 ${ri === highlightIdx ? 'bg-blue-50' : 'hover:bg-blue-50'}`}>
                      <span className="font-mono font-bold text-blue-600">{apt.id}</span>
                      <span className="text-slate-700">{apt.name}</span>
                      <span className="text-slate-400 text-sm ml-auto">{apt.city}, {apt.state}</span>
                      {apt.towered ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Towered</span>
                      ) : (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">Non-Towered</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {stop.type === 'stop' && (
              <select
                value={stop.intention || 'full_stop'}
                onChange={(e) => updateStopIntention(idx, e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full_stop">Full Stop</option>
                <option value="touch_and_go">Touch & Go</option>
                <option value="taxi_back">Taxi Back</option>
                <option value="stop_and_go">Stop & Go</option>
              </select>
            )}
            {stop.type === 'stop' && (
              <button onClick={() => removeStop(idx)} className="p-1 text-slate-400 hover:text-red-500">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        <button onClick={addStop} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-2">
          <Plus size={16} /> Add intermediate stop
        </button>
      </div>
    </div>
  );
}
