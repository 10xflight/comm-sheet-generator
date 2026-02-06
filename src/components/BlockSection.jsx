import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Eye, EyeOff, Plus, ChevronDown, ChevronRight, Save, Check, Pencil, Trash2 } from 'lucide-react';
import { getSpacingClass } from '../utils/spacing';
import CallItem from './CallItem';
import TaxiRouteEditor from './TaxiRouteEditor';

export default function BlockSection({
  blockKey, blockId, blockName, contextLabel, target, isTowered,
  blockCalls, hidden, hiddenBlocks, collapsed, showHidden, hideAtc,
  editingId, editText, briefTitle, vars,
  onToggleCollapse, onToggleHiddenBlock, onAddCustomCall, onRenameBlock, onUpdateTarget,
  onEdit, onSave, onCancel, onChange, onToggleHidden, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd, draggedId, updateEditingCall, updateCall,
  onBlockDragStart, onBlockDragOver, onBlockDrop, onBlockDragEnd, isDraggingBlock,
  onCallDropToBlock, onSaveToMaster, savedToMaster, onResetToDefault, onAddTaxiCall, currentFlightType, newCallId, onSaveBlockToLibrary, onUnsaveBlockFromLibrary,
  isCustom, onDeleteBlock
}) {
  const [editingBlock, setEditingBlock] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [blockDropPos, setBlockDropPos] = useState(null);
  const [edgeDropZone, setEdgeDropZone] = useState(null); // 'top' or 'bottom'
  const [taxiRunway, setTaxiRunway] = useState('');
  const [taxiRoute, setTaxiRoute] = useState('');
  const [taxiOpen, setTaxiOpen] = useState(false);
  const [blockSaved, setBlockSaved] = useState(false);
  const blockEditorRef = useRef(null);

  // Click outside to close block editor
  useEffect(() => {
    if (!editingBlock) return;
    const handler = (e) => {
      if (blockEditorRef.current && !blockEditorRef.current.contains(e.target)) {
        // Don't close if clicking in the header
        if (e.target.closest('[data-header]')) return;
        saveBlockEdit();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingBlock, nameValue, targetValue]);

  const startEditBlock = (e) => {
    e.stopPropagation();
    setNameValue(blockName);
    setTargetValue(target || '');
    setEditingBlock(true);
  };

  const saveBlockEdit = () => {
    if (nameValue.trim() && nameValue.trim() !== blockName) {
      onRenameBlock(blockKey, nameValue.trim());
    }
    if (targetValue.trim() !== target && onUpdateTarget) {
      onUpdateTarget(blockKey, targetValue.trim());
    }
    setEditingBlock(false);
  };

  const isTaxiBlock = (blockId === 'taxi_out' || blockId === 'taxi_in') && isTowered;

  const hasCalls = blockCalls && blockCalls.length > 0;
  // Hidden blocks are always shown collapsed (greyed out), not completely hidden
  const isBlockHiddenAndCollapsed = hiddenBlocks.has(blockKey);
  const isCollapsed = collapsed.has(blockKey) || isBlockHiddenAndCollapsed;

  const isBlockHidden = hiddenBlocks.has(blockKey);
  const safeCalls = blockCalls || [];
  const visibleCount = safeCalls.filter(c => !hidden.has(c.id)).length;
  const hiddenCount = safeCalls.filter(c => hidden.has(c.id)).length;
  const blockHiddenCallIds = safeCalls.filter(c => hidden.has(c.id)).map(c => c.id);
  const isEmpty = safeCalls.length === 0;

  const unhideAllInBlock = (e) => {
    e.stopPropagation();
    if (hiddenCount > 0) onToggleHidden(null, blockHiddenCallIds);
  };

  const displayName = contextLabel ? `${blockName} ${contextLabel}` : blockName;

  const handleBlockDragOver = (e) => {
    // Only show block drop indicators when dragging blocks, not calls
    if (draggedId) return; // A call is being dragged, don't show block indicators
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setBlockDropPos(e.clientY < midY ? 'above' : 'below');
  };

  const handleCallDropToBlock = (e) => {
    e.preventDefault();
    if (onCallDropToBlock && draggedId) onCallDropToBlock(draggedId, blockKey);
  };

  return (
    <div
      className="relative"
      onDragOver={handleBlockDragOver}
      onDragLeave={() => setBlockDropPos(null)}
      onDrop={(e) => { setBlockDropPos(null); onBlockDrop(e, blockKey); }}
    >
      {blockDropPos === 'above' && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
          <div className="absolute -left-1 -top-1 w-3 h-3 bg-blue-500 rounded-full" />
        </div>
      )}

      <div className={`mb-4 ${isBlockHidden ? 'opacity-40' : ''} ${isEmpty ? 'opacity-50' : ''} ${isDraggingBlock ? 'opacity-30 scale-[0.98] bg-blue-50 border border-blue-200 border-dashed rounded-xl' : ''}`}>
        <div className="flex items-center gap-2">
          <div
            draggable
            onDragStart={(e) => onBlockDragStart(e, blockKey)}
            onDragEnd={onBlockDragEnd}
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </div>
          {editingBlock ? (
            <div ref={blockEditorRef} className="flex items-center gap-2 flex-1 py-2 px-2 bg-blue-50 rounded-xl" onClick={(e) => e.stopPropagation()}>
              {isCollapsed ? <ChevronRight size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
              <span className="text-xs text-slate-500">Name:</span>
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBlockEdit(); if (e.key === 'Escape') setEditingBlock(false); }}
                className="font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-0.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
              {contextLabel && <span className="text-slate-500 text-xs">{contextLabel}</span>}
              <span className="text-xs text-slate-500">{isTowered ? 'Towered' : 'Non-Towered'}:</span>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBlockEdit(); if (e.key === 'Escape') setEditingBlock(false); }}
                className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Target freq"
              />
              <button onClick={saveBlockEdit} className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">Save</button>
              <button onClick={() => setEditingBlock(false)} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">Cancel</button>
            </div>
          ) : (
            <button onClick={() => onToggleCollapse(blockKey)} className="flex items-center gap-2 flex-1 text-left py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors">
              {isCollapsed ? <ChevronRight size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
              <span className="font-bold text-slate-800">{displayName}</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{target}</span>
              <span className="text-xs text-slate-400 ml-auto">{visibleCount} calls</span>
              {isEmpty && <span className="text-xs text-slate-400 italic">Empty</span>}
              {hiddenCount > 0 && (
                <button
                  onClick={unhideAllInBlock}
                  className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
                  title="Click to show hidden calls in this block"
                >
                  {hiddenCount} hidden
                </button>
              )}
            </button>
          )}
          <button onClick={startEditBlock} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit block name & target">
            <Pencil size={16} />
          </button>
          <button onClick={() => onAddCustomCall(blockKey)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Add call">
            <Plus size={16} />
          </button>
          <button onClick={() => onToggleHiddenBlock(blockKey)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" title={isBlockHidden ? 'Show block' : 'Hide block'}>
            {isBlockHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          {onSaveBlockToLibrary && (
            <button
              onClick={() => {
                if (blockSaved) {
                  onUnsaveBlockFromLibrary && onUnsaveBlockFromLibrary(blockName);
                  setBlockSaved(false);
                } else {
                  onSaveBlockToLibrary(blockKey);
                  setBlockSaved(true);
                }
              }}
              className={`p-2 rounded-lg ${blockSaved ? 'text-green-500 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
              title={blockSaved ? 'Remove from library' : 'Save block to library'}
            >
              {blockSaved ? <Check size={16} /> : <Save size={16} />}
            </button>
          )}
          {isCustom && onDeleteBlock && (
            <button
              onClick={() => onDeleteBlock(blockKey)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              title="Delete block"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div
            className="ml-8 border-l-2 border-slate-200 pl-3 mt-2"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={handleCallDropToBlock}
          >
            {isTaxiBlock && (
              <div className="mb-3 rounded-xl border border-blue-200 overflow-hidden">
                <button
                  onClick={() => setTaxiOpen(!taxiOpen)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-200 transition-colors"
                >
                  {taxiOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Taxi Route Generator
                </button>
                {taxiOpen && (
                  <div className="bg-blue-50 p-4">
                    <p className="text-xs text-slate-500 mb-2">Enter runway and taxi route shorthand, then click "Add" to insert the readback.</p>
                    <TaxiRouteEditor
                      runway={taxiRunway}
                      route={taxiRoute}
                      onChangeRunway={setTaxiRunway}
                      onChangeRoute={setTaxiRoute}
                      callSignAbbr={vars?.CS_Abbr || ''}
                      onAddToSheet={(text) => onAddTaxiCall && onAddTaxiCall(blockKey, text)}
                    />
                  </div>
                )}
              </div>
            )}
            {!hasCalls && !isTaxiBlock && (
              <button
                onClick={() => onAddCustomCall(blockKey)}
                className="w-full text-left text-xs text-slate-400 italic py-3 pl-2 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                + Add a call to get started...
              </button>
            )}
            {/* Top edge drop zone - always "separate" */}
            {hasCalls && (
              <div
                className="h-3 -mt-1 relative"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setEdgeDropZone('top'); }}
                onDragLeave={() => setEdgeDropZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEdgeDropZone(null);
                  // Find first call that isn't the one being dragged
                  const targetCall = safeCalls.find(c => c.id !== draggedId);
                  if (targetCall && draggedId) onDrop(e, targetCall.id, 'above', false);
                }}
              >
                {edgeDropZone === 'top' && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
                    <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
                    <span className="absolute top-1 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
                  </div>
                )}
              </div>
            )}
            {(() => {
              // Find the dragged call's group to pass to CallItems
              const draggedCall = draggedId ? safeCalls.find(c => c.id === draggedId) : null;
              const draggedCallGroup = draggedCall?.group || null;
              return safeCalls.map((call, idx) => {
              const prevCall = idx > 0 ? blockCalls[idx - 1] : null;
              const nextCall = idx < safeCalls.length - 1 ? safeCalls[idx + 1] : null;
              const spacingClass = getSpacingClass(call, prevCall);
              // Check if grouped with prev/next (same explicit group)
              const isGroupedWithPrev = prevCall && call.group && prevCall.group && call.group === prevCall.group;
              const isGroupedWithNext = nextCall && call.group && nextCall.group && call.group === nextCall.group;
              return (
                <CallItem
                  key={call.id}
                  call={call}
                  draggedCallGroup={draggedCallGroup}
                  isHidden={hidden.has(call.id)}
                  isEditing={editingId === call.id}
                  editText={editText}
                  briefTitle={editingId === call.id ? briefTitle : null}
                  onEdit={onEdit}
                  onSave={onSave}
                  onCancel={onCancel}
                  onChange={(data) => {
                    if (editingId === call.id) updateEditingCall(data);
                    else updateCall(call.id, data);
                  }}
                  onToggleHidden={onToggleHidden}
                  onDelete={onDelete}
                  vars={call._legVars || vars}
                  showHidden={showHidden}
                  hideAtc={hideAtc}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  isDragging={draggedId === call.id}
                  spacingClass={spacingClass}
                  onSaveToMaster={onSaveToMaster}
                  savedToMaster={savedToMaster}
                  onResetToDefault={call._hasOverride ? onResetToDefault : null}
                  currentFlightType={currentFlightType}
                  isNew={newCallId === call.id}
                  isGroupedWithPrev={isGroupedWithPrev}
                  isGroupedWithNext={isGroupedWithNext}
                />
              );
            });
            })()}
            {/* Bottom edge drop zone - always "separate" */}
            {hasCalls && (
              <div
                className="h-3 -mb-1 relative"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setEdgeDropZone('bottom'); }}
                onDragLeave={() => setEdgeDropZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEdgeDropZone(null);
                  // Find last call that isn't the one being dragged
                  const targetCall = [...safeCalls].reverse().find(c => c.id !== draggedId);
                  if (targetCall && draggedId) onDrop(e, targetCall.id, 'below', false);
                }}
              >
                {edgeDropZone === 'bottom' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
                    <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
                    <span className="absolute -top-5 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {blockDropPos === 'below' && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
          <div className="absolute -left-1 -top-1 w-3 h-3 bg-blue-500 rounded-full" />
        </div>
      )}
    </div>
  );
}
