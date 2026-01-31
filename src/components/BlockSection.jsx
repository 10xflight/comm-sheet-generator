import React, { useState } from 'react';
import { GripVertical, Eye, EyeOff, Plus, ChevronDown, ChevronRight, Save, Check } from 'lucide-react';
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
  onCallDropToBlock, onSaveToMaster, savedToMaster, onResetToDefault, onAddTaxiCall, currentFlightType, newCallId, onSaveBlockToLibrary, onUnsaveBlockFromLibrary
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [blockDropPos, setBlockDropPos] = useState(null);
  const [taxiRunway, setTaxiRunway] = useState('');
  const [taxiRoute, setTaxiRoute] = useState('');
  const [taxiOpen, setTaxiOpen] = useState(false);
  const [blockSaved, setBlockSaved] = useState(false);

  const isTaxiBlock = (blockId === 'taxi_out' || blockId === 'taxi_in') && isTowered;

  if (hiddenBlocks.has(blockKey) && !showHidden) return null;
  const hasCalls = blockCalls && blockCalls.length > 0;
  const isCollapsed = collapsed.has(blockKey);

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

  const startEditName = (e) => {
    e.stopPropagation();
    setNameValue(blockName);
    setEditingName(true);
  };

  const saveName = () => {
    if (nameValue.trim() && nameValue.trim() !== blockName) {
      onRenameBlock(blockKey, nameValue.trim());
    }
    setEditingName(false);
  };

  const startEditTarget = (e) => {
    e.stopPropagation();
    setTargetValue(target || '');
    setEditingTarget(true);
  };

  const saveTarget = () => {
    if (targetValue.trim() !== target && onUpdateTarget) {
      onUpdateTarget(blockKey, targetValue.trim());
    }
    setEditingTarget(false);
  };

  const handleBlockDragOver = (e) => {
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
          <button onClick={() => onToggleCollapse(blockKey)} className="flex items-center gap-2 flex-1 text-left py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors">
            {isCollapsed ? <ChevronRight size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            {editingName ? (
              <span className="flex items-center gap-1">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {contextLabel && <span className="font-bold text-slate-500 text-sm">{contextLabel}</span>}
              </span>
            ) : (
              <span className="font-bold text-slate-800 hover:text-blue-600" onClick={startEditName} title="Click to edit name">{displayName}</span>
            )}
            {editingTarget ? (
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                onBlur={saveTarget}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-slate-500 bg-white border border-blue-300 rounded px-2 py-0.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:text-blue-600" onClick={startEditTarget} title="Click to edit">{target}</span>
            )}
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
          <button onClick={() => onToggleHiddenBlock(blockKey)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" title={isBlockHidden ? 'Show block' : 'Hide block'}>
            {isBlockHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={() => onAddCustomCall(blockKey)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Add call">
            <Plus size={16} />
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
            {safeCalls.map((call, idx) => {
              const prevCall = idx > 0 ? blockCalls[idx - 1] : null;
              const spacingClass = getSpacingClass(call, prevCall);
              return (
                <CallItem
                  key={call.id}
                  call={call}
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
                />
              );
            })}
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
