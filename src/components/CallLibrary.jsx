import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, EyeOff, X } from 'lucide-react';
import { BLOCKS, BLOCK_ORDER } from '../data/blocks';
import { getPermanentHides, getUserBlocks } from '../data/userStore';

export default function CallLibrary({ radioCalls, libSearch, onLibSearchChange, onAddFromLib, onAddBlockFromLib, onClose }) {
  const [expanded, setExpanded] = useState(new Set());
  const permanentHides = getPermanentHides();

  const filtered = radioCalls.filter(c =>
    !libSearch ||
    c.text?.toLowerCase().includes(libSearch.toLowerCase()) ||
    c.block?.toLowerCase().includes(libSearch.toLowerCase())
  );

  const libByBlock = filtered.reduce((acc, c) => {
    (acc[c.block] = acc[c.block] || []).push(c);
    return acc;
  }, {});

  const toggleBlock = (blockId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  return (
    <div className="w-80 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-4 h-fit sticky top-[10rem] max-h-[calc(100vh-11rem)] overflow-hidden flex flex-col shrink-0 z-20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Search size={18} /> Call Library
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" title="Close library">
            <X size={16} />
          </button>
        )}
      </div>
      <input
        type="text"
        value={libSearch}
        onChange={(e) => onLibSearchChange(e.target.value)}
        placeholder="Search calls..."
        className="w-full px-3 py-2 mb-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-[10px] text-slate-400 mb-2">Click any call to add it to the current sheet</p>
      <div className="flex-1 overflow-y-auto">
        {BLOCK_ORDER.map(blockId => {
          const blockCalls = libByBlock[blockId];
          if (!blockCalls?.length) return null;
          const isExpanded = expanded.has(blockId);
          const hiddenCount = blockCalls.filter(c => permanentHides.has(c.id)).length;
          return (
            <div key={blockId} className="mb-2">
              <button
                onClick={() => toggleBlock(blockId)}
                className="flex items-center gap-1 w-full text-left text-xs font-bold text-slate-500 uppercase tracking-wider py-1.5 px-1 hover:bg-slate-50 rounded sticky top-0 bg-white"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {BLOCKS[blockId]?.name}
                <span className="font-normal text-slate-400 ml-auto">{blockCalls.length}</span>
                {hiddenCount > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500 font-normal ml-1" title={`${hiddenCount} permanently hidden`}>
                    <EyeOff size={10} />{hiddenCount}
                  </span>
                )}
              </button>
              {isExpanded && blockCalls.map(call => {
                const isHidden = permanentHides.has(call.id);
                return (
                  <div key={call.id} className={`flex items-center gap-1 ${isHidden ? 'opacity-40' : ''}`}>
                    <button
                      onClick={() => onAddFromLib(call)}
                      className="flex-1 text-left p-2 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-transparent hover:border-blue-200 mb-1 transition-all cursor-pointer"
                    >
                      {call.text?.substring(0, 80)}{call.text?.length > 80 ? '...' : ''}
                    </button>
                    {isHidden && <EyeOff size={10} className="text-amber-400 shrink-0 mr-1" />}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* User-saved custom blocks */}
        {(() => {
          const userBlocks = getUserBlocks();
          if (!userBlocks.length) return null;
          return (
            <>
              <div className="border-t border-slate-200 mt-3 pt-3 mb-2">
                <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">User Blocks</span>
              </div>
              {userBlocks.map(ub => {
                const ubKey = `ub_${ub.id}`;
                const isExpanded = expanded.has(ubKey);
                const callCount = ub.calls?.length || 0;
                return (
                  <div key={ub.id} className="mb-2">
                    <button
                      onClick={() => toggleBlock(ubKey)}
                      className="flex items-center gap-1 w-full text-left text-xs font-bold text-green-700 py-1.5 px-1 hover:bg-green-50 rounded sticky top-0 bg-white"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {ub.name}
                      <span className="font-normal text-slate-400 ml-auto">{callCount}</span>
                    </button>
                    {isExpanded && (
                      <>
                        {ub.calls && ub.calls.length > 0 ? ub.calls.map(call => (
                          <div key={call.id} className="flex items-center gap-1">
                            <button
                              onClick={() => onAddFromLib({ ...call, block: 'custom' })}
                              className="flex-1 text-left p-2 text-xs text-slate-600 hover:bg-green-50 hover:text-green-700 rounded-lg border border-transparent hover:border-green-200 mb-1 transition-all cursor-pointer"
                            >
                              <span className={`text-[9px] uppercase font-semibold mr-1.5 px-1 py-0.5 rounded ${call.type === 'atc' ? 'bg-purple-50 text-purple-500' : call.type === 'note' ? 'bg-slate-100 text-slate-400' : call.type === 'brief' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>{call.type || 'radio'}</span>
                              {call.text?.substring(0, 70)}{call.text?.length > 70 ? '...' : ''}
                            </button>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-400 italic px-2 py-1">No calls saved in this block</p>
                        )}
                        <button
                          onClick={() => onAddBlockFromLib && onAddBlockFromLib(ub)}
                          className="w-full text-left px-2 py-1.5 text-[10px] text-green-600 hover:bg-green-50 rounded font-medium"
                        >
                          + Add entire block to sheet
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>
    </div>
  );
}
