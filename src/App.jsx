import React, { useState, useEffect } from 'react';
import { BLOCKS, BLOCK_ORDER, DEPARTURE_BLOCKS, ARRIVAL_BLOCKS, ENROUTE_BLOCKS, EMERGENCY_BLOCKS } from './data/blocks';
import { DEFAULT_AIRPORTS, loadAirports } from './data/airports';
import { loadRadioCalls, getRadioCalls } from './data/radioCalls';
import { getAbbr } from './utils/callSign';
import { getCallOverrides, getTextOverrides, getUserCalls, getPermanentHides, getSeqOverrides, getBlockOverrides, addCallSignHistory, deleteCallSignHistory, getCallSignHistory, setCallOverride, removeCallOverride, setSeqOverride, getSavedProjects, saveProject, deleteProject, getPendingCalls, addUserCall, updateUserCall, getUserBlocks, addUserBlock, deleteUserBlock, getBlockSeqOverrides, setBlockSeqOverride, setBlockSeqOverrides } from './data/userStore';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import BlockSection from './components/BlockSection';
import CallLibrary from './components/CallLibrary';
import ExportModal from './components/ExportModal';

export default function App() {
  const [mode, setMode] = useState('template');
  const [callSign, setCallSign] = useState('');
  const [flightRules, setFlightRules] = useState('vfr');
  const [route, setRoute] = useState([
    { airport: DEFAULT_AIRPORTS[0], type: 'dep', intention: null },
    { airport: DEFAULT_AIRPORTS[4], type: 'arr', intention: null }
  ]);
  const [calls, setCalls] = useState([]);
  const [hidden, setHidden] = useState(new Set());
  const [hiddenBlocks, setHiddenBlocks] = useState(new Set());
  const [collapsed, setCollapsed] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCallData, setEditCallData] = useState(null);
  const [savedToMaster, setSavedToMaster] = useState(false); // tracks if current edit was saved to master
  const [showLib, setShowLib] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showRefKey, setShowRefKey] = useState(() => localStorage.getItem('csg_showRefKey') === 'true');
  const [showHidden, setShowHidden] = useState(false);
  const [hideAtc, setHideAtc] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [draggedId, setDraggedId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [callSignWarning, setCallSignWarning] = useState(false);
  const [radioCallsLoaded, setRadioCallsLoaded] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [customBlockName, setCustomBlockName] = useState('');
  const [draggedBlockKey, setDraggedBlockKey] = useState(null);
  const [newCallId, setNewCallId] = useState(null);
  // Save/Load projects
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [blockInstances, setBlockInstances] = useState([]);

  useEffect(() => {
    Promise.all([loadRadioCalls(), loadAirports()]).then(() => {
      // Restore session state if returning from library editor
      try {
        const saved = sessionStorage.getItem('csg_sessionState');
        if (saved) {
          const s = JSON.parse(saved);
          if (s.calls?.length > 0 || s.blockInstances?.length > 0) {
            setCalls(s.calls || []);
            setBlockInstances(s.blockInstances || []);
            setHidden(new Set(s.hidden || []));
            setHiddenBlocks(new Set(s.hiddenBlocks || []));
            setCallSign(s.callSign || '');
            setFlightRules(s.flightRules || 'vfr');
            if (s.route) setRoute(s.route);
            if (s.mode) setMode(s.mode);
            if (s.currentProjectId) setCurrentProjectId(s.currentProjectId);
          }
        }
      } catch {}
      setRadioCallsLoaded(true);
      // Restore scroll position after render
      requestAnimationFrame(() => {
        const scrollY = sessionStorage.getItem('csg_scrollY');
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY, 10));
          sessionStorage.removeItem('csg_scrollY');
        }
      });
    });
  }, []);

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem('csg_scrollY', String(window.scrollY));
    };
    window.addEventListener('hashchange', saveScroll);
    return () => window.removeEventListener('hashchange', saveScroll);
  }, []);

  // Persist session state so it survives navigation to library editor
  useEffect(() => {
    if (!radioCallsLoaded) return;
    const state = {
      calls, blockInstances, hidden: [...hidden], hiddenBlocks: [...hiddenBlocks],
      callSign, flightRules, route, mode, currentProjectId,
    };
    try { sessionStorage.setItem('csg_sessionState', JSON.stringify(state)); } catch {}
  }, [calls, blockInstances, hidden, hiddenBlocks, callSign, flightRules, route, mode, currentProjectId, radioCallsLoaded]);

  // Undo snapshots full state
  const pushUndo = () => {
    setHistory(h => [...h, { calls, hidden: new Set(hidden), hiddenBlocks: new Set(hiddenBlocks), callSign, flightRules, route, blockInstances, collapsed: new Set(collapsed) }]);
    setRedoStack([]);
  };

  // Drag and drop (calls) — supports cross-block
  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('is-dragging');
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, targetId, position) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      pushUndo();
      const draggedCall = calls.find(c => c.id === draggedId);
      const targetCall = calls.find(c => c.id === targetId);
      if (!draggedCall || !targetCall) { setDraggedId(null); document.body.classList.remove('is-dragging'); return; }
      const newCalls = [...calls];
      const oldIndex = newCalls.findIndex(c => c.id === draggedId);
      const [removed] = newCalls.splice(oldIndex, 1);
      removed._blockKey = targetCall._blockKey;
      removed.block = targetCall.block;
      let newIndex = newCalls.findIndex(c => c.id === targetId);
      if (position === 'below') newIndex += 1;
      newCalls.splice(newIndex, 0, removed);
      newCalls.forEach((c, i) => { c.seq = i + 1; });
      // Persist new sequence for the dragged call so it sticks on regenerate
      const movedCall = newCalls.find(c => c.id === draggedId);
      if (movedCall) {
        const blockCalls = newCalls.filter(c => c._blockKey === movedCall._blockKey);
        blockCalls.forEach((c, i) => {
          const seq = i + 1;
          c.seq = seq;
          if (c.userAdded) {
            const existing = getUserCalls().find(u => c.id.startsWith(u.id));
            if (existing) updateUserCall(existing.id, { seq });
          } else {
            if (c._baseId) setSeqOverride(c._baseId, seq);
          }
        });
      }
      setCalls(newCalls);
    }
    setDraggedId(null);
    document.body.classList.remove('is-dragging');
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    document.body.classList.remove('is-dragging');
  };
  const handleCallDropToBlock = (callId, targetBlockKey) => {
    const draggedCall = calls.find(c => c.id === callId);
    if (!draggedCall || draggedCall._blockKey === targetBlockKey) return;
    pushUndo();
    const newCalls = calls.map(c => {
      if (c.id === callId) {
        const inst = blockInstances.find(i => i.key === targetBlockKey);
        return { ...c, _blockKey: targetBlockKey, block: inst?.blockType || c.block };
      }
      return c;
    });
    setCalls(newCalls);
    setDraggedId(null);
    document.body.classList.remove('is-dragging');
  };

  // Drag and drop (blocks)
  const handleBlockDragStart = (e, blockKey) => {
    setDraggedBlockKey(blockKey);
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('is-dragging');
  };
  const handleBlockDrop = (e, targetBlockKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedBlockKey && draggedBlockKey !== targetBlockKey) {
      pushUndo();
      setBlockInstances(prev => {
        const oldIdx = prev.findIndex(i => i.key === draggedBlockKey);
        const newIdx = prev.findIndex(i => i.key === targetBlockKey);
        const next = [...prev];
        const [removed] = next.splice(oldIdx, 1);
        next.splice(newIdx, 0, removed);
        return next;
      });
    }
    setDraggedBlockKey(null);
    document.body.classList.remove('is-dragging');
  };
  const handleBlockDragEnd = () => {
    setDraggedBlockKey(null);
    document.body.classList.remove('is-dragging');
  };

  const abbr = getAbbr(callSign);
  const depApt = route.find(s => s.type === 'dep')?.airport;
  const arrApt = route.find(s => s.type === 'arr')?.airport;
  const depTowered = depApt?.towered || false;
  const arrTowered = arrApt?.towered || false;
  const depFlightType = `${flightRules}_${depTowered ? 't' : 'nt'}`;
  const arrFlightType = `${flightRules}_${arrTowered ? 't' : 'nt'}`;

  const vars = {
    CS_Full: callSign,
    CS_Abbr: abbr,
    Dep_Name: depApt?.abridged || depApt?.name || '[Departure]',
    Dep_Abridged: depApt?.abridged || '[Departure]',
    Dep_Traffic: depApt ? `${depApt.abridged} Traffic` : '[Departure] Traffic',
    Arr_Name: arrApt?.abridged || arrApt?.name || '[Arrival]',
    Arr_Abridged: arrApt?.abridged || '[Arrival]',
    Arr_Traffic: arrApt ? `${arrApt.abridged} Traffic` : '[Arrival] Traffic',
  };

  const generate = () => {
    if (mode !== 'blank' && (!callSign || callSign.trim().length < 3)) {
      setCallSignWarning(true);
      return;
    }
    setCallSignWarning(false);
    if (callSign) addCallSignHistory(callSign);
    pushUndo();

    if (mode === 'blank') {
      setCalls([]);
      setBlockInstances([]);
      setHidden(new Set());
      setHiddenBlocks(new Set());
      setCurrentProjectId(null);
      return;
    }

    const RADIO_CALLS = getRadioCalls();
    const allCalls = [];
    const instances = [];

    const addBlockInst = (blockType, airport, flightType, legIdx, legVars, suffix) => {
      const blockKey = `${blockType}_${suffix}_L${legIdx}`;
      const matched = RADIO_CALLS
        .filter(c => c.block === blockType && c.applies.includes(flightType))
        .sort((a, b) => a.seq - b.seq);
      if (matched.length === 0) return;

      const blockDef = BLOCKS[blockType];
      const isTowered = airport?.towered || false;
      const target = isTowered ? blockDef?.targetTowered : blockDef?.targetNonTowered;
      if (!target && blockType !== 'emergency') return;

      let contextLabel = '';
      if (airport) {
        const aptName = airport.abridged || airport.name || airport.id;
        const prepositions = {
          startup: `at ${aptName}`, clearance_delivery: `at ${aptName}`,
          taxi_out: `at ${aptName}`, runup: `at ${aptName}`,
          takeoff: `from ${aptName}`, departure: `from ${aptName}`, climbout: `from ${aptName}`,
          enroute: `to ${aptName}`, holding: `near ${aptName}`,
          descent: `into ${aptName}`, pattern: `at ${aptName}`, approach: `into ${aptName}`,
          landing: `at ${aptName}`, taxi_in: `at ${aptName}`, shutdown: `at ${aptName}`,
        };
        contextLabel = prepositions[blockType] || '';
      }

      instances.push({
        key: blockKey, blockType,
        name: blockDef?.name || blockType, contextLabel, target, isTowered, airport,
      });

      matched.forEach(call => {
        allCalls.push({
          ...call,
          id: `${call.id}_${blockKey}_${Math.random().toString(36).slice(2, 8)}`,
          _baseId: call.id,
          _blockKey: blockKey, _legVars: legVars, _legIdx: legIdx, _phase: suffix,
        });
      });
    };

    for (let legIdx = 0; legIdx < route.length - 1; legIdx++) {
      const fromStop = route[legIdx];
      const toStop = route[legIdx + 1];
      if (!fromStop.airport || !toStop.airport) continue;

      const fromTowered = fromStop.airport.towered;
      const toTowered = toStop.airport.towered;
      const fromFlightType = `${flightRules}_${fromTowered ? 't' : 'nt'}`;
      const toFlightType = `${flightRules}_${toTowered ? 't' : 'nt'}`;

      const legVars = {
        CS_Full: callSign || '[Call Sign]', CS_Abbr: abbr || '[Call Sign]',
        Dep_Name: fromStop.airport.abridged || fromStop.airport.name, Dep_Abridged: fromStop.airport.abridged,
        Dep_Traffic: `${fromStop.airport.abridged} Traffic`,
        Arr_Name: toStop.airport.abridged || toStop.airport.name, Arr_Abridged: toStop.airport.abridged,
        Arr_Traffic: `${toStop.airport.abridged} Traffic`,
      };

      const depBlocks = (() => {
        if (legIdx === 0) return DEPARTURE_BLOCKS;
        switch (fromStop.intention) {
          case 'touch_and_go': case 'stop_and_go': return ['departure', 'climbout'];
          case 'full_stop': case 'taxi_back': return ['taxi_out', 'takeoff', 'departure', 'climbout'];
          default: return DEPARTURE_BLOCKS;
        }
      })();
      depBlocks.forEach(b => addBlockInst(b, fromStop.airport, fromFlightType, legIdx, legVars, 'dep'));

      ENROUTE_BLOCKS.forEach(b => addBlockInst(b, toStop.airport, fromFlightType, legIdx, legVars, 'enr'));

      const isFinalDest = legIdx === route.length - 2;
      const arrivalBlocks = (() => {
        const intention = toStop.intention;
        if (['touch_and_go', 'stop_and_go', 'full_stop', 'taxi_back'].includes(intention)) {
          return ['descent', 'pattern', 'approach', 'landing'];
        } else if (isFinalDest) {
          return [...ARRIVAL_BLOCKS];
        }
        return ['descent', 'pattern', 'approach', 'landing'];
      })();
      arrivalBlocks.forEach(b => addBlockInst(b, toStop.airport, toFlightType, legIdx, legVars, 'arr'));
    }

    // Emergency
    const firstFlightType = `${flightRules}_${route[0]?.airport?.towered ? 't' : 'nt'}`;
    EMERGENCY_BLOCKS.forEach(b => {
      const blockKey = `${b}_emerg`;
      const matched = getRadioCalls().filter(c => c.block === b && c.applies.includes(firstFlightType)).sort((a, b2) => a.seq - b2.seq);
      if (matched.length === 0) return;
      instances.push({ key: blockKey, blockType: b, name: BLOCKS[b]?.name || b, contextLabel: '', target: BLOCKS[b]?.targetTowered || '121.5', isTowered: false });
      matched.forEach(call => {
        allCalls.push({ ...call, id: `${call.id}_${blockKey}_${Math.random().toString(36).slice(2, 8)}`, _baseId: call.id, _blockKey: blockKey, _phase: 'emergency' });
      });
    });

    // Apply overrides
    const callOverrides = getCallOverrides();
    const seqOvr = getSeqOverrides();
    allCalls.forEach(call => {
      if (call._baseId && callOverrides[call._baseId]) { const o = callOverrides[call._baseId]; if (o.text) call.text = o.text; if (o.type) call.type = o.type; if (o.applies) call.applies = o.applies; call._hasOverride = true; call._overrideBaseId = call._baseId; }
      if (call._baseId && seqOvr[call._baseId]) call.seq = seqOvr[call._baseId];
    });

    const blkOverrides = getBlockOverrides();
    instances.forEach(inst => {
      const bo = blkOverrides[inst.blockType];
      if (bo) { if (bo.name) inst.name = bo.name; if (inst.isTowered && bo.targetTowered) inst.target = bo.targetTowered; if (!inst.isTowered && bo.targetNonTowered) inst.target = bo.targetNonTowered; }
    });

    const storedUserCalls = getUserCalls();
    storedUserCalls.forEach(uc => {
      const matchingInst = instances.find(i => i.blockType === uc.block);
      if (matchingInst) {
        allCalls.push({ ...uc, id: `${uc.id}_${matchingInst.key}_${Math.random().toString(36).slice(2, 8)}`, _blockKey: matchingInst.key });
      }
    });

    const permHides = getPermanentHides();
    const initialHidden = new Set();
    allCalls.forEach(call => { if (call._baseId && permHides.has(call._baseId)) initialHidden.add(call.id); });


    setCalls(allCalls);
    setBlockInstances(instances);
    setHidden(initialHidden);
    setHiddenBlocks(new Set());
    setCurrentProjectId(null);
  };

  // Edit handlers
  const startEdit = (id) => {
    const call = calls.find(c => c.id === id);
    if (call) {
      setEditingId(id);
      setSavedToMaster(false);
      if (call.type === 'brief' && call.text?.includes('\n')) {
        const nlIdx = call.text.indexOf('\n');
        const title = call.text.slice(0, nlIdx);
        const body = call.text.slice(nlIdx + 1);
        setEditText(body);
        setEditCallData({ ...call, _briefTitle: title });
      } else {
        setEditText(call.text);
        setEditCallData(call);
      }
    }
  };
  const getFullEditText = () => {
    if (editCallData?._briefTitle) return `${editCallData._briefTitle}\n${editText}`;
    return editText;
  };
  const saveEdit = () => {
    pushUndo();
    const fullText = getFullEditText();
    setCalls(calls.map(c => c.id === editingId ? { ...c, text: fullText, type: editCallData?.type || c.type } : c));
    setEditingId(null);
    setEditCallData(null);
    setSavedToMaster(false);
  };
  const saveToMaster = (applies) => {
    // Save current editing call's text/type to master overrides (persists across generations)
    if (!editingId) return;
    const call = calls.find(c => c.id === editingId);
    if (!call) return;
    const newType = editCallData?.type || call.type;
    const fullText = getFullEditText();
    const appliesList = applies && applies.length > 0 ? applies : (call.applies || ['vfr_nt', 'vfr_t', 'ifr_nt', 'ifr_t']);
    if (call.userAdded) {
      const existing = getUserCalls().find(u => call.id.startsWith(u.id));
      if (existing) {
        updateUserCall(existing.id, { text: fullText, type: newType, applies: appliesList });
      } else {
        addUserCall({ id: `USER_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, block: call.block, group: call.group, seq: call.seq, type: newType, text: fullText, applies: appliesList });
      }
      setCalls(calls.map(c => c.id === editingId ? { ...c, text: fullText, type: newType, applies: appliesList } : c));
      setSavedToMaster(true);
      return;
    }
    const baseId = call._baseId;
    if (baseId) {
      setCallOverride(baseId, { text: fullText, type: newType, applies: appliesList });
      setCalls(calls.map(c => c.id === editingId ? { ...c, text: fullText, type: newType, applies: appliesList } : c));
      setSavedToMaster(true);
    }
  };
  const resetToDefault = () => {
    if (!editingId) return;
    const call = calls.find(c => c.id === editingId);
    if (!call?._overrideBaseId) return;
    pushUndo();
    removeCallOverride(call._overrideBaseId);
    // Reload the original text from master
    const masterCalls = getRadioCalls();
    const original = masterCalls.find(m => m.id === call._baseId);
    if (original) {
      setCalls(calls.map(c => c.id === editingId ? { ...c, text: original.text, type: original.type, _hasOverride: false, _overrideBaseId: undefined } : c));
      if (original.type === 'brief' && original.text?.includes('\n')) {
        const nlIdx = original.text.indexOf('\n');
        setEditText(original.text.slice(nlIdx + 1));
        setEditCallData(prev => ({ ...prev, _briefTitle: original.text.slice(0, nlIdx) }));
      } else {
        setEditText(original.text);
      }
    }
    setSavedToMaster(false);
  };
  const updateEditingCall = (data) => {
    if (data.text !== undefined) { setEditText(data.text); setSavedToMaster(false); }
    if (data.type !== undefined) { setEditCallData(prev => ({ ...prev, type: data.type })); setSavedToMaster(false); }
    if (data.taxiRoutes !== undefined) {
      pushUndo();
      setCalls(calls.map(c => c.id === editingId ? { ...c, taxiRoutes: data.taxiRoutes } : c));
    }
  };
  const updateCall = (id, data) => {
    pushUndo();
    setCalls(calls.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const toggleHidden = (id, ids) => {
    pushUndo();
    setHidden(h => {
      const n = new Set(h);
      if (ids) { ids.forEach(i => n.delete(i)); }
      else { n.has(id) ? n.delete(id) : n.add(id); }
      return n;
    });
  };
  const toggleHiddenBlock = (id) => {
    pushUndo();
    setHiddenBlocks(h => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleCollapse = (id) => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const undo = () => {
    if (history.length) {
      const current = { calls, hidden: new Set(hidden), hiddenBlocks: new Set(hiddenBlocks), callSign, flightRules, route, blockInstances, collapsed: new Set(collapsed) };
      setRedoStack(r => [...r, current]);
      const prev = history[history.length - 1];
      if (Array.isArray(prev)) { setCalls(prev); }
      else {
        setCalls(prev.calls); setHidden(prev.hidden); setHiddenBlocks(prev.hiddenBlocks);
        if (prev.callSign !== undefined) setCallSign(prev.callSign);
        if (prev.flightRules !== undefined) setFlightRules(prev.flightRules);
        if (prev.route !== undefined) setRoute(prev.route);
        if (prev.blockInstances !== undefined) setBlockInstances(prev.blockInstances);
        if (prev.collapsed !== undefined) setCollapsed(prev.collapsed);
      }
      setHistory(h => h.slice(0, -1));
    }
  };

  const redo = () => {
    if (redoStack.length) {
      const current = { calls, hidden: new Set(hidden), hiddenBlocks: new Set(hiddenBlocks), callSign, flightRules, route, blockInstances, collapsed: new Set(collapsed) };
      setHistory(h => [...h, current]);
      const next = redoStack[redoStack.length - 1];
      setCalls(next.calls); setHidden(next.hidden); setHiddenBlocks(next.hiddenBlocks);
      if (next.callSign !== undefined) setCallSign(next.callSign);
      if (next.flightRules !== undefined) setFlightRules(next.flightRules);
      if (next.route !== undefined) setRoute(next.route);
      if (next.blockInstances !== undefined) setBlockInstances(next.blockInstances);
      if (next.collapsed !== undefined) setCollapsed(next.collapsed);
      setRedoStack(r => r.slice(0, -1));
    }
  };

  const addFromLib = (call, blockKey) => {
    pushUndo();
    let targetBlockKey = blockKey || blockInstances.find(i => i.blockType === call.block)?.key;
    // If no matching block instance exists, create one
    if (!targetBlockKey) {
      const newKey = `${call.block}_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const blockDef = BLOCKS[call.block];
      const name = blockDef?.name || call.block;
      const target = blockDef ? (depTowered ? blockDef.targetTowered : blockDef.targetNonTowered) || '' : '';
      setBlockInstances(prev => [...prev, {
        key: newKey, blockType: call.block, name, contextLabel: '', target,
        isTowered: depTowered, isCustom: false, editable: true,
      }]);
      targetBlockKey = newKey;
    }
    const newId = `${call.id}_U_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCalls(prev => [...prev, {
      ...call,
      id: newId,
      _blockKey: targetBlockKey,
      userAdded: true
    }]);
    setNewCallId(newId);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(`call-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });
    setTimeout(() => setNewCallId(null), 2000);
  };

  const addCustomCall = (blockKey) => {
    pushUndo();
    const blockType = blockInstances.find(i => i.key === blockKey)?.blockType || blockKey;
    const newId = `CUSTOM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCalls(prev => [...prev, {
      id: newId,
      block: blockType,
      _blockKey: blockKey,
      seq: 999,
      type: 'radio',
      text: '',
      applies: [depFlightType, arrFlightType],
      userAdded: true
    }]);
    // Immediately open editor for the new call
    setTimeout(() => {
      setEditingId(newId);
      setEditText('');
      setEditCallData({ type: 'radio' });
      setSavedToMaster(false);
    }, 50);
  };

  const addTaxiCall = (blockKey, text) => {
    pushUndo();
    const blockType = blockInstances.find(i => i.key === blockKey)?.blockType || blockKey;
    const newId = `TAXI_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Insert at the top of the block by placing it first in the calls array for this block
    setCalls(prev => {
      const blockCalls = prev.filter(c => (c._blockKey || c.block) === blockKey);
      const firstIdx = prev.findIndex(c => (c._blockKey || c.block) === blockKey);
      const insertIdx = firstIdx >= 0 ? firstIdx : prev.length;
      const newCall = { id: newId, block: blockType, _blockKey: blockKey, seq: -1, type: 'radio', text, applies: [depFlightType, arrFlightType], userAdded: true };
      const next = [...prev];
      next.splice(insertIdx, 0, newCall);
      return next;
    });
    setNewCallId(newId);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(`call-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });
    setTimeout(() => setNewCallId(null), 2000);
  };

  const deleteCall = (id) => {
    pushUndo();
    setCalls(calls.filter(c => c.id !== id));
  };

  const addBlockInstance = (blockType, customName, savedCalls, savedTarget) => {
    pushUndo();
    const key = `${blockType || 'custom'}_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const blockDef = BLOCKS[blockType];
    const name = customName || blockDef?.name || blockType;
    const target = savedTarget || (blockDef ? (depTowered ? blockDef.targetTowered : blockDef.targetNonTowered) || '' : '');
    setBlockInstances(prev => [...prev, {
      key, blockType: blockType || 'custom', name, contextLabel: '', target,
      isTowered: depTowered, isCustom: !blockType || !blockDef, editable: true,
    }]);
    // Add saved calls if provided
    if (savedCalls && savedCalls.length > 0) {
      const newCalls = savedCalls.map((sc, i) => ({
        id: `${sc.id || 'UBLKCALL'}_${key}_${Math.random().toString(36).slice(2, 8)}`,
        _baseId: sc.id, _blockKey: key,
        text: sc.text, type: sc.type || 'radio', seq: sc.seq || i + 1,
        block: blockType || 'custom', userAdded: true,
      }));
      setCalls(prev => [...prev, ...newCalls]);
    }
  };

  const saveBlockToLibrary = (blockKey) => {
    const inst = blockInstances.find(i => i.key === blockKey);
    if (!inst) return null;
    const existing = getUserBlocks();
    // Auto-increment name if duplicate: "Enroute" → "Enroute (2)" → "Enroute (3)"
    let saveName = inst.name;
    const names = new Set(existing.map(b => b.name));
    if (names.has(saveName)) {
      let n = 2;
      while (names.has(`${inst.name} (${n})`)) n++;
      saveName = `${inst.name} (${n})`;
    }
    // Gather calls in this block
    const blockCalls = calls.filter(c => c._blockKey === blockKey).map((c, i) => ({
      id: `UBLKCALL_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      text: c.text || '', type: c.type || 'radio', seq: i + 1,
    }));
    const idx = blockInstances.indexOf(inst);
    const blockId = `UBLK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    addUserBlock({ id: blockId, name: saveName, target: inst.target || '', seq: idx + 1, calls: blockCalls });
    return blockId;
  };

  const unsaveBlockFromLibrary = (blockName) => {
    const existing = getUserBlocks();
    const match = existing.find(b => b.name === blockName);
    if (match) deleteUserBlock(match.id);
  };

  const renameBlockInstance = (blockKey, newName) => {
    setBlockInstances(prev => prev.map(inst =>
      inst.key === blockKey ? { ...inst, name: newName } : inst
    ));
  };

  const updateBlockTarget = (blockKey, newTarget) => {
    setBlockInstances(prev => prev.map(inst =>
      inst.key === blockKey ? { ...inst, target: newTarget } : inst
    ));
  };

  // --- Save/Load Projects ---
  const handleSaveProject = (name) => {
    const id = currentProjectId || `proj_${Date.now()}`;
    const project = {
      id, name: name || `${callSign || 'Untitled'} - ${new Date().toLocaleDateString()}`,
      savedAt: new Date().toISOString(),
      callSign, flightRules, mode,
      route: route.map(s => ({ ...s, airport: s.airport ? { id: s.airport.id, name: s.airport.name, abridged: s.airport.abridged, city: s.airport.city, state: s.airport.state, towered: s.airport.towered, runways: s.airport.runways } : null })),
      calls: calls.map(c => ({ ...c })),
      blockInstances: blockInstances.map(i => ({ ...i, airport: i.airport ? { id: i.airport.id, name: i.airport.name, abridged: i.airport.abridged, towered: i.airport.towered } : undefined })),
      hidden: [...hidden],
      hiddenBlocks: [...hiddenBlocks],
    };
    saveProject(project);
    setCurrentProjectId(id);
    setShowSaveDialog(false);
  };

  const handleLoadProject = (project) => {
    setCalls(project.calls || []);
    setBlockInstances(project.blockInstances || []);
    setHidden(new Set(project.hidden || []));
    setHiddenBlocks(new Set(project.hiddenBlocks || []));
    setCallSign(project.callSign || '');
    setFlightRules(project.flightRules || 'vfr');
    if (project.route) setRoute(project.route);
    if (project.mode) setMode(project.mode);
    setCurrentProjectId(project.id);
    setShowLoadDialog(false);
    setCollapsed(new Set());
  };

  // Export
  const getExportData = () => ({
    callSign, flightRules, route, blockInstances, calls, hidden, hiddenBlocks, vars, abbr,
  });

  const handleExport = () => setShowExport(true);

  // Pick up pending calls from library editor
  useEffect(() => {
    const checkPending = () => {
      const pending = getPendingCalls();
      if (pending.length > 0) {
        pushUndo();
        setCalls(prev => [...prev, ...pending.map(c => ({
          ...c,
          _blockKey: blockInstances.find(i => i.blockType === c.block)?.key || c.block,
          userAdded: true,
          taxiRoutes: c.isTaxiBrief ? [{ runway: '', route: '' }] : undefined,
        }))]);
      }
    };
    checkPending();
    window.addEventListener('focus', checkPending);
    return () => window.removeEventListener('focus', checkPending);
  }, [blockInstances]);

  // Auto-scroll when dragging near viewport edges
  useEffect(() => {
    let animId = null;
    const EDGE = 80; // px from edge to start scrolling
    const SPEED = 12; // px per frame
    const onDragOver = (e) => {
      if (!draggedId && !draggedBlockKey) return;
      const y = e.clientY;
      const h = window.innerHeight;
      if (y < EDGE) {
        window.scrollBy(0, -SPEED);
      } else if (y > h - EDGE) {
        window.scrollBy(0, SPEED);
      }
    };
    document.addEventListener('dragover', onDragOver);
    return () => { document.removeEventListener('dragover', onDragOver); if (animId) cancelAnimationFrame(animId); };
  }, [draggedId, draggedBlockKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history, redoStack]);

  // Group calls by block instance key
  const callsByBlockKey = calls.reduce((acc, c) => {
    const key = c._blockKey || c.block;
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  if (!radioCallsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-50 flex items-center justify-center">
        <p className="text-slate-500">Loading radio calls database...</p>
      </div>
    );
  }

  const hasSheet = calls.length > 0 || blockInstances.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-50 p-4 font-sans">
      {/* Sticky header */}
      <Header
        historyLen={history.length}
        redoLen={redoStack.length}
        showLib={showLib}
        hideAtc={hideAtc}
        showRefKey={showRefKey}
        onUndo={undo}
        onRedo={redo}
        onToggleLib={() => setShowLib(!showLib)}
        onToggleAtc={() => setHideAtc(!hideAtc)}
        onToggleRefKey={() => {
          const next = !showRefKey;
          setShowRefKey(next);
          localStorage.setItem('csg_showRefKey', String(next));
        }}
        onExport={handleExport}
        onSave={() => {
          if (currentProjectId) handleSaveProject();
          else setShowSaveDialog(true);
        }}
        onSaveAs={() => { setCurrentProjectId(null); setShowSaveDialog(true); }}
        onLoad={() => setShowLoadDialog(true)}
        hasSheet={hasSheet}
        currentProjectId={currentProjectId}
      />

      <main className="max-w-5xl mx-auto flex gap-6">
        {showLib && (
          <CallLibrary
            radioCalls={getRadioCalls()}
            libSearch={libSearch}
            onLibSearchChange={setLibSearch}
            onAddFromLib={addFromLib}
            onAddBlockFromLib={(ub) => addBlockInstance(null, ub.name, ub.calls || [], ub.target)}
            onClose={() => setShowLib(false)}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex gap-3 mb-6">
            {[['template', 'Generate from Template'], ['blank', 'Build from Scratch']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-3.5 rounded-xl font-semibold transition-all ${mode === m ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                pushUndo();
                setCalls([]); setBlockInstances([]); setHidden(new Set()); setHiddenBlocks(new Set());
                setCollapsed(new Set()); setEditingId(null); setCurrentProjectId(null);
                setCallSign(''); setFlightRules('vfr');
                setRoute([
                  { airport: null, type: 'dep', intention: null },
                  { airport: null, type: 'arr', intention: null }
                ]);
                setMode('template');
                try { sessionStorage.removeItem('csg_sessionState'); } catch {}
              }}
              className="px-5 py-3.5 bg-white text-slate-500 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-semibold text-sm"
            >
              New
            </button>
          </div>

          <ConfigPanel
            mode={mode}
            callSign={callSign}
            flightRules={flightRules}
            route={route}
            abbr={abbr}
            callSignWarning={callSignWarning}
            callSignHistory={getCallSignHistory()}
            onCallSignChange={setCallSign}
            onFlightRulesChange={setFlightRules}
            onRouteChange={(r) => { pushUndo(); setRoute(r); }}
            onSaveCallSign={() => addCallSignHistory(callSign)}
            onDeleteCallSign={(cs) => deleteCallSignHistory(cs)}
          />

          <button onClick={generate} className="w-full py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all mb-6 text-lg">
            {mode === 'template' ? 'Generate Comm Sheet' : 'Start Blank Sheet'}
          </button>

          {hasSheet && (
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 flex-wrap gap-4">
                <h2 className="text-xl font-bold text-slate-800">
                  Comm Sheet{currentProjectId && (() => { const p = getSavedProjects().find(p => p.id === currentProjectId); return p ? ` - ${p.name}` : ''; })()}
                </h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setCollapsed(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={() => setCollapsed(new Set(blockInstances.map(i => i.key)))}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Collapse All
                  </button>
                  {hidden.size > 0 && (
                    <button
                      onClick={() => { pushUndo(); setHidden(new Set()); }}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Unhide All ({hidden.size})
                    </button>
                  )}
                  <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {calls.filter(c => !hidden.has(c.id) && !hiddenBlocks.has(c._blockKey || c.block)).length} visible
                  </span>
                </div>
              </div>

              {blockInstances.map(inst => (
                <BlockSection
                  key={inst.key}
                  blockKey={inst.key}
                  blockId={inst.blockType}
                  blockName={inst.name}
                  contextLabel={inst.contextLabel}
                  target={inst.target}
                  isTowered={inst.isTowered}
                  blockCalls={callsByBlockKey[inst.key]}
                  hidden={hidden}
                  hiddenBlocks={hiddenBlocks}
                  collapsed={collapsed}
                  showHidden={showHidden}
                  hideAtc={hideAtc}
                  editingId={editingId}
                  editText={editText}
                  briefTitle={editCallData?._briefTitle || null}
                  vars={vars}
                  onToggleCollapse={toggleCollapse}
                  onToggleHiddenBlock={toggleHiddenBlock}
                  onAddCustomCall={addCustomCall}
                  onRenameBlock={renameBlockInstance}
                  onUpdateTarget={updateBlockTarget}
                  onEdit={startEdit}
                  onSave={saveEdit}
                  onCancel={() => { setEditingId(null); setEditCallData(null); setSavedToMaster(false); }}
                  onChange={updateEditingCall}
                  onToggleHidden={toggleHidden}
                  onDelete={deleteCall}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  draggedId={draggedId}
                  updateEditingCall={updateEditingCall}
                  updateCall={updateCall}
                  onBlockDragStart={handleBlockDragStart}
                  onBlockDragOver={() => {}}
                  onBlockDrop={handleBlockDrop}
                  onBlockDragEnd={handleBlockDragEnd}
                  isDraggingBlock={draggedBlockKey === inst.key}
                  onCallDropToBlock={handleCallDropToBlock}
                  onSaveToMaster={saveToMaster}
                  savedToMaster={savedToMaster}
                  onResetToDefault={resetToDefault}
                  onAddTaxiCall={addTaxiCall}
                  currentFlightType={inst.isTowered ? `${flightRules}_t` : `${flightRules}_nt`}
                  newCallId={newCallId}
                  onSaveBlockToLibrary={saveBlockToLibrary}
                  onUnsaveBlockFromLibrary={unsaveBlockFromLibrary}
                />
              ))}

              {/* Add Block Button (bottom) */}
              <div className="mt-4 relative">
                <button
                  onClick={() => setShowAddBlock(!showAddBlock)}
                  className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
                >
                  + Add Block
                </button>
                {showAddBlock && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto bottom-full mb-2">
                    {BLOCK_ORDER.map(bt => (
                      <button key={bt} onClick={() => { addBlockInstance(bt); setShowAddBlock(false); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0">
                        {BLOCKS[bt]?.name}
                      </button>
                    ))}
                    {getUserBlocks().length > 0 && (
                      <>
                        <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-t border-slate-200">Saved Custom Blocks</div>
                        {getUserBlocks().map(ub => (
                          <button key={ub.id} onClick={() => { addBlockInstance(null, ub.name, ub.calls || [], ub.target); setShowAddBlock(false); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-green-50 border-b border-slate-50 last:border-0 flex items-center justify-between">
                            <span>{ub.name}</span>
                            <span className="text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded">saved</span>
                          </button>
                        ))}
                      </>
                    )}
                    <div className="border-t border-slate-200 p-3">
                      <div className="flex gap-2">
                        <input type="text" value={customBlockName} onChange={(e) => setCustomBlockName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customBlockName.trim()) { addBlockInstance(null, customBlockName.trim()); setCustomBlockName(''); setShowAddBlock(false); } }} placeholder="Custom section name..." className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => { if (customBlockName.trim()) { addBlockInstance(null, customBlockName.trim()); setCustomBlockName(''); setShowAddBlock(false); } }} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-medium">Add</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasSheet && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <h3 className="text-xl font-bold text-slate-700 mb-2">
                {mode === 'blank' ? 'Blank Sheet' : 'No Sheet Generated'}
              </h3>
              <p className="text-slate-500 mb-4">
                {mode === 'blank' ? 'Click "Start Blank Sheet" above, then add blocks' : 'Configure your route and click Generate'}
              </p>
            </div>
          )}
        </div>
      </main>

      {showExport && <ExportModal exportData={getExportData()} onClose={() => setShowExport(false)} />}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96">
            <h3 className="font-bold text-lg text-slate-800 mb-4">Save Comm Sheet</h3>
            <input type="text" value={saveAsName} onChange={(e) => setSaveAsName(e.target.value)} placeholder={`${callSign || 'Untitled'} - ${new Date().toLocaleDateString()}`} className="w-full px-4 py-3 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { handleSaveProject(saveAsName.trim() || undefined); setSaveAsName(''); } }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowSaveDialog(false); setSaveAsName(''); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm">Cancel</button>
              <button onClick={() => { handleSaveProject(saveAsName.trim() || undefined); setSaveAsName(''); }} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[500px] max-h-[70vh] flex flex-col">
            <h3 className="font-bold text-lg text-slate-800 mb-4">Load Saved Comm Sheet</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {getSavedProjects().length === 0 ? (
                <p className="text-sm text-slate-400 italic">No saved projects yet.</p>
              ) : getSavedProjects().map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                  <div className="flex-1 cursor-pointer" onClick={() => handleLoadProject(p)}>
                    <div className="font-medium text-slate-700">{p.name}</div>
                    <div className="text-xs text-slate-400">{new Date(p.savedAt).toLocaleString()}</div>
                  </div>
                  <button onClick={() => { deleteProject(p.id); setShowLoadDialog(false); setTimeout(() => setShowLoadDialog(true), 50); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-xs">Delete</button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowLoadDialog(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-5xl mx-auto mt-10 py-6 text-center">
        <p className="text-xs text-slate-400">Keyboard: Ctrl+Z to undo | Ctrl+Y to redo | Click call to edit | Drag to reorder</p>
        <p className="text-xs text-slate-400 mt-2">
          {(() => {
            const overrides = Object.keys(getCallOverrides()).length;
            const userCalls = getUserCalls().length;
            if (!overrides && !userCalls) return null;
            return (
              <span>
                {overrides > 0 && <span>{overrides} master override{overrides !== 1 ? 's' : ''}</span>}
                {overrides > 0 && userCalls > 0 && ' | '}
                {userCalls > 0 && <span>{userCalls} user call{userCalls !== 1 ? 's' : ''}</span>}
                {' — '}
                <button
                  onClick={() => {
                    if (confirm('Clear all master overrides and user-added calls from the library? This cannot be undone.')) {
                      localStorage.removeItem('csg_callOverrides');
                      localStorage.removeItem('csg_userCalls');
                      localStorage.removeItem('csg_seqOverrides');
                      alert('Cleared. Re-generate your sheet to see defaults.');
                    }
                  }}
                  className="underline hover:text-red-500"
                >
                  clear all customizations
                </button>
              </span>
            );
          })()}
        </p>
      </footer>
    </div>
  );
}
