import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, RotateCcw, ChevronDown, ChevronRight, Save, GripVertical, AlertTriangle, Download, PlusCircle, Upload, FileDown, Star, Undo, Redo, Pencil, Check } from 'lucide-react';
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
  getUserBlocks, addUserBlock, updateUserBlock, deleteUserBlock,
  getBlockSeqOverrides, setBlockSeqOverrides,
} from '../data/userStore';
import { exportToPdf } from '../utils/exportPdf';
import { exportToDocx } from '../utils/exportDocx';
import { subVars } from '../utils/callSign';
import { getSpacingClass } from '../utils/spacing';
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
  { code: '{{CS_Short}}', desc: 'Last 3 chars only (e.g., 45E) — use after ATC acknowledgment' },
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


export default function LibraryEditor() {
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = sessionStorage.getItem('csg_libEditorExpanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
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
  const [draggedBlockIdState, setDraggedBlockIdState] = useState(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState(null);
  const [dropBlockPosition, setDropBlockPosition] = useState(null);
  const [blockSeqOvr, setBlockSeqOvrState] = useState(() => getBlockSeqOverrides());
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
  // All user/saved blocks (unified system)
  const [userBlocks, setUserBlocks] = useState(() => getUserBlocks());
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
  const blockEditRef = useRef(null);
  const callEditRef = useRef(null);
  const lastToggleTime = useRef(0);
  const headerRef = useRef(null);

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
    setUserBlocks(getUserBlocks());
    setBlockSeqOvrState(getBlockSeqOverrides());
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

  // Persist expanded blocks to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('csg_libEditorExpanded', JSON.stringify([...expanded]));
    } catch {}
  }, [expanded]);

  // Save scroll position when navigating away, restore on load
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem('csg_libEditorScrollY', String(window.scrollY));
    };
    window.addEventListener('hashchange', saveScroll);
    window.addEventListener('beforeunload', saveScroll);
    // Also save periodically while on page
    const interval = setInterval(saveScroll, 1000);
    return () => {
      window.removeEventListener('hashchange', saveScroll);
      window.removeEventListener('beforeunload', saveScroll);
      clearInterval(interval);
    };
  }, []);

  // Restore scroll position after content loads
  useEffect(() => {
    if (!loaded) return;
    const scrollY = sessionStorage.getItem('csg_libEditorScrollY');
    if (scrollY) {
      const target = parseInt(scrollY, 10);
      setTimeout(() => window.scrollTo(0, target), 100);
    }
  }, [loaded]);

  // Click outside block editor to save & close
  useEffect(() => {
    if (!editingBlockId) return;
    const handler = (e) => {
      if (!blockEditRef.current) return;
      const el = e.target;
      // Ignore clicks in the sticky header (Key, filters, etc.)
      if (headerRef.current?.contains(el)) return;
      // Only keep editor open if clicking directly on an input/button/select inside it
      const isEditorControl = blockEditRef.current.contains(el) &&
        (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.closest('button'));
      if (!isEditorControl) {
        saveBlockEdit();
      }
    };
    // Use capture phase so it fires before stopPropagation in child elements
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [editingBlockId, editBlockName, editBlockTargetT, editBlockTargetNT]);

  // Click outside call editor to save & close
  useEffect(() => {
    if (!editingId) return;
    const handler = (e) => {
      if (!callEditRef.current) return;
      const el = e.target;
      // Ignore clicks in the sticky header (Key button, filters, etc.)
      if (headerRef.current?.contains(el)) return;
      // Only close if clicking outside the editor
      if (!callEditRef.current.contains(el)) {
        // Find the call we're editing and save
        const call = allCalls.find(c => c.id === editingId);
        if (call) saveEdit(call);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [editingId, editText, editType, editApplies]);

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
      userBlocks: getUserBlocks(),
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
    if (data.userBlocks) localStorage.setItem('csg_userBlocks', JSON.stringify(data.userBlocks));
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
        userBlocks: getUserBlocks(),
      };
      localStorage.setItem('csg_defaultLibrary', JSON.stringify(data));
      setIsDefault(true);
    }
  };

  // Add custom block
  const handleAddCustomBlock = () => {
    if (!newBlockName.trim()) return;
    const id = `UBLK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    addUserBlock({
      id, name: newBlockName.trim(), target: newBlockTargetT.trim() || newBlockTargetNT.trim() || '',
      seq: userBlocks.length + 1, calls: [],
    });
    setUserBlocks(getUserBlocks());
    setNewBlockName('');
    setNewBlockTargetT('');
    setNewBlockTargetNT('');
    setShowAddCustomBlock(false);
  };

  const handleDeleteCustomBlock = (id) => {
    deleteUserBlock(id);
    // Also delete user calls belonging to this block
    const uc = getUserCalls().filter(c => c.block === id);
    uc.forEach(c => deleteUserCall(c.id));
    setUserCallsState(getUserCalls());
    setUserBlocks(getUserBlocks());
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
        group: o.group || c.group,
        seq,
        _originalText: c.text,
        _originalType: c.type,
        _originalApplies: c.applies,
        _originalSeq: c.seq,
      });
    });
    userCalls.forEach(c => all.push({ ...c, _originalText: null }));
    // Inject user-saved block calls
    userBlocks.forEach(ub => {
      (ub.calls || []).forEach(c => {
        all.push({
          ...c,
          block: ub.id,
          applies: c.applies || ub.applies || ['vfr_nt', 'vfr_t', 'ifr_nt', 'ifr_t'],
          userAdded: true,
          _userBlock: true,
          _userBlockId: ub.id,
          _originalText: null,
        });
      });
    });
    return all;
  };

  const allCalls = buildEffectiveCalls();

  const callsByBlock = {};
  allCalls.forEach(c => {
    (callsByBlock[c.block] = callsByBlock[c.block] || []).push(c);
  });
  Object.values(callsByBlock).forEach(arr => arr.sort((a, b) => a.seq - b.seq));

  const toggleBlock = (blockId) => {
    lastToggleTime.current = Date.now();
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      return next;
    });
  };

  const startEdit = (call) => {
    // Ignore clicks right after a block expand/collapse to prevent accidental edits
    if (Date.now() - lastToggleTime.current < 300) return;
    setEditingId(call.id);
    setEditText(call.text);
    setEditType(call.type);
    setEditApplies([...(call.applies || [])]);
  };

  const saveEdit = (call) => {
    pushUndo();
    const newText = editText.trim();
    if (call._userBlock) {
      const ub = getUserBlocks().find(b => b.id === call._userBlockId);
      if (ub) {
        const updatedCalls = (ub.calls || []).map(c =>
          c.id === call.id ? { ...c, text: newText, type: editType, applies: editApplies } : c
        );
        updateUserBlock(call._userBlockId, { calls: updatedCalls });
      }
      setEditingId(null);
      refresh();
      return;
    }
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

  const handleDeleteUserCall = (callId, call) => {
    pushUndo();
    if (call?._userBlock) {
      const ub = getUserBlocks().find(b => b.id === call._userBlockId);
      if (ub) {
        updateUserBlock(call._userBlockId, { calls: (ub.calls || []).filter(c => c.id !== callId) });
      }
      refresh();
      return;
    }
    deleteUserCall(callId);
    setUserCallsState(getUserCalls());
  };

  const handleAddCall = (blockId) => {
    if (!newCallText.trim()) return;
    pushUndo();
    // Check if this is a user-saved block
    const ub = userBlocks.find(b => b.id === blockId);
    if (ub) {
      const maxSeq = (ub.calls || []).length > 0 ? Math.max(...ub.calls.map(c => c.seq)) : 0;
      const newCall = {
        id: `UBLKCALL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: newCallText.trim(),
        type: newCallType,
        seq: maxSeq + 1,
        applies: ['vfr_nt', 'vfr_t', 'ifr_nt', 'ifr_t'],
      };
      updateUserBlock(blockId, { calls: [...(ub.calls || []), newCall] });
      refresh();
      setNewCallText('');
      setNewCallType('radio');
      setAddingToBlock(null);
      return;
    }
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
    if (draggedCallId === targetCallId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const edgeZone = rect.height * 0.3; // outer 30% on each edge = gap zone

    setDropTargetId(targetCallId);

    // Check if dragged and target are already in the same group
    const draggedCall = allCalls.find(c => c.id === draggedCallId);
    const targetCall = allCalls.find(c => c.id === targetCallId);
    const alreadySameGroup = draggedCall?.group && targetCall?.group && draggedCall.group === targetCall.group;

    if (e.clientY < midY) {
      const distFromTop = e.clientY - rect.top;
      // If already in same group, always stay grouped (no blue separate option)
      if (alreadySameGroup) {
        setDropPosition('above-same');
      } else {
        // Near top edge = in the gap = SEPARATE, away from edge = GROUP
        setDropPosition(distFromTop < edgeZone ? 'above-new' : 'above-same');
      }
    } else {
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

  const handleDrop = (e, targetCallId, blockId) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = dropPosition;
    const groupWithTarget = pos === 'above-same' || pos === 'below-same';
    const verticalPos = pos?.startsWith('below') ? 'below' : 'above';

    if (!draggedCallId || draggedCallId === targetCallId || dragBlockId !== blockId) {
      handleDragEnd();
      return;
    }

    pushUndo();
    const blockCalls = callsByBlock[blockId] || [];
    const draggedIdx = blockCalls.findIndex(c => c.id === draggedCallId);
    const targetIdx = blockCalls.findIndex(c => c.id === targetCallId);
    if (draggedIdx < 0 || targetIdx < 0) { handleDragEnd(); return; }

    const draggedCall = blockCalls[draggedIdx];
    const targetCall = blockCalls[targetIdx];

    const reordered = [...blockCalls];
    const [removed] = reordered.splice(draggedIdx, 1);
    let newIdx = reordered.findIndex(c => c.id === targetCallId);
    if (verticalPos === 'below') newIdx += 1;
    reordered.splice(newIdx, 0, removed);

    // Assign group based on groupWithTarget
    let sharedGroup;
    if (groupWithTarget) {
      sharedGroup = targetCall.group || `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      removed.group = sharedGroup;
    } else {
      removed.group = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }

    // Check if this is a user-saved block
    const ub = userBlocks.find(b => b.id === blockId);
    if (ub) {
      const reorderedCalls = reordered.map((c, i) => {
        const orig = (ub.calls || []).find(oc => oc.id === c.id);
        const updated = { ...(orig || c), seq: i + 1 };
        // Apply group changes
        if (c.id === draggedCallId) updated.group = removed.group;
        if (groupWithTarget && c.id === targetCallId && !targetCall.group) updated.group = sharedGroup;
        return updated;
      });
      updateUserBlock(blockId, { calls: reorderedCalls });
      refresh();
      handleDragEnd();
      return;
    }

    // For standard blocks - save groups to call overrides
    // Save dragged call's group
    if (draggedCall.userAdded) {
      updateUserCall(draggedCall.id, { group: removed.group });
    } else {
      setCallOverride(draggedCall.id, { group: removed.group });
    }
    // Save target call's group if we created one for it
    if (groupWithTarget && !targetCall.group) {
      if (targetCall.userAdded) {
        updateUserCall(targetCall.id, { group: sharedGroup });
      } else {
        setCallOverride(targetCall.id, { group: sharedGroup });
      }
    }

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
    setOverrides(getCallOverrides());
    handleDragEnd();
  };

  // --- Block-level drag and drop ---
  const handleBlockDragStart = (e, blockId) => {
    setDraggedBlockIdState(blockId);
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('is-dragging');
  };
  const handleBlockDragEnd = () => {
    setDraggedBlockIdState(null);
    setDropTargetBlockId(null);
    setDropBlockPosition(null);
    document.body.classList.remove('is-dragging');
  };
  const handleBlockDragOver = (e, targetBlockId) => {
    // If we're dragging a call (not a block), don't show block-level indicators
    if (draggedCallId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTargetBlockId(targetBlockId);
    setDropBlockPosition(e.clientY < midY ? 'above' : 'below');
  };
  const handleBlockDrop = (e, targetBlockId) => {
    e.preventDefault();
    if (!draggedBlockIdState || draggedBlockIdState === targetBlockId) {
      handleBlockDragEnd();
      return;
    }
    const dragIdx = filteredBlocks.indexOf(draggedBlockIdState);
    const targetIdx = filteredBlocks.indexOf(targetBlockId);
    if (dragIdx < 0 || targetIdx < 0) { handleBlockDragEnd(); return; }

    // Use sortedBlockIds (unfiltered) for reordering
    const fullDragIdx = sortedBlockIds.indexOf(draggedBlockIdState);
    const fullTargetIdx = sortedBlockIds.indexOf(targetBlockId);
    if (fullDragIdx < 0 || fullTargetIdx < 0) { handleBlockDragEnd(); return; }

    const reordered = [...sortedBlockIds];
    const [removed] = reordered.splice(fullDragIdx, 1);
    const insertIdx = reordered.indexOf(targetBlockId);
    reordered.splice(dropBlockPosition === 'below' ? insertIdx + 1 : insertIdx, 0, removed);

    const newSeqMap = {};
    reordered.forEach((id, i) => { newSeqMap[id] = i + 1; });
    setBlockSeqOverrides(newSeqMap);
    setBlockSeqOvrState(newSeqMap);
    handleBlockDragEnd();
  };

  // --- Block name/target editing (click to edit) ---
  const startEditBlock = (blockId) => {
    const bo = blockOverrides[blockId] || {};
    const def = BLOCKS[blockId] || {};
    const ub = userBlocks.find(b => b.id === blockId);
    setEditingBlockId(blockId);
    setEditBlockName(ub?.name || bo.name || def.name || blockId);
    setEditBlockTargetT(ub ? (ub.targetTowered || ub.target || '') : (bo.targetTowered || def.targetTowered || ''));
    setEditBlockTargetNT(ub ? (ub.targetNonTowered || ub.target || '') : (bo.targetNonTowered || def.targetNonTowered || ''));
  };

  const saveBlockEdit = () => {
    if (!editingBlockId) return;
    pushUndo();
    const def = BLOCKS[editingBlockId] || {};
    const ub = userBlocks.find(b => b.id === editingBlockId);
    if (ub) {
      updateUserBlock(editingBlockId, { name: editBlockName, targetTowered: editBlockTargetT, targetNonTowered: editBlockTargetNT });
      setEditingBlockId(null);
      refresh();
      return;
    }
    {
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
    const ub = userBlocks.find(b => b.id === blockId);
    if (ub) return ub.name;
    const bo = blockOverrides[blockId] || {};
    return bo.name || BLOCKS[blockId]?.name || blockId;
  };

  const getBlockTargetT = (blockId) => {
    const ub = userBlocks.find(b => b.id === blockId);
    if (ub) return ub.targetTowered || ub.target || '';
    const bo = blockOverrides[blockId] || {};
    return bo.targetTowered || BLOCKS[blockId]?.targetTowered || '';
  };

  const getBlockTargetNT = (blockId) => {
    const ub = userBlocks.find(b => b.id === blockId);
    if (ub) return ub.targetNonTowered || ub.target || '';
    const bo = blockOverrides[blockId] || {};
    return bo.targetNonTowered || BLOCKS[blockId]?.targetNonTowered || '';
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

  // Render text with formatting (same as CallItem)
  const renderText = (call) => {
    const isBrief = call.type === 'brief';
    let text = subVars(call.text || '', {});
    text = text.replace(/\[([^\]]+)\]/g, '<strong>[$1]</strong>');
    text = text.replace(/\{\{(\w+)\}\}/g, '<span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">$1</span>');
    // For briefs, insert "(Modify as Needed)" after the first line title
    if (isBrief && text.includes('\n')) {
      const nlIdx = text.indexOf('\n');
      text = text.slice(0, nlIdx) + ' <span class="text-amber-500 font-normal text-xs italic">(Modify as Needed)</span>' + text.slice(nlIdx);
    } else if (isBrief) {
      text += ' <span class="text-amber-500 font-normal text-xs italic">(Modify as Needed)</span>';
    }
    text = text.replace(/\n/g, '<br/>');
    return text;
  };

  // Build unified block list: default + user, sorted by block seq overrides
  const allBlockIds = [...BLOCK_ORDER, ...userBlocks.map(ub => ub.id)];
  const sortedBlockIds = allBlockIds
    .map((id, naturalIdx) => ({ id, seq: blockSeqOvr[id] != null ? blockSeqOvr[id] : naturalIdx + 1 }))
    .sort((a, b) => a.seq - b.seq)
    .map(x => x.id);

  const filteredBlocks = sortedBlockIds.filter(blockId => {
    const isUb = userBlocks.some(b => b.id === blockId);
    const blockCalls = callsByBlock[blockId] || [];
    if (isUb) {
      if (!filterText) {
        if (filterApplies !== 'all' && filterApplies !== 'user') return false;
        return true;
      }
      const lower = filterText.toLowerCase();
      const ub = userBlocks.find(b => b.id === blockId);
      return (ub?.name || '').toLowerCase().includes(lower) ||
        (ub?.calls || []).some(c => (c.text || '').toLowerCase().includes(lower));
    }
    return blockCalls.some(c => matchesFilter(c) && matchesSearch(c, blockId));
  });

  // Export full library
  const exportFullLibrary = (format) => {
    const allBlockIds = [...BLOCK_ORDER, ...userBlocks.map(ub => ub.id)];
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

  // Render a block (shared between standard, custom, and user-saved blocks)
  const renderBlock = (blockId, _unused = false, isUserBlock = false) => {
    const currentUb = isUserBlock ? userBlocks.find(b => b.id === blockId) : null;
    const isDefault = !isUserBlock && !!BLOCKS[blockId];
    const allBlockCalls = callsByBlock[blockId] || [];
    const blockCalls = allBlockCalls.filter(c => matchesFilter(c) && matchesSearch(c, blockId));
    const isExpanded = expanded.has(blockId);
    const hiddenInBlock = allBlockCalls.filter(c => permanentHides.has(c.id)).length;
    const modifiedInBlock = allBlockCalls.filter(c => overrides[c.id] || seqOverrides[c.id] != null).length;
    const isEditingBlock = editingBlockId === blockId;

    const bo = blockOverrides[blockId] || {};
    const hasAnyModification = isDefault && (modifiedInBlock > 0 || hiddenInBlock > 0 || bo.name || bo.targetTowered || bo.targetNonTowered);

    const isBlockDragging = draggedBlockIdState === blockId;
    const isBlockDropTarget = dropTargetBlockId === blockId;

    return (
      <div
        key={blockId}
        className={`bg-white rounded-2xl shadow-sm border ${isUserBlock ? 'border-green-300 border-l-4' : 'border-slate-100'} relative ${isBlockDragging ? 'opacity-30' : ''} ${bo.hidden ? 'opacity-50' : ''}`}
        onDragOver={(e) => handleBlockDragOver(e, blockId)}
        onDragLeave={() => { setDropTargetBlockId(null); setDropBlockPosition(null); }}
        onDrop={(e) => handleBlockDrop(e, blockId)}
      >
        {/* Block drop indicator - above */}
        {isBlockDropTarget && dropBlockPosition === 'above' && (
          <div className="absolute -top-1.5 left-4 right-4 h-0.5 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
          </div>
        )}
        {/* Block Header */}
        <div
          className={`flex items-center gap-2 px-5 py-3 cursor-pointer ${isUserBlock ? 'hover:bg-green-50/50' : 'hover:bg-slate-50'} transition-colors select-none group/block`}
          onClick={() => toggleBlock(blockId)}
        >
          {/* Block drag handle */}
          <div
            draggable
            onDragStart={(e) => { e.stopPropagation(); handleBlockDragStart(e, blockId); }}
            onDragEnd={handleBlockDragEnd}
            className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover/block:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </div>
          {isExpanded ? <ChevronDown size={18} className={`${isUserBlock ? 'text-green-400' : 'text-slate-400'} shrink-0`} /> : <ChevronRight size={18} className={`${isUserBlock ? 'text-green-400' : 'text-slate-400'} shrink-0`} />}

          {isEditingBlock ? (
            <div ref={blockEditRef} className="flex items-center gap-2 flex-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <input value={editBlockName} onChange={(e) => setEditBlockName(e.target.value)} className="font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-0.5 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveBlockEdit(); if (e.key === 'Escape') setEditingBlockId(null); }} />
              <span className="text-xs text-slate-400">Towered:</span>
              <input value={editBlockTargetT} onChange={(e) => setEditBlockTargetT(e.target.value)} className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Towered target" />
              <span className="text-xs text-slate-400">Non-Towered:</span>
              <input value={editBlockTargetNT} onChange={(e) => setEditBlockTargetNT(e.target.value)} className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Non-Towered target" />
              <button onClick={saveBlockEdit} className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">Save</button>
              <button onClick={() => setEditingBlockId(null)} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <span className="font-bold text-slate-800">
                {getBlockName(blockId)}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{blockCalls.length} calls</span>
              {hiddenInBlock > 0 && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{hiddenInBlock} hidden</span>}
              {modifiedInBlock > 0 && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{modifiedInBlock} modified</span>}
              {isDefault && !hasAnyModification && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">default</span>}
              {isDefault && hasAnyModification && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">modified</span>}
              {isUserBlock && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">user added</span>}
              {bo.hidden && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">hidden</span>}

              <span className="ml-auto text-xs text-slate-400 shrink-0">
                {`${getBlockTargetT(blockId)} / ${getBlockTargetNT(blockId)}`}
              </span>
              {/* Edit block button */}
              <button
                onClick={(e) => { e.stopPropagation(); startEditBlock(blockId); }}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                title="Edit block name & target"
              >
                <Pencil size={13} />
              </button>
              {/* Add to sheet button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const callsToSend = allBlockCalls.map(c => ({ id: c.id, text: c.text, type: c.type, seq: c.seq }));
                  const target = getBlockTargetT(blockId);
                  addPendingCall({ _addBlock: true, name: getBlockName(blockId), target, calls: callsToSend });
                  setAddedToSheet(blockId);
                  setTimeout(() => setAddedToSheet(null), 1500);
                }}
                className={`p-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${addedToSheet === blockId ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                title="Add block to current sheet"
              >
                {addedToSheet === blockId ? (
                  <>
                    <Check size={14} />
                    <span className="text-[10px] font-medium">Added!</span>
                  </>
                ) : (
                  <PlusCircle size={14} />
                )}
              </button>
              {isUserBlock ? (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteUserBlock(blockId); refresh(); }}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                  title="Delete saved block"
                >
                  <Trash2 size={14} />
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setBlockOverride(blockId, { hidden: !bo.hidden }); refresh(); }}
                  className={`p-1 rounded-lg shrink-0 ${bo.hidden ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  title={bo.hidden ? 'Unhide from generated sheets' : 'Hide from generated sheets'}
                >
                  {bo.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Calls */}
        {isExpanded && (
          <div className="border-t border-slate-100">
            {blockCalls.map((call, idx) => {
              const prevCall = idx > 0 ? blockCalls[idx - 1] : null;
              const nextCall = idx < blockCalls.length - 1 ? blockCalls[idx + 1] : null;
              const spacingClass = getSpacingClass(call, prevCall);
              const isGroupedWithPrev = prevCall && call.group && prevCall.group && call.group === prevCall.group;
              const isGroupedWithNext = nextCall && call.group && nextCall.group && call.group === nextCall.group;
              const isGrouped = isGroupedWithPrev || isGroupedWithNext;

              const isEditing = editingId === call.id;
              const isHidden = permanentHides.has(call.id);
              const hasOverride = !!(overrides[call.id] || seqOverrides[call.id] != null);
              const isDragging = draggedCallId === call.id;
              const isDropTarget = dropTargetId === call.id;

              return (
                <div
                  key={call.id}
                  className={`relative ${spacingClass}`}
                >
                  {/* Grouped indicator - subtle left line connecting grouped calls */}
                  {isGrouped && (
                    <div className="absolute left-1 w-0.5 bg-emerald-300/60 rounded-full" style={{
                      top: isGroupedWithPrev ? '-0.5rem' : '0.5rem',
                      bottom: isGroupedWithNext ? '-0.5rem' : '0.5rem',
                    }} />
                  )}

                  {/* Drop indicator - above-same (group, green, hugs call) */}
                  {isDropTarget && dropPosition === 'above-same' && (
                    <div className="absolute top-0 left-8 right-4 h-0.5 bg-emerald-400 z-10 rounded-full shadow-sm shadow-emerald-400/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                      <span className="absolute top-1 left-0 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">group</span>
                    </div>
                  )}
                  {/* Drop indicator - above-new (separate, blue, in gap) */}
                  {isDropTarget && dropPosition === 'above-new' && (
                    <div className="absolute -top-3 left-4 right-4 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
                      <span className="absolute -top-5 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
                    </div>
                  )}

                  <div
                    ref={isEditing ? callEditRef : null}
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
                        className={`text-sm cursor-pointer leading-relaxed ${
                          call.type === 'atc' ? 'italic text-slate-500 text-right flex-1' :
                          call.type === 'brief' ? 'bg-amber-50 border border-amber-200 p-3 rounded-xl flex-1' :
                          call.type === 'note' ? 'text-slate-700 flex-1' :
                          'text-slate-700 flex-1'
                        } ${hasOverride && call.type !== 'brief' ? 'bg-blue-50 px-2 py-1 rounded border border-blue-200' : ''}`}
                        title="Click to edit"
                      >
                        {call.type === 'note' && <span className="text-slate-400 font-medium mr-2 text-xs uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">NOTE</span>}
                        {call.text ? (
                          <span dangerouslySetInnerHTML={{ __html: renderText(call) }} />
                        ) : (
                          <span className="text-slate-300 italic">Click to edit...</span>
                        )}
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
                          className={`p-1 rounded-lg flex items-center gap-1 transition-all ${addedToSheet === call.id ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                          title="Add to current sheet"
                        >
                          {addedToSheet === call.id ? (
                            <>
                              <Check size={13} />
                              <span className="text-[10px] font-medium">Added!</span>
                            </>
                          ) : (
                            <PlusCircle size={13} />
                          )}
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
                          <button onClick={() => handleDeleteUserCall(call.id, call)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Drop indicator - below-same (group, green, hugs call) */}
                  {isDropTarget && dropPosition === 'below-same' && (
                    <div className="absolute bottom-0 left-8 right-4 h-0.5 bg-emerald-400 z-10 rounded-full shadow-sm shadow-emerald-400/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                      <span className="absolute -top-5 left-0 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">group</span>
                    </div>
                  )}
                  {/* Drop indicator - below-new (separate, blue, in gap) */}
                  {isDropTarget && dropPosition === 'below-new' && (
                    <div className="absolute -bottom-3 left-4 right-4 h-0.5 bg-blue-400 z-10 rounded-full shadow-sm shadow-blue-400/50">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-400 rounded-full" />
                      <span className="absolute top-1 right-0 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">separate</span>
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
        {/* Block drop indicator - below */}
        {isBlockDropTarget && dropBlockPosition === 'below' && (
          <div className="absolute -bottom-1.5 left-4 right-4 h-0.5 bg-blue-500 z-10 rounded-full shadow-sm shadow-blue-500/50">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-50 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header - sticky */}
        <div ref={headerRef} data-header="true" className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 p-5 mb-4 sticky top-4 z-30">
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
              <button onClick={undo} disabled={undoStack.length === 0} className={`p-2.5 rounded-xl transition-all ${undoStack.length > 0 ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300'}`} title="Undo (Ctrl+Z)">
                <Undo size={20} />
              </button>
              <button onClick={redo} disabled={redoStack.length === 0} className={`p-2.5 rounded-xl transition-all ${redoStack.length > 0 ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300'}`} title="Redo (Ctrl+Y)">
                <Redo size={20} />
              </button>
              <button onClick={() => setShowKey(!showKey)} className={`px-3 py-2 text-xs rounded-xl font-medium ${showKey ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Key
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
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setExpanded(new Set(sortedBlockIds))}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Expand All
              </button>
              <button
                onClick={() => setExpanded(new Set())}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Collapse All
              </button>
            </div>
          </div>
          {/* Key - inside sticky header */}
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
              <p className="text-sm text-slate-600 mb-4">This will reset all text edits, sequence changes, permanent hides, and block name/order changes back to defaults. User-added calls and user-added blocks will be kept.</p>
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

        {/* Blocks — unified list (default + user, drag-reorderable) */}
        <div className="space-y-3">
          {filteredBlocks.map(blockId => {
            const isUb = userBlocks.some(b => b.id === blockId);
            return renderBlock(blockId, false, isUb);
          })}

          {/* Add New Block */}
          {showAddCustomBlock ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-bold text-slate-700 mb-3 text-sm">Add New Block</h3>
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
              <Plus size={16} /> Add New Block
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
