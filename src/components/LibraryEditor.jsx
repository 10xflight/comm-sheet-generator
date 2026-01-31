import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, RotateCcw, ChevronDown, ChevronRight, Save, GripVertical, AlertTriangle, Download, PlusCircle, Upload, FileDown, Star, Redo } from 'lucide-react';
import { BLOCKS, BLOCK_ORDER } from '../data/blocks';
import { loadRadioCalls, getRadioCalls } from '../data/radioCalls';
import {
  getCallOverrides, setCallOverride, removeCallOverride,
  getUserCalls, addUserCall, deleteUserCall, updateUserCall,
  getPermanentHides, setPermanentHide,
  getSeqOverrides, setSeqOverrides,
  getBlockOverrides, setBlockOverride,
  restoreAllDefaults, formatSeq,
  addPendingCall,
} from '../data/userStore';
import { exportToPdf } from '../utils/exportPdf';
import { exportToDocx } from '../utils/exportDocx';
import { subVars } from '../utils/callSign';
import { saveAs } from 'file-saver';

const TYPE_COLORS = {
  radio: 'bg-blue-100 text-blue-700',
  atc: 'bg-purple-100 text-purple-700',
  note: 'bg-slate-100 text-slate-600',
  brief: 'bg-amber-100 text-amber-700',
};

const APPLIES_OPTIONS = [
  { key: 'vfr_nt', label: 'VFR Non-Towered' },
  { key: 'vfr_t', label: 'VFR Towered' },
  { key: 'ifr_nt', label: 'IFR Non-Towered' },
  { key: 'ifr_t', label: 'IFR Towered' },
];

const REFERENCE_KEY = [
  { code: '{{CS_Full}}', desc: 'Full call sign (e.g., Skyhawk 12345)' },
  { code: '{{CS_Abbr}}', desc: 'Abbreviated call sign (e.g., Skyhawk 345)' },
  { code: '{{Dep_Name}}', desc: 'Departure airport name' },
  { code: '{{Dep_Abridged}}', desc: 'Departure airport short name' },
  { code: '{{Dep_Traffic}}', desc: 'Departure traffic frequency name' },
  { code: '{{Arr_Name}}', desc: 'Arrival airport name' },
  { code: '{{Arr_Abridged}}', desc: 'Arrival airport short name' },
  { code: '{{Arr_Traffic}}', desc: 'Arrival traffic frequency name' },
  { code: '[##]', desc: 'Runway number (user fills in)' },
  { code: '[###.##]', desc: 'Frequency (user fills in)' },
  { code: '[####]', desc: 'Altitude (user fills in)' },
  { code: '[A-Z]', desc: 'ATIS identifier (user fills in)' },
  { code: '[###/##]', desc: 'Wind direction/speed (user fills in)' },
];

// Custom blocks helpers
function getCustomBlocks() {
  try {
    return JSON.parse(localStorage.getItem('csg_customBlocks') || '[]');
  } catch { return []; }
}

function addCustomBlock(block) {
  const blocks = getCustomBlocks();
  blocks.push(block);
  localStorage.setItem('csg_customBlocks', JSON.stringify(blocks));
  return blocks;
}

function deleteCustomBlock(id) {
  const blocks = getCustomBlocks().filter(b => b.id !== id);
  localStorage.setItem('csg_customBlocks', JSON.stringify(blocks));
  return blocks;
}

export default function LibraryEditor() {
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState('');
  const [editApplies, setEditApplies] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [seqOverrides, setSeqOverridesState] = useState({});
  const [blockOverrides, setBlockOverridesState] = useState({});
  const [userCalls, setUserCallsState] = useState([]);
  const [permanentHides, setPermanentHidesState] = useState(new Set());
  const [addingToBlock, setAddingToBlock] = useState(null);
  const [newCallText, setNewCallText] = useState('');
  const [newCallType, setNewCallType] = useState('radio');
  const [filterText, setFilterText] = useState('');
  const [filterApplies, setFilterApplies] = useState('all');
  const [draggedCallId, setDraggedCallId] = useState(null);
  const [dragBlockId, setDragBlockId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  const [showKey, setShowKey] = useState(() => localStorage.getItem('csg_showRefKey') === 'true');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [addedToSheet, setAddedToSheet] = useState(null);
  // Block editing - inline on click
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [editBlockTargetT, setEditBlockTargetT] = useState('');
  const [editBlockTargetNT, setEditBlockTargetNT] = useState('');
  // Undo / Redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  // Custom blocks
  const [customBlocks, setCustomBlocks] = useState(() => getCustomBlocks());
  const [showAddCustomBlock, setShowAddCustomBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockTargetT, setNewBlockTargetT] = useState('');
  const [newBlockTargetNT, setNewBlockTargetNT] = useState('');
  // Load library confirm
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [pendingLibraryData, setPendingLibraryData] = useState(null);
  // Default library
  const [isDefault, setIsDefault] = useState(() => !!localStorage.getItem('csg_defaultLibrary'));

  const fileInputRef = useRef(null);

  const captureCurrentState = () => ({
    overrides: { ...getCallOverrides() },
    seqOverrides: { ...getSeqOverrides() },
    blockOverrides: { ...getBlockOverrides() },
    userCalls: [...getUserCalls()],
    permanentHides: new Set(getPermanentHides()),
  });

  const pushUndo = () => {
    setUndoStack(prev => [...prev.slice(-19), captureCurrentState()]);
    // Clear redo stack on new action
    setRedoStack([]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    // Push current state to redo stack
    setRedoStack(rs => [...rs.slice(-19), captureCurrentState()]);
    setUndoStack(s => s.slice(0, -1));
    // Restore to localStorage
    localStorage.setItem('csg_callOverrides', JSON.stringify(prev.overrides));
    localStorage.setItem('csg_seqOverrides', JSON.stringify(prev.seqOverrides));
    localStorage.setItem('csg_blockOverrides', JSON.stringify(prev.blockOverrides));
    localStorage.setItem('csg_userCalls', JSON.stringify(prev.userCalls));
    localStorage.setItem('csg_permanentHides', JSON.stringify([...prev.permanentHides]));
    refresh();
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    // Push current state to undo stack (without clearing redo)
    setUndoStack(us => [...us.slice(-19), captureCurrentState()]);
    setRedoStack(rs => rs.slice(0, -1));
    localStorage.setItem('csg_callOverrides', JSON.stringify(next.overrides));
    localStorage.setItem('csg_seqOverrides', JSON.stringify(next.seqOverrides));
    localStorage.setItem('csg_blockOverrides', JSON.stringify(next.blockOverrides));
    localStorage.setItem('csg_userCalls', JSON.stringify(next.userCalls));
    localStorage.setItem('csg_permanentHides', JSON.stringify([...next.permanentHides]));
    refresh();
  };

  const refresh = () => {
    setOverrides(getCallOverrides());
    setSeqOverridesState(getSeqOverrides());
    setBlockOverridesState(getBlockOverrides());
    setUserCallsState(getUserCalls());
    setPermanentHidesState(getPermanentHides());
    setCustomBlocks(getCustomBlocks());
  };

  useEffect(() => {
    loadRadioCalls().then(() => {
      refresh();
      setLoaded(true);
    });
  }, []);

  // Persist showKey
  useEffect(() => {
    localStorage.setItem('csg_showRefKey', showKey ? 'true' : 'false');
  }, [showKey]);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack]);

  // Save Library to JSON file
  const saveLibraryToFile = () => {
    const data = {
      overrides: getCallOverrides(),
      userCalls: getUserCalls(),
      permanentHides: [...getPermanentHides()],
      seqOverrides: getSeqOverrides(),
      blockOverrides: getBlockOverrides(),
      customBlocks: getCustomBlocks(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'comm-sheet-library.json');
  };

  // Load Library from JSON file
  const handleLoadLibraryFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setPendingLibraryData(data);
        setShowLoadConfirm(true);
      } catch {
        alert('Invalid library file.');
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const applyLibraryData = (data) => {
    pushUndo();
    if (data.overrides) localStorage.setItem('csg_callOverrides', JSON.stringify(data.overrides));
    if (data.userCalls) localStorage.setItem('csg_userCalls', JSON.stringify(data.userCalls));
    if (data.permanentHides) localStorage.setItem('csg_permanentHides', JSON.stringify(data.permanentHides));
    if (data.seqOverrides) localStorage.setItem('csg_seqOverrides', JSON.stringify(data.seqOverrides));
    if (data.blockOverrides) localStorage.setItem('csg_blockOverrides', JSON.stringify(data.blockOverrides));
    if (data.customBlocks) localStorage.setItem('csg_customBlocks', JSON.stringify(data.customBlocks));
    refresh();
    setShowLoadConfirm(false);
    setPendingLibraryData(null);
  };

  // Set as Default
  const toggleDefault = () => {
    if (isDefault) {
      localStorage.removeItem('csg_defaultLibrary');
      setIsDefault(false);
    } else {
      const data = {
        overrides: getCallOverrides(),
        userCalls: getUserCalls(),
        permanentHides: [...getPermanentHides()],
        seqOverrides: getSeqOverrides(),
        blockOverrides: getBlockOverrides(),
        customBlocks: getCustomBlocks(),
      };
      localStorage.setItem('csg_defaultLibrary', JSON.stringify(data));
      setIsDefault(true);
    }
  };

  // Add custom block
  const handleAddCustomBlock = () => {
    if (!newBlockName.trim()) return;
    const id = `CUSTOM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const blocks = addCustomBlock({ id, name: newBlockName.trim(), targetTowered: newBlockTargetT.trim(), targetNonTowered: newBlockTargetNT.trim() });
    setCustomBlocks(blocks);
    setNewBlockName('');
    setNewBlockTargetT('');
    setNewBlockTargetNT('');
    setShowAddCustomBlock(false);
  };

  const handleDeleteCustomBlock = (id) => {
    const blocks = deleteCustomBlock(id);
    setCustomBlocks(blocks);
    // Also delete user calls belonging to this block
    const uc = getUserCalls().filter(c => c.block === id);
    uc.forEach(c => deleteUserCall(c.id));
    setUserCallsState(getUserCalls());
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-50 flex items-center justify-center">
        <p className="text-slate-500">Loading library...</p>
      </div>
    );
  }

  const masterCalls = getRadioCalls();

  const buildEffectiveCalls = () => {
    const all = [];
    masterCalls.forEach(c => {
      const o = overrides[c.id] || {};
      const seq = seqOverrides[c.id] != null ? seqOverrides[c.id] : c.seq;
      all.push({
        ...c,
        text: o.text || c.text,
        type: o.type || c.type,
        applies: o.applies || c.applies,
        seq,
        _originalText: c.text,
        _originalType: c.type,
        _originalApplies: c.applies,
        _originalSeq: c.seq,
      });
    });
    userCalls.forEach(c => all.push({ ...c, _originalText: null }));
    return all;
  };

  const allCalls = buildEffectiveCalls();

  const callsByBlock = {};
  allCalls.forEach(c => {
    (callsByBlock[c.block] = callsByBlock[c.block] || []).push(c);
  });
  Object.values(callsByBlock).forEach(arr => arr.sort((a, b) => a.seq - b.seq));

  const toggleBlock = (blockId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      return next;
    });
  };

  const startEdit = (call) => {
    setEditingId(call.id);
    setEditText(call.text);
    setEditType(call.type);
    setEditApplies([...(call.applies || [])]);
  };

  const saveEdit = (call) => {
    pushUndo();
    const newText = editText.trim();
    if (call.userAdded) {
      updateUserCall(call.id, { text: newText, type: editType, applies: editApplies });
      setUserCallsState(getUserCalls());
    } else {
      const updates = {};
      if (newText !== call._originalText) updates.text = newText;
      if (editType !== call._originalType) updates.type = editType;
      const appliesChanged = JSON.stringify(editApplies.sort()) !== JSON.stringify((call._originalApplies || []).sort());
      if (appliesChanged) updates.applies = editApplies;
      if (Object.keys(updates).length > 0) {
        setCallOverride(call.id, updates);
      }
    }
    setEditingId(null);
    refresh();
  };

  const resetOverride = (callId) => {
    pushUndo();
    removeCallOverride(callId);
    const sOverrides = getSeqOverrides();
    delete sOverrides[callId];
    setSeqOverrides(sOverrides);
    refresh();
  };

  const togglePermanentHide = (callId) => {
    pushUndo();
    setPermanentHide(callId, !permanentHides.has(callId));
    setPermanentHidesState(getPermanentHides());
  };

  const handleDeleteUserCall = (callId) => {
    pushUndo();
    deleteUserCall(callId);
    setUserCallsState(getUserCalls());
  };

  const handleAddCall = (blockId) => {
    if (!newCallText.trim()) return;
    pushUndo();
    const blockCalls = callsByBlock[blockId] || [];
    const maxSeq = blockCalls.length > 0 ? Math.max(...blockCalls.map(c => c.seq)) : 0;
    const newSeq = Math.round((maxSeq + 1) * 100) / 100;
    addUserCall({
      id: `USER_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      block: blockId,
      group: null,
      seq: newSeq,
      type: newCallType,
      text: newCallText.trim(),
      applies: ['vfr_nt', 'vfr_t', 'ifr_nt', 'ifr_t'],
    });
    setUserCallsState(getUserCalls());
    setNewCallText('');
    setNewCallType('radio');
    setAddingToBlock(null);
  };

  const handleRestoreAll = () => {
    pushUndo();
    restoreAllDefaults();
    refresh();
    setShowRestoreConfirm(false);
  };

  // --- Drag and drop within a block ---
  const handleDragStart = (e, callId, blockId) => {
    setDraggedCallId(callId);
    setDragBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('is-dragging');
  };

  const handleDragEnd = () => {
    setDraggedCallId(null);
    setDragBlockId(null);
    setDropTargetId(null);
    setDropPosition(null);
    document.body.classList.remove('is-dragging');
  };

  const handleCallDragOver = (e, targetCallId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTargetId(targetCallId);
    setDropPosition(e.clientY < midY ? 'above' : 'below');
  };

  const handleDrop = (e, targetCallId, blockId) => {
    e.preventDefault();
    if (!draggedCallId || draggedCallId === targetCallId || dragBlockId !== blockId) {
      handleDragEnd();
      return;
    }

    pushUndo();
    const blockCalls = callsByBlock[blockId] || [];
    const draggedIdx = blockCalls.findIndex(c => c.id === draggedCallId);
    const targetIdx = blockCalls.findIndex(c => c.id === targetCallId);
    if (draggedIdx < 0 || targetIdx < 0) { handleDragEnd(); return; }

    const reordered = [...blockCalls];
    const [removed] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, removed);

    const newSeqMap = {};
    reordered.forEach((c, i) => {
      const newSeq = Math.round((i + 1) * 100) / 100;
      if (c.userAdded) {
        updateUserCall(c.id, { seq: newSeq });
      } else {
        newSeqMap[c.id] = newSeq;
      }
    });
    if (Object.keys(newSeqMap).length > 0) {
      setSeqOverrides(newSeqMap);
    }
    setUserCallsState(getUserCalls());
    setSeqOverridesState(getSeqOverrides());
    handleDragEnd();
  };

  // --- Block name/target editing (click to edit) ---
  const startEditBlock = (blockId) => {
    const bo = blockOverrides[blockId] || {};
    const def = BLOCKS[blockId] || {};
    const cb = customBlocks.find(b => b.id === blockId);
    setEditingBlockId(blockId);
    setEditBlockName(bo.name || cb?.name || def.name || blockId);
    setEditBlockTargetT(bo.targetTowered || cb?.targetTowered || def.targetTowered || '');
    setEditBlockTargetNT(bo.targetNonTowered || cb?.targetNonTowered || def.targetNonTowered || '');
  };

  const saveBlockEdit = () => {
    pushUndo();
    const def = BLOCKS[editingBlockId] || {};
    const cb = customBlocks.find(b => b.id === editingBlockId);
    if (cb) {
      // Update custom block directly
      const blocks = getCustomBlocks().map(b =>
        b.id === editingBlockId ? { ...b, name: editBlockName, targetTowered: editBlockTargetT, targetNonTowered: editBlockTargetNT } : b
      );
      localStorage.setItem('csg_customBlocks', JSON.stringify(blocks));
      setCustomBlocks(blocks);
    } else {
      const updates = {};
      if (editBlockName !== def.name) updates.name = editBlockName;
      if (editBlockTargetT !== (def.targetTowered || '')) updates.targetTowered = editBlockTargetT;
      if (editBlockTargetNT !== (def.targetNonTowered || '')) updates.targetNonTowered = editBlockTargetNT;
      if (Object.keys(updates).length > 0) {
        setBlockOverride(editingBlockId, updates);
      }
    }
    setEditingBlockId(null);
    refresh();
  };

  const toggleApplies = (key) => {
    setEditApplies(prev =>
      prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]
    );
  };

  const getBlockName = (blockId) => {
    const bo = blockOverrides[blockId] || {};
    const cb = customBlocks.find(b => b.id === blockId);
    return bo.name || cb?.name || BLOCKS[blockId]?.name || blockId;
  };

  const getBlockTargetT = (blockId) => {
    const bo = blockOverrides[blockId] || {};
    const cb = customBlocks.find(b => b.id === blockId);
    return bo.targetTowered || cb?.targetTowered || BLOCKS[blockId]?.targetTowered || '';
  };

  const getBlockTargetNT = (blockId) => {
    const bo = blockOverrides[blockId] || {};
    const cb = customBlocks.find(b => b.id === blockId);
    return bo.targetNonTowered || cb?.targetNonTowered || BLOCKS[blockId]?.targetNonTowered || '';
  };

  const matchesFilter = (call) => {
    if (filterApplies === 'user') return !!call.userAdded;
    if (filterApplies !== 'all') return (call.applies || []).includes(filterApplies);
    return true;
  };

  const matchesSearch = (call, blockId) => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return (call.text || '').toLowerCase().includes(lower) ||
           getBlockName(blockId).toLowerCase().includes(lower);
  };

  const filteredBlocks = BLOCK_ORDER.filter(blockId => {
    const blockCalls = callsByBlock[blockId] || [];
    return blockCalls.some(c => matchesFilter(c) && matchesSearch(c, blockId));
  });

  // Custom blocks that match filter
  const filteredCustomBlocks = customBlocks.filter(cb => {
    const blockCalls = callsByBlock[cb.id] || [];
    if (blockCalls.length === 0) {
      // Show custom block even if empty (so user can add calls), unless text filter active
      if (filterText) return cb.name.toLowerCase().includes(filterText.toLowerCase());
      if (filterApplies !== 'all' && filterApplies !== 'user') return false;
      return true;
    }
    return blockCalls.some(c => matchesFilter(c) && matchesSearch(c, cb.id));
  });

  // Export full library
  const exportFullLibrary = (format) => {
    const allBlockIds = [...BLOCK_ORDER, ...customBlocks.map(cb => cb.id)];
    const instances = allBlockIds.map(blockId => ({
      key: blockId,
      blockType: blockId,
      name: getBlockName(blockId),
      contextLabel: '',
      target: `${getBlockTargetT(blockId)} / ${getBlockTargetNT(blockId)}`,
    }));
    const exportCalls = allCalls.map(c => ({
      ...c,
      _blockKey: c.block,
      id: `${c.id}_lib`,
    }));
    const data = {
      callSign: 'Full Library',
      flightRules: 'all',
      route: [],
      blockInstances: instances,
      calls: exportCalls,
      hidden: new Set(),
      hiddenBlocks: new Set(),
      vars: {},
      abbr: '',
    };
    if (format === 'pdf') exportToPdf(data);
    else exportToDocx(data);
  };

  // Render a block (shared between standard and custom blocks)
  const renderBlock = (blockId, isCustom = false) => {
    const allBlockCalls = callsByBlock[blockId] || [];
    const blockCalls = allBlockCalls.filter(c => matchesFilter(c) && matchesSearch(c, blockId));
    const isExpanded = expanded.has(blockId);
    const hiddenInBlock = allBlockCalls.filter(c => permanentHides.has(c.id)).length;
    const modifiedInBlock = allBlockCalls.filter(c => overrides[c.id] || seqOverrides[c.id] != null).length;
    const isEditingBlock = editingBlockId === blockId;

    return (
      <div key={blockId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Block Header - clicking anywhere expands/collapses */}
        <div
          className="flex items-center gap-2 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
          onClick={() => toggleBlock(blockId)}
        >
          {/* Chevron - visual indicator only */}
          {isExpanded ? <ChevronDown size={18} className="text-slate-400 shrink-0" /> : <ChevronRight size={18} className="text-slate-400 shrink-0" />}

          {isEditingBlock ? (
            <div className="flex items-center gap-2 flex-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <input value={editBlockName} onChange={(e) => setEditBlockName(e.target.value)} className="font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-0.5 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveBlockEdit(); if (e.key === 'Escape') setEditingBlockId(null); }} />
              <span className="text-xs text-slate-400">Towered:</span>
              <input value={editBlockTargetT} onChange={(e) => setEditBlockTargetT(e.target.value)} className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Towered target" />
              <span className="text-xs text-slate-400">Non-Towered:</span>
              <input value={editBlockTargetNT} onChange={(e) => setEditBlockTargetNT(e.target.value)} className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Non-Towered target" />
              <button onClick={saveBlockEdit} className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">Save</button>
              <button onClick={() => setEditingBlockId(null)} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={(e) => { e.stopPropagation(); startEditBlock(blockId); }}
                title="Click to edit block"
              >
                {getBlockName(blockId)}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{blockCalls.length} calls</span>
              {hiddenInBlock > 0 && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{hiddenInBlock} hidden</span>}
              {modifiedInBlock > 0 && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{modifiedInBlock} modified</span>}
              {isCustom && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">custom</span>}
              <span
                className="ml-auto text-xs text-slate-400 cursor-pointer hover:text-blue-600 transition-colors shrink-0"
                onClick={(e) => { e.stopPropagation(); startEditBlock(blockId); }}
                title="Click to edit block"
              >
                {getBlockTargetT(blockId)} / {getBlockTargetNT(blockId)}
              </span>
              {isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomBlock(blockId); }}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                  title="Delete custom block"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Calls */}
        {isExpanded && (
          <div className="border-t border-slate-100">
            {blockCalls.map((call, idx) => {
              const isEditing = editingId === call.id;
              const isHidden = permanentHides.has(call.id);
              const hasOverride = !!(overrides[call.id] || seqOverrides[call.id] != null);
              const isDragging = draggedCallId === call.id;
              const isDropTarget = dropTargetId === call.id;

              return (
                <div
                  key={call.id}
                  className="relative"
                >
                  {/* Drop indicator line - above */}
                  {isDropTarget && dropPosition === 'above' && (
                    <div className="absolute -top-0.5 left-4 right-4 h-0.5 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                    </div>
                  )}

                  <div
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, call.id, blockId)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleCallDragOver(e, call.id)}
                    onDragLeave={() => { setDropTargetId(null); setDropPosition(null); }}
                    onDrop={(e) => handleDrop(e, call.id, blockId)}
                    className={`flex items-start gap-2 px-5 py-2.5 border-b border-slate-50 last:border-0 group ${isHidden ? 'opacity-40' : ''} ${isDragging ? 'opacity-30 bg-blue-50 border-dashed' : 'hover:bg-slate-50/50'}`}
                  >
                    {/* Drag handle */}
                    {!isEditing && (
                      <div className="mt-1 p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={14} />
                      </div>
                    )}

                    {/* Sequence display */}
                    <span
                      className="text-[10px] text-slate-400 w-10 text-right mt-1.5 shrink-0 font-mono cursor-pointer hover:text-blue-500"
                      onClick={() => !isEditing && startEdit(call)}
                      title="Click to edit"
                    >
                      {formatSeq(call.seq)}
                    </span>

                    {/* Type badge */}
                    {isEditing ? (
                      <select value={editType} onChange={(e) => setEditType(e.target.value)} className="text-xs border border-slate-300 rounded px-1 py-0.5 mt-0.5">
                        <option value="radio">Radio</option>
                        <option value="atc">ATC</option>
                        <option value="note">Note</option>
                        <option value="brief">Brief</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 mt-0.5 cursor-pointer ${TYPE_COLORS[call.type] || 'bg-slate-100 text-slate-600'}`}
                        onClick={() => startEdit(call)}
                        title="Click to edit"
                      >
                        {call.type}
                      </span>
                    )}

                    {/* Text */}
                    {isEditing ? (
                      <div className="flex-1">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-sm border border-slate-300 rounded-lg p-2 min-h-20 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        {/* Applies toggles */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-slate-500">Appears on:</span>
                          {APPLIES_OPTIONS.map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => toggleApplies(opt.key)}
                              className={`px-2 py-0.5 text-[10px] rounded font-medium ${editApplies.includes(opt.key) ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => saveEdit(call)} className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 font-medium flex items-center gap-1">
                            <Save size={12} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(call)}
                        className={`flex-1 text-sm text-slate-700 cursor-pointer leading-relaxed ${hasOverride ? 'bg-blue-50 px-2 py-1 rounded border border-blue-200' : ''}`}
                        title="Click to edit"
                      >
                        {call.text}
                        {hasOverride && !call.userAdded && <span className="text-xs text-blue-500 ml-2">(modified)</span>}
                        {call.userAdded && <span className="text-xs text-green-500 ml-2">(user-added)</span>}
                      </div>
                    )}

                    {/* Applies badges */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-0.5 shrink-0 mt-0.5">
                        {(call.applies || []).map(a => (
                          <span key={a} className="text-[9px] text-slate-400 bg-slate-50 px-1 py-0.5 rounded">{a.replace('_', ' ').toUpperCase()}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            addPendingCall({ ...call, id: `${call.id}_LIB_${Date.now()}` });
                            setAddedToSheet(call.id);
                            setTimeout(() => setAddedToSheet(null), 1500);
                          }}
                          className={`p-1 rounded-lg ${addedToSheet === call.id ? 'text-green-500' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                          title="Add to current sheet"
                        >
                          <PlusCircle size={13} />
                        </button>
                        {hasOverride && !call.userAdded && (
                          <button onClick={() => resetOverride(call.id)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Reset to default">
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button onClick={() => togglePermanentHide(call.id)} className={`p-1 rounded-lg ${isHidden ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title={isHidden ? 'Unhide' : 'Permanently hide'}>
                          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        {call.userAdded && (
                          <button onClick={() => handleDeleteUserCall(call.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Drop indicator line - below */}
                  {isDropTarget && dropPosition === 'below' && (
                    <div className="absolute -bottom-0.5 left-4 right-4 h-0.5 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add call */}
            {addingToBlock === blockId ? (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex gap-2 mb-2">
                  <select value={newCallType} onChange={(e) => setNewCallType(e.target.value)} className="text-xs border border-slate-300 rounded px-2 py-1.5">
                    <option value="radio">Radio</option>
                    <option value="atc">ATC</option>
                    <option value="note">Note</option>
                    <option value="brief">Brief</option>
                  </select>
                  <input
                    type="text"
                    value={newCallText}
                    onChange={(e) => setNewCallText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCall(blockId); }}
                    placeholder="Enter call text..."
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAddCall(blockId)} className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 font-medium">Add Call</button>
                  <button onClick={() => { setAddingToBlock(null); setNewCallText(''); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingToBlock(blockId)}
                className="w-full px-5 py-2.5 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center gap-1 border-t border-slate-100"
              >
                <Plus size={12} /> Add call to {getBlockName(blockId)}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-50 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header - sticky */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 p-5 mb-4 sticky top-4 z-30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <button onClick={() => { window.location.hash = '#/'; }} className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Library Editor</h1>
                <p className="text-sm text-slate-500">
                  {masterCalls.length} master + {userCalls.length} user-added
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={undo} disabled={undoStack.length === 0} className={`px-3 py-2 text-xs rounded-xl font-medium flex items-center gap-1 ${undoStack.length > 0 ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-50 text-slate-300'}`} title="Undo (Ctrl+Z)">
                <RotateCcw size={12} /> Undo
              </button>
              <button onClick={redo} disabled={redoStack.length === 0} className={`px-3 py-2 text-xs rounded-xl font-medium flex items-center gap-1 ${redoStack.length > 0 ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-50 text-slate-300'}`} title="Redo (Ctrl+Y)">
                <Redo size={12} /> Redo
              </button>
              <button onClick={() => setShowKey(!showKey)} className={`px-3 py-2 text-xs rounded-xl font-medium ${showKey ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Reference Key
              </button>
              <button onClick={saveLibraryToFile} className="px-3 py-2 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium flex items-center gap-1" title="Save library to JSON file">
                <FileDown size={12} /> Save Library
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium flex items-center gap-1" title="Load library from JSON file">
                <Upload size={12} /> Load Library
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadLibraryFile} className="hidden" />
              <button onClick={toggleDefault} className={`px-3 py-2 text-xs rounded-xl font-medium flex items-center gap-1 ${isDefault ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={isDefault ? 'Current library is saved as default. Click to clear.' : 'Set current library state as default'}>
                <Star size={12} /> {isDefault ? 'Default Set' : 'Set as Default'}
              </button>
              <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-3 py-2 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium flex items-center gap-1">
                  <Download size={12} /> Export Library
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20">
                    <button onClick={() => { exportFullLibrary('pdf'); setShowExportMenu(false); }} className="w-full px-4 py-2.5 text-xs text-left hover:bg-blue-50">Export as PDF</button>
                    <button onClick={() => { exportFullLibrary('docx'); setShowExportMenu(false); }} className="w-full px-4 py-2.5 text-xs text-left hover:bg-blue-50">Export as DOCX</button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowRestoreConfirm(true)} className="px-3 py-2 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium flex items-center gap-1">
                <RotateCcw size={12} /> Restore Defaults
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search calls..."
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1 flex-wrap">
              {[{ key: 'all', label: 'All' }, { key: 'user', label: 'User Added' }, ...APPLIES_OPTIONS].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFilterApplies(opt.key)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg font-medium ${filterApplies === opt.key ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Reference Key - inside sticky header */}
          {showKey && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-600 mb-2">Template Reference Key</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                {REFERENCE_KEY.map(r => (
                  <div key={r.code} className="flex items-center gap-2 text-[11px]">
                    <code className="bg-white text-blue-700 px-1.5 py-0.5 rounded font-mono shrink-0 text-[10px]">{r.code}</code>
                    <span className="text-slate-500">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Restore confirmation */}
        {showRestoreConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-amber-500" />
                <h3 className="font-bold text-slate-800">Restore All Defaults</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">This will reset all text edits, sequence changes, permanent hides, and block name changes back to defaults. User-added calls will be kept.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRestoreConfirm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm">Cancel</button>
                <button onClick={handleRestoreAll} className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium">Restore Defaults</button>
              </div>
            </div>
          </div>
        )}

        {/* Load Library confirmation */}
        {showLoadConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-amber-500" />
                <h3 className="font-bold text-slate-800">Load Library</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">This will replace all current overrides, user calls, permanent hides, sequence overrides, block overrides, and custom blocks with the data from the loaded file. This action can be undone.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowLoadConfirm(false); setPendingLibraryData(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm">Cancel</button>
                <button onClick={() => applyLibraryData(pendingLibraryData)} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">Load Library</button>
              </div>
            </div>
          </div>
        )}

        {/* Blocks */}
        <div className="space-y-3">
          {filteredBlocks.map(blockId => renderBlock(blockId, false))}

          {/* Custom Blocks */}
          {filteredCustomBlocks.map(cb => renderBlock(cb.id, true))}

          {/* Add Custom Block */}
          {showAddCustomBlock ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-bold text-slate-700 mb-3 text-sm">Add Custom Block</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  placeholder="Block name..."
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomBlock(); if (e.key === 'Escape') setShowAddCustomBlock(false); }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlockTargetT}
                    onChange={(e) => setNewBlockTargetT(e.target.value)}
                    placeholder="Towered target (optional)"
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newBlockTargetNT}
                    onChange={(e) => setNewBlockTargetNT(e.target.value)}
                    placeholder="Non-Towered target (optional)"
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddCustomBlock} className="px-4 py-2 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 font-medium">Create Block</button>
                  <button onClick={() => { setShowAddCustomBlock(false); setNewBlockName(''); setNewBlockTargetT(''); setNewBlockTargetNT(''); }} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCustomBlock(true)}
              className="w-full px-5 py-4 bg-white rounded-2xl shadow-sm border border-dashed border-slate-300 text-sm text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Custom Block
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
