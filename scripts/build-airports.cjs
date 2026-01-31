#!/usr/bin/env node
/**
 * Downloads OurAirports CSV data and builds a compact JSON for the app.
 * Filters to US airports (small, medium, large) with runways.
 * Uses airport-frequencies.csv to determine towered status (has TWR frequency).
 * Output: public/data/airports.json
 *
 * Run: node scripts/build-airports.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
const FREQUENCIES_URL = 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CommSheetGenerator/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  console.log('Downloading airports.csv...');
  const airportsCSV = await fetch(AIRPORTS_URL);
  console.log('Downloading runways.csv...');
  const runwaysCSV = await fetch(RUNWAYS_URL);
  console.log('Downloading airport-frequencies.csv...');
  const frequenciesCSV = await fetch(FREQUENCIES_URL);

  console.log('Parsing...');
  const airports = parseCSV(airportsCSV);
  const runways = parseCSV(runwaysCSV);
  const frequencies = parseCSV(frequenciesCSV);

  // Filter US airports (small, medium, large only)
  const usTypes = new Set(['small_airport', 'medium_airport', 'large_airport']);
  const usAirports = airports.filter(a =>
    a.iso_country === 'US' &&
    usTypes.has(a.type) &&
    a.ident
  );

  console.log(`Found ${usAirports.length} US airports`);

  // Build runway map: airport_ident -> [runway identifiers]
  const runwayMap = {};
  runways.forEach(r => {
    if (r.closed === '1') return;
    const ident = r.airport_ident;
    if (!ident) return;
    if (!runwayMap[ident]) runwayMap[ident] = [];
    if (r.le_ident) runwayMap[ident].push(r.le_ident);
    if (r.he_ident) runwayMap[ident].push(r.he_ident);
  });

  // Build towered set: airports that have a TWR (tower) frequency
  const toweredSet = new Set();
  frequencies.forEach(f => {
    const type = (f.type || '').toUpperCase();
    if (type === 'TWR' || type === 'TOWER' || type.includes('TWR')) {
      const ident = f.airport_ident;
      if (ident) toweredSet.add(ident);
    }
  });

  console.log(`Found ${toweredSet.size} airports with tower frequencies`);

  // Build compact JSON
  const result = usAirports.map(a => {
    const rwy = runwayMap[a.ident] || [];
    // Build abridged name: remove common suffixes
    let abridged = a.name
      .replace(/\s*(Regional|Municipal|International|Intl|Airport|Airfield|Airpark|Field|Memorial)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!abridged) abridged = a.name;

    return {
      id: a.ident,
      name: a.name,
      abridged,
      city: a.municipality || '',
      state: (a.iso_region || '').replace('US-', ''),
      runways: rwy,
      towered: toweredSet.has(a.ident),
      type: a.type,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const outPath = path.join(__dirname, '..', 'public', 'data', 'airports.json');
  fs.writeFileSync(outPath, JSON.stringify(result));
  const sizeMB = (Buffer.byteLength(JSON.stringify(result)) / 1024 / 1024).toFixed(2);
  const toweredCount = result.filter(a => a.towered).length;
  console.log(`Written ${result.length} airports to ${outPath} (${sizeMB} MB)`);
  console.log(`${toweredCount} airports marked as towered`);
}

main().catch(err => { console.error(err); process.exit(1); });
