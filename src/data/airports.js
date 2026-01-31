// Hardcoded defaults (shown before full DB loads)
export const DEFAULT_AIRPORTS = [
  { id: "KADH", name: "Ada Municipal", abridged: "Ada", city: "Ada", state: "OK", runways: ["17", "35"], towered: false },
  { id: "KOKC", name: "Will Rogers World", abridged: "Will Rogers", city: "Oklahoma City", state: "OK", runways: ["17L", "35R", "13", "31"], towered: true },
  { id: "KOUN", name: "Max Westheimer", abridged: "Max Westheimer", city: "Norman", state: "OK", runways: ["03", "21", "17", "35"], towered: true },
  { id: "KPWA", name: "Wiley Post", abridged: "Wiley Post", city: "Oklahoma City", state: "OK", runways: ["17L", "35R", "17R", "35L"], towered: true },
  { id: "KTUL", name: "Tulsa International", abridged: "Tulsa", city: "Tulsa", state: "OK", runways: ["18L", "36R", "18R", "36L"], towered: true },
];

let allAirports = null;
let loadingPromise = null;

export async function loadAirports() {
  if (allAirports) return allAirports;
  if (loadingPromise) return loadingPromise;
  loadingPromise = fetch('/data/airports.json')
    .then(r => r.json())
    .then(data => {
      allAirports = data;
      loadingPromise = null;
      return data;
    })
    .catch(err => {
      console.warn('Failed to load airport database, using defaults:', err);
      allAirports = DEFAULT_AIRPORTS;
      loadingPromise = null;
      return allAirports;
    });
  return loadingPromise;
}

export function searchAirports(term) {
  if (!term || term.length < 2) return [];
  const db = allAirports || DEFAULT_AIRPORTS;
  const lower = term.toLowerCase();

  // Exact ID match first
  const exactId = db.filter(a => a.id.toLowerCase() === lower);
  if (exactId.length) return exactId.slice(0, 10);

  // Also check with K prefix for US airports (e.g., "adh" → "KADH")
  const withK = 'k' + lower;
  const exactWithK = db.filter(a => a.id.toLowerCase() === withK);
  if (exactWithK.length) return exactWithK.slice(0, 10);

  // Prioritize: exact city match, then ID prefix, then city/name starts-with, then substring
  const exactCity = [];
  const idPrefix = [];
  const startsWithCity = [];
  const other = [];
  for (const a of db) {
    const cityLower = a.city.toLowerCase();
    const nameLower = a.name.toLowerCase();
    const abridgedLower = a.abridged.toLowerCase();
    if (cityLower === lower || abridgedLower === lower) {
      exactCity.push(a);
    } else if (a.id.toLowerCase().startsWith(lower) || a.id.toLowerCase().startsWith(withK)) {
      idPrefix.push(a);
    } else if (cityLower.startsWith(lower) || abridgedLower.startsWith(lower) || nameLower.startsWith(lower)) {
      startsWithCity.push(a);
    } else if (
      a.id.toLowerCase().includes(lower) ||
      nameLower.includes(lower) ||
      cityLower.includes(lower) ||
      abridgedLower.includes(lower)
    ) {
      other.push(a);
    }
    if (exactCity.length + idPrefix.length + startsWithCity.length + other.length >= 50) break;
  }
  return [...exactCity, ...idPrefix, ...startsWithCity, ...other].slice(0, 10);
}

export function isLoaded() {
  return allAirports !== null;
}
