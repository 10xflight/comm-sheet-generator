const APPLIES_MAP = {
  vfr_nontowered: 'vfr_nt',
  vfr_towered: 'vfr_t',
  ifr_nontowered: 'ifr_nt',
  ifr_towered: 'ifr_t',
};

const TYPE_MAP = {
  atc_response: 'atc',
  ics: 'note',
  radio: 'radio',
  note: 'note',
  brief: 'brief',
};

const VAR_MAP = {
  'Call_Sign_Full': 'CS_Full',
  'Call_Sign_Abbr': 'CS_Abbr',
  'Stop1_Airport_Name': 'Dep_Name',
  'Stop1_Airport_Abridged': 'Dep_Abridged',
  'Stop1_Airport_Traffic': 'Dep_Traffic',
  'Stop2_Airport_Name': 'Arr_Name',
  'Stop2_Airport_Abridged': 'Arr_Abridged',
  'Stop2_Airport_Traffic': 'Arr_Traffic',
};

function cleanText(text) {
  if (!text) return text;
  // Remap auto-populated variables to app internal names
  let result = text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return VAR_MAP[varName] ? `{{${VAR_MAP[varName]}}}` : match;
  });
  return result;
}

function normalizeCall(raw) {
  return {
    id: raw.call_id,
    block: raw.block,
    group: raw.group || null,
    seq: raw.sequence,
    type: TYPE_MAP[raw.comm_type] || raw.comm_type,
    text: cleanText(raw.text),
    applies: (raw.applies_to || []).map(a => APPLIES_MAP[a] || a),
    expand_per_runway: raw.expand_per_runway || false,
  };
}

let cachedCalls = null;

export async function loadRadioCalls() {
  if (cachedCalls) return cachedCalls;
  const resp = await fetch('/data/radio_calls_master_v4.json');
  const data = await resp.json();
  cachedCalls = data.calls.map(normalizeCall);
  return cachedCalls;
}

export function getRadioCalls() {
  return cachedCalls || [];
}
