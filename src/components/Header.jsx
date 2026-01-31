import React, { useState } from 'react';
import { Undo, Redo, Menu, Download, BookOpen, Save, SaveAll, FolderOpen, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { HeadsetIcon } from './Icons';

export default function Header({ historyLen, redoLen, showLib, hideAtc, showRefKey, onUndo, onRedo, onToggleLib, onToggleAtc, onToggleRefKey, onExport, onSave, onSaveAs, onLoad, hasSheet, currentProjectId }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="max-w-5xl mx-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 p-5 mb-6 sticky top-4 z-30">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <HeadsetIcon size={30} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Comm Sheet Generator <span className="text-xs font-medium text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md align-middle">(BETA)</span>
            </h1>
            <p className="text-sm text-slate-500">Radio communication practice tool</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onUndo} disabled={!historyLen} className={`p-2.5 rounded-xl transition-all ${historyLen ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300'}`} title="Undo (Ctrl+Z)">
            <Undo size={20} />
          </button>
          <button onClick={onRedo} disabled={!redoLen} className={`p-2.5 rounded-xl transition-all ${redoLen ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300'}`} title="Redo (Ctrl+Y)">
            <Redo size={20} />
          </button>
          <button onClick={onToggleRefKey} className={`px-3 py-2 rounded-xl transition-all text-xs font-bold ${showRefKey ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`} title="Toggle Reference Key">
            Key
          </button>
          <button onClick={onToggleLib} className={`p-2.5 rounded-xl transition-all ${showLib ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`} title="Call Library">
            <Menu size={20} />
          </button>
          <button onClick={onToggleAtc} className={`px-3 py-2 rounded-xl transition-all text-xs font-bold ${!hideAtc ? 'bg-purple-100 text-purple-600' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`} title={hideAtc ? "Show ATC Responses" : "Hide ATC Responses"}>
            ATC
          </button>
          <button onClick={() => { window.location.hash = '#/library'; }} className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-all" title="Library Editor">
            <BookOpen size={20} />
          </button>
          {hasSheet && (
            <>
              <button onClick={onLoad} className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-all" title="Load saved sheet">
                <FolderOpen size={20} />
              </button>
              <button onClick={onSave} className={`p-2.5 rounded-xl transition-all ${currentProjectId ? 'text-green-600 hover:bg-green-50' : 'text-slate-600 hover:bg-slate-100'}`} title={currentProjectId ? "Save (overwrite)" : "Save"}>
                <Save size={20} />
              </button>
              {currentProjectId && (
                <button onClick={onSaveAs} className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-all" title="Save as new copy">
                  <SaveAll size={20} />
                </button>
              )}
            </>
          )}
          {!hasSheet && (
            <button onClick={onLoad} className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-all" title="Load saved sheet">
              <FolderOpen size={20} />
            </button>
          )}
          <button onClick={onExport} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg text-sm font-medium">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Collapsible instructions */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="flex items-center gap-1.5 mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        {showInfo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <HelpCircle size={13} />
        What is this?
      </button>

      {showInfo && (
        <div className="mt-3 p-4 bg-slate-50 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100">
          <p className="mb-3">
            A practice tool to help you prepare for radio communications before your next flight. Enter your route and generate a customized script of virtually every radio call you may encounter — then rehearse until it feels natural.
          </p>
          <p className="font-medium text-slate-700 mb-1.5">Use it to:</p>
          <ul className="list-disc list-inside space-y-1 mb-3 text-slate-600">
            <li>Generate a practice comm sheet for your route, or build one from scratch</li>
            <li>Rehearse radio calls, briefs, and ATC exchanges before you fly</li>
            <li>Add reminder notes for ATIS, run-up checks, and personal checklists</li>
            <li>Save templates for routes you fly regularly</li>
            <li>Export and read aloud until you feel confident and prepared</li>
          </ul>
          <p className="mb-3">
            <strong>[Brackets]</strong> indicate information you'll fill in as you read aloud — runway numbers, frequencies, altitudes, etc. Practice saying each call and think through every situation you may encounter.
          </p>
          <p className="text-slate-500 text-xs">
            Click any call to edit. Drag to reorder. Hide what you don't need.
          </p>
        </div>
      )}

      {showRefKey && (
        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="text-xs font-semibold text-slate-600 mb-2">Variable Reference Key</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {[
              { code: '{{CS_Full}}', desc: 'Full call sign' },
              { code: '{{CS_Abbr}}', desc: 'Abbreviated call sign' },
              { code: '{{Dep_Name}}', desc: 'Departure airport name' },
              { code: '{{Dep_Abridged}}', desc: 'Departure short name' },
              { code: '{{Dep_Traffic}}', desc: 'Departure traffic freq' },
              { code: '{{Arr_Name}}', desc: 'Arrival airport name' },
              { code: '{{Arr_Abridged}}', desc: 'Arrival short name' },
              { code: '{{Arr_Traffic}}', desc: 'Arrival traffic freq' },
              { code: '[##]', desc: 'Runway number' },
              { code: '[###.##]', desc: 'Frequency' },
              { code: '[####]', desc: 'Altitude' },
              { code: '[A-Z]', desc: 'ATIS identifier' },
            ].map(r => (
              <div key={r.code} className="flex items-center gap-2 text-[11px]">
                <code className="bg-white text-blue-700 px-1.5 py-0.5 rounded font-mono shrink-0 text-[10px]">{r.code}</code>
                <span className="text-slate-500">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
