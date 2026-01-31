const fs = require('fs');
const path = require('path');
const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'radio_calls_master_v4.json'), 'utf8'));
console.log('Total calls:', d.calls.length);

// Check for custom/user calls in master
const custom = d.calls.filter(c =>
  c.call_id.startsWith('USER_') ||
  c.call_id.startsWith('CUSTOM_') ||
  c.call_id.startsWith('TAXI_')
);
if (custom.length) {
  console.log('Custom calls found in master JSON:');
  custom.forEach(c => console.log(' ', c.call_id, '|', (c.text || '').substring(0, 80)));
} else {
  console.log('No custom calls in master JSON');
}

// Check for duplicate IDs
const ids = d.calls.map(c => c.call_id);
const seen = {};
ids.forEach(id => { seen[id] = (seen[id] || 0) + 1; });
const dupes = Object.entries(seen).filter(([, v]) => v > 1);
if (dupes.length) console.log('Duplicate IDs:', dupes);

// List all briefs with full text
console.log('\n--- All briefs ---');
d.calls.filter(c => c.comm_type === 'brief').forEach(c => {
  console.log(`\n[${c.call_id}] block=${c.block} applies=${(c.applies_to||[]).join(',')}`);
  console.log(c.text);
});
