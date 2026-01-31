export const PHONETIC = {
  a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliet', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
  x: 'X-ray', y: 'Yankee', z: 'Zulu'
};

const PHONETIC_WORDS = Object.fromEntries(
  Object.entries(PHONETIC).map(([k, v]) => [v.toLowerCase(), v])
);

export function parseTaxiRoute(input, callSignAbbr = '') {
  if (!input?.trim()) return '';
  const tokens = input.toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
  const result = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (token === 'back' && next === 'taxi') {
      result.push('back taxi');
      i += 2;
      continue;
    }

    if (token === 'hold' && next === 'short') {
      i += 2;
      if (tokens[i]) {
        const target = tokens[i];
        if (/^\d{1,2}[lrcLRC]?$/.test(target)) {
          result.push(`hold short runway ${target.toUpperCase()}`);
        } else if (PHONETIC[target] || PHONETIC_WORDS[target]) {
          result.push(`hold short taxiway ${PHONETIC[target] || PHONETIC_WORDS[target]}`);
        } else {
          result.push(`hold short ${target}`);
        }
        i++;
      }
      continue;
    }

    if (token === 'cross' || token === 'crossing') {
      i++;
      if (tokens[i] && /^\d{1,2}[lrcLRC]?$/.test(tokens[i])) {
        result.push(`cross runway ${tokens[i].toUpperCase()}`);
        i++;
      }
      continue;
    }

    if (token.length === 1 && PHONETIC[token]) {
      result.push(PHONETIC[token]);
      i++;
      continue;
    }

    if (PHONETIC_WORDS[token]) {
      result.push(PHONETIC_WORDS[token]);
      i++;
      continue;
    }

    if (/^\d{1,2}[lrcLRC]?$/.test(token)) {
      result.push(token.toUpperCase());
      i++;
      continue;
    }

    if (['via', 'to', 'then', 'and'].includes(token)) {
      i++;
      continue;
    }

    result.push(token);
    i++;
  }

  if (result.length === 0) return '';
  const formatted = result.join(', ');
  return callSignAbbr ? `${formatted}, ${callSignAbbr}` : formatted;
}
