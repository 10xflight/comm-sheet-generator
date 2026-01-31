const KEYS = {
  CALL_OVERRIDES: 'csg_callOverrides',
  USER_CALLS: 'csg_userCalls',
  PERMANENT_HIDES: 'csg_permanentHides',
  CALLSIGN_HISTORY: 'csg_callSignHistory',
  BLOCK_OVERRIDES: 'csg_blockOverrides',
  SEQ_OVERRIDES: 'csg_seqOverrides',
  USER_BLOCKS: 'csg_userBlocks',
  BLOCK_SEQ_OVERRIDES: 'csg_blockSeqOverrides',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Call Overrides (text, type, applies) ---
// { [callId]: { text?: string, type?: string, applies?: string[] } }
export function getCallOverrides() {
  // Migrate old text-only overrides
  const old = load('csg_textOverrides', null);
  if (old) {
    const merged = load(KEYS.CALL_OVERRIDES, {});
    Object.entries(old).forEach(([id, text]) => {
      if (!merged[id]) merged[id] = {};
      merged[id].text = text;
    });
    save(KEYS.CALL_OVERRIDES, merged);
    localStorage.removeItem('csg_textOverrides');
    return merged;
  }
  return load(KEYS.CALL_OVERRIDES, {});
}

// For backward compat
export function getTextOverrides() {
  const overrides = getCallOverrides();
  const result = {};
  Object.entries(overrides).forEach(([id, o]) => {
    if (o.text) result[id] = o.text;
  });
  return result;
}

export function setCallOverride(callId, updates) {
  const overrides = getCallOverrides();
  overrides[callId] = { ...(overrides[callId] || {}), ...updates };
  save(KEYS.CALL_OVERRIDES, overrides);
}

export function setTextOverride(callId, text) {
  setCallOverride(callId, { text });
}

export function removeCallOverride(callId) {
  const overrides = getCallOverrides();
  delete overrides[callId];
  save(KEYS.CALL_OVERRIDES, overrides);
}

export function removeTextOverride(callId) {
  removeCallOverride(callId);
}

export function restoreAllDefaults() {
  save(KEYS.CALL_OVERRIDES, {});
  save(KEYS.PERMANENT_HIDES, []);
  save(KEYS.BLOCK_OVERRIDES, {});
  save(KEYS.SEQ_OVERRIDES, {});
  save(KEYS.BLOCK_SEQ_OVERRIDES, {});
  // User calls and user blocks are kept
}

// --- Sequence Overrides ---
// { [callId]: number } — overridden sequence for master calls
export function getSeqOverrides() {
  return load(KEYS.SEQ_OVERRIDES, {});
}

export function setSeqOverride(callId, seq) {
  const overrides = getSeqOverrides();
  overrides[callId] = seq;
  save(KEYS.SEQ_OVERRIDES, overrides);
}

export function setSeqOverrides(map) {
  const overrides = getSeqOverrides();
  Object.assign(overrides, map);
  save(KEYS.SEQ_OVERRIDES, overrides);
}

// --- User-Added Calls ---
export function getUserCalls() {
  return load(KEYS.USER_CALLS, []);
}

export function addUserCall(call) {
  const calls = getUserCalls();
  calls.push({ ...call, userAdded: true });
  save(KEYS.USER_CALLS, calls);
}

export function updateUserCall(callId, updates) {
  const calls = getUserCalls();
  const idx = calls.findIndex(c => c.id === callId);
  if (idx >= 0) {
    calls[idx] = { ...calls[idx], ...updates };
    save(KEYS.USER_CALLS, calls);
  }
}

export function deleteUserCall(callId) {
  save(KEYS.USER_CALLS, getUserCalls().filter(c => c.id !== callId));
}

// --- Permanent Hides ---
export function getPermanentHides() {
  return new Set(load(KEYS.PERMANENT_HIDES, []));
}

export function setPermanentHide(callId, hidden) {
  const set = new Set(load(KEYS.PERMANENT_HIDES, []));
  if (hidden) set.add(callId);
  else set.delete(callId);
  save(KEYS.PERMANENT_HIDES, [...set]);
}

// --- Block Overrides (name, targetTowered, targetNonTowered) ---
// { [blockId]: { name?: string, targetTowered?: string, targetNonTowered?: string } }
export function getBlockOverrides() {
  return load(KEYS.BLOCK_OVERRIDES, {});
}

export function setBlockOverride(blockId, updates) {
  const overrides = getBlockOverrides();
  overrides[blockId] = { ...(overrides[blockId] || {}), ...updates };
  save(KEYS.BLOCK_OVERRIDES, overrides);
}

// --- Callsign History ---
export function getCallSignHistory() {
  return load(KEYS.CALLSIGN_HISTORY, []);
}

export function addCallSignHistory(cs) {
  if (!cs || cs.trim().length < 3) return;
  const trimmed = cs.trim();
  let history = getCallSignHistory().filter(h => h !== trimmed);
  history.unshift(trimmed);
  if (history.length > 20) history = history.slice(0, 20);
  save(KEYS.CALLSIGN_HISTORY, history);
}

export function deleteCallSignHistory(cs) {
  save(KEYS.CALLSIGN_HISTORY, getCallSignHistory().filter(h => h !== cs));
}

// --- Decimal Sequencing Helper (two-digit) ---
export function calcDecimalSeq(beforeSeq, afterSeq) {
  if (beforeSeq == null && afterSeq == null) return 1;
  if (beforeSeq == null) return Math.round((afterSeq - 0.50) * 100) / 100;
  if (afterSeq == null) return Math.round((beforeSeq + 0.50) * 100) / 100;
  return Math.round(((beforeSeq + afterSeq) / 2) * 100) / 100;
}

export function formatSeq(seq) {
  return Number(seq).toFixed(2);
}

// --- Saved Projects ---
const PROJECTS_KEY = 'csg_savedProjects';

export function getSavedProjects() {
  return load(PROJECTS_KEY, []);
}

export function saveProject(project) {
  // project: { id, name, savedAt, callSign, flightRules, route, calls, blockInstances, hidden, hiddenBlocks }
  const projects = getSavedProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  save(PROJECTS_KEY, projects);
}

export function deleteProject(projectId) {
  save(PROJECTS_KEY, getSavedProjects().filter(p => p.id !== projectId));
}

export function getProject(projectId) {
  return getSavedProjects().find(p => p.id === projectId) || null;
}

// --- User Blocks (custom blocks saved to library) ---
// [{ id, name, target, seq }]
export function getUserBlocks() {
  return load(KEYS.USER_BLOCKS, []);
}

export function addUserBlock(block) {
  const blocks = getUserBlocks();
  blocks.push(block);
  save(KEYS.USER_BLOCKS, blocks);
}

export function updateUserBlock(blockId, updates) {
  const blocks = getUserBlocks();
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx >= 0) {
    blocks[idx] = { ...blocks[idx], ...updates };
    save(KEYS.USER_BLOCKS, blocks);
  }
}

export function deleteUserBlock(blockId) {
  save(KEYS.USER_BLOCKS, getUserBlocks().filter(b => b.id !== blockId));
}

// --- Block Sequence Overrides ---
// { [blockType]: number } — separate decimal system for block ordering
export function getBlockSeqOverrides() {
  return load(KEYS.BLOCK_SEQ_OVERRIDES, {});
}

export function setBlockSeqOverride(blockType, seq) {
  const overrides = getBlockSeqOverrides();
  overrides[blockType] = seq;
  save(KEYS.BLOCK_SEQ_OVERRIDES, overrides);
}

export function setBlockSeqOverrides(map) {
  const overrides = getBlockSeqOverrides();
  Object.assign(overrides, map);
  save(KEYS.BLOCK_SEQ_OVERRIDES, overrides);
}

// --- Pending Calls (cross-page queue: library editor → sheet) ---
const PENDING_KEY = 'csg_pendingCalls';

export function getPendingCalls() {
  const calls = load(PENDING_KEY, []);
  // Clear after reading
  localStorage.removeItem(PENDING_KEY);
  return calls;
}

export function addPendingCall(call) {
  const calls = load(PENDING_KEY, []);
  calls.push(call);
  save(PENDING_KEY, calls);
}
