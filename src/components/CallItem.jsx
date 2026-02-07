import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Eye, EyeOff, Trash2, Save, Check } from 'lucide-react';
import { subVars } from '../utils/callSign';

const APPLIES_OPTIONS = [
  { key: 'vfr_t', label: 'VFR Towered' },
  { key: 'vfr_nt', label: 'VFR Non-Towered' },
  { key: 'ifr_t', label: 'IFR Towered' },
  { key: 'ifr_nt', label: 'IFR Non-Towered' },
];

export default function CallItem({
  call, isHidden, isEditing, editText, briefTitle, onEdit, onSave, onCancel, onChange,
  onToggleHidden, onDelete, vars, showHidden, hideAtc, onDragStart, onDragOver,
  onDrop, onDragEnd, isDragging, spacingClass, onSaveToMaster, savedToMaster, onResetToDefault, currentFlightType, isNew,
  isGroupedWithPrev, isGroupedWithNext, draggedCallGroup
}) {
  const [dropPosition, setDropPosition] = useState(null);
  const [showMasterPicker, setShowMasterPicker] = useState(false);
  const [masterApplies, setMasterApplies] = useState([]);
  const editorRef = useRef(null);

  // Click outside to close editor (but not when clicking header buttons like Key)
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        // Don't close if clicking in the header (Key button, etc.)
        if (e.target.closest('[data-header]')) return;
        onSave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditing, onSave]);

  if (call.type === 'atc' && hideAtc) return null;

  const isAtc = call.type === 'atc';
  const isNote = call.type === 'note';
  const isBrief = call.type === 'brief';
  const isUserAdded = call.userAdded === true;

  const renderText = () => {
    let text = subVars(call.text || '', vars);
    text = text.replace(/\[([^\]]+)\]/g, '<strong>[$1]</strong>');
    text = text.replace(/\{\{(\w+)\}\}/g, '<span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">$1</span>');
    // For briefs, insert "(Modify as Needed)" after the first line title (e.g. after "Brief:")
    if (isBrief && text.includes('\n')) {
      const nlIdx = text.indexOf('\n');
      text = text.slice(0, nlIdx) + ' <span class="text-amber-500 font-normal text-xs italic">(Modify as Needed)</span>' + text.slice(nlIdx);
    } else if (isBrief) {
      text += ' <span class="text-amber-500 font-normal text-xs italic">(Modify as Needed)</span>';
    }
    text = text.replace(/\n/g, '<br/>');
    return text;
  };

  const handleDragOver = (e) => {
    if (isDragging) return; // Don't show indicator on the item being dragged
    e.preventDefault();
    e.stopPropagation(); // Prevent block-level drag handlers from interfering
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // Check if dragged and target are already in the same group
    const alreadySameGroup = draggedCallGroup && call.group && draggedCallGroup === call.group;

    // Proximity-based grouping:
    // - Over the call (middle 40%) = GROUP (green, tight)
    // - Near edges (outer 30% each side, where gaps are) = SEPARATE (blue, spaced)
    const edgeZone = rect.height * 0.3; // outer 30% on each edge = gap zone

    if (e.clientY < midY) {
      // Above the midpoint - inserting ABOVE this call
      const distFromTop = e.clientY - rect.top;
      // If already in same group, always stay grouped (no blue separate option)
      if (alreadySameGroup) {
        setDropPosition('above-same');
      } else {
        // Near top edge = in the gap = SEPARATE, away from edge = GROUP
        setDropPosition(distFromTop < edgeZone ? 'above-new' : 'above-same');
      }
    } else {
      // Below the midpoint - inserting BELOW this call
      const distFromBottom = rect.bottom - e.clientY;
      // If already in same group, always stay grouped (no blue separate option)
      if (alreadySameGroup) {
        setDropPosition('below-same');
      } else {
        // Near bottom edge = in the gap = SEPARATE, away from edge = GROUP
        setDropPosition(distFromBottom < edgeZone ? 'below-new' : 'below-same');
      }
    }
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e) => {
    e.stopPropagation(); // Prevent block-level drop handlers from interfering
    const pos = dropPosition;
    setDropPosition(null);
    // Pass position and whether to group with adjacent call
    const groupWithTarget = pos === 'above-same' || pos === 'below-same';
    const verticalPos = pos?.startsWith('below') ? 'below' : 'above';
    onDrop(e, call.id, verticalPos, groupWithTarget);
  };

  if (isEditing) {
    return (
      <div ref={editorRef} className={`p-4 bg-blue-50 border-2 border-blue-300 rounded-xl ${spacingClass}`}>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-slate-500">Type:</label>
          <select
            value={call.type}
            onChange={(e) => onChange({ ...call, type: e.target.value })}
            className="text-xs border border-slate-300 rounded px-2 py-1"
          >
            <option value="radio">Radio</option>
            <option value="atc">ATC Response</option>
            <option value="note">Note</option>
            <option value="brief">Brief</option>
          </select>
        </div>
        {briefTitle && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-bold text-slate-700">
            {briefTitle}
          </div>
        )}
        <textarea
          value={editText}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Enter call text here..."
          className="w-full p-3 text-sm border border-slate-300 rounded-lg resize-none min-h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-slate-300 placeholder:italic"
          autoFocus
        />
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <button onClick={onSave} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-medium">Save & Close</button>
          {onSaveToMaster && !showMasterPicker && (
            <button
              onClick={() => {
                if (savedToMaster) return;
                setMasterApplies(currentFlightType ? [currentFlightType] : [...(call.applies || [])]);
                setShowMasterPicker(true);
              }}
              disabled={savedToMaster}
              className={`px-4 py-2 text-sm rounded-lg font-medium flex items-center gap-1 ${
                savedToMaster
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {savedToMaster ? <><Check size={14} /> Saved to Master</> : <><Save size={14} /> Save to Master</>}
            </button>
          )}
          <button onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 font-medium">Close</button>
          {onResetToDefault && (
            <button onClick={onResetToDefault} className="px-4 py-2 text-sm rounded-lg font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 ml-auto">
              Reset to Default
            </button>
          )}
        </div>
        {showMasterPicker && !savedToMaster && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-slate-600 mb-2 font-medium">Save to which flight types?</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {APPLIES_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setMasterApplies(prev => prev.includes(opt.key) ? prev.filter(a => a !== opt.key) : [...prev, opt.key])}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                    masterApplies.includes(opt.key) ? 'bg-green-500 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onSaveToMaster(masterApplies); setShowMasterPicker(false); }}
                disabled={masterApplies.length === 0}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1 ${
                  masterApplies.length > 0 ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check size={12} /> Confirm Save
              </button>
              <button onClick={() => setShowMasterPicker(false)} className="px-3 py-1.5 text-xs bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Visual indicator for grouped calls
  const isGrouped = isGroupedWithPrev || isGroupedWithNext;

  return (
    <div id={`call-${call.id}`} className={`relative ${isNew ? 'animate-highlight-fade' : ''}`}>
      {/* Grouped indicator - subtle left line connecting grouped calls */}
      {isGrouped && (
        <div className="absolute left-1 w-0.5 bg-emerald-300/60 rounded-full" style={{
          top: isGroupedWithPrev ? '-0.5rem' : '0.5rem',
          bottom: isGroupedWithNext ? '-0.5rem' : '0.5rem',
        }} />
      )}

      {/* Above - same group (tight spacing): hugs the call, green */}
      {dropPosition === 'above-same' && (
        <div className="absolute top-0 left-8 right-0 h-0.5 bg-emerald-400 z-10 rounded-full shadow-sm shadow-emerald-400/50">
          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          <span className="absolute top-1 left-0 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">group</span>
        </div>
      )}
      {/* Above - new group (more spacing): in the gap, blue */}
      {dropPosition === 'above-new' && (
        <div className="absolute -top-3 left-0 right-0 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
          <span className="absolute -top-5 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
        </div>
      )}

      <div
        draggable
        onDragStart={(e) => onDragStart(e, call.id)}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex items-start gap-2 py-2 px-3 rounded-xl transition-all ${spacingClass} ${isHidden ? 'opacity-30 bg-slate-100' : 'hover:bg-slate-50'} ${isAtc ? 'justify-end' : ''} ${isDragging ? 'opacity-30 scale-[0.98] bg-blue-50 border border-blue-200 border-dashed' : ''}`}
      >
        {!isAtc && (
          <div className="mt-1.5 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={14} />
          </div>
        )}

        {isAtc && (
          <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <div className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} />
            </div>
            <button onClick={() => onToggleHidden(call.id)} className={`p-1.5 rounded-lg ${isHidden ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title={isHidden ? 'Show' : 'Hide'}>
              {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {isUserAdded && (
              <button onClick={() => onDelete(call.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        <div
          onClick={() => onEdit(call.id)}
          className={`text-sm cursor-pointer leading-relaxed ${
            isAtc ? 'italic text-slate-500 text-right max-w-[75%]' :
            isBrief ? 'bg-amber-50 border border-amber-200 p-4 rounded-xl flex-1' :
            isNote ? 'text-slate-700' :
            'text-slate-700 flex-1'
          }`}
        >
          {isNote && <span className="text-slate-400 font-medium mr-2 text-xs uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">NOTE</span>}
          {call.text ? (
            <span dangerouslySetInnerHTML={{ __html: renderText() }} />
          ) : (
            <span className="text-slate-300 italic">Click to edit...</span>
          )}
          {call._hasOverride && <span className="text-amber-500 text-[10px] font-medium bg-amber-50 px-1.5 py-0.5 rounded ml-2">modified</span>}
        </div>

        {!isAtc && (
          <div className={`flex items-center gap-1 ml-auto shrink-0 transition-opacity ${isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button onClick={() => onToggleHidden(call.id)} className={`p-1.5 rounded-lg ${isHidden ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title={isHidden ? 'Show' : 'Hide'}>
              {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {isUserAdded && (
              <button onClick={() => onDelete(call.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Below - same group (tight spacing): hugs the call, green */}
      {dropPosition === 'below-same' && (
        <div className="absolute bottom-0 left-8 right-0 h-0.5 bg-emerald-400 z-10 rounded-full shadow-sm shadow-emerald-400/50">
          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          <span className="absolute -top-5 left-0 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">group</span>
        </div>
      )}
      {/* Below - new group (more spacing): in the gap, blue */}
      {dropPosition === 'below-new' && (
        <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
          <span className="absolute top-1 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
        </div>
      )}
    </div>
  );
}
