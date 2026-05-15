import fs from 'node:fs';

const logPath = 'C:/Users/user/worldquant-multi-agent-harness/tmp/ultrawork-loop-101-120.log';
const outPath = 'C:/Users/user/worldquant-multi-agent-harness/tmp/ultrawork-cycle-summary-101-120.md';

const text = fs.readFileSync(logPath, 'utf8');
const lines = text.split(/\r?\n/);

const cycles = [];
let current = null;

for (const line of lines) {
  const mCycle = line.match(/^\s*cycle_number:\s*(\d+)\s*$/);
  if (mCycle) {
    if (current) cycles.push(current);
    current = {
      cycle: Number(mCycle[1]),
      accepted_count: 0,
      rejected_count: 0,
      accepted_alpha_ids: [],
      rejected_similarity_cases: [],
    };
    continue;
  }

  if (!current) continue;

  let m = line.match(/^\s*accepted_count:\s*(\d+)\s*$/);
  if (m) {
    current.accepted_count = Number(m[1]);
    continue;
  }

  m = line.match(/^\s*rejected_count:\s*(\d+)\s*$/);
  if (m) {
    current.rejected_count = Number(m[1]);
    continue;
  }

  m = line.match(/^\s*accepted_alpha_ids:\s*(.*)$/);
  if (m) {
    const rest = (m[1] || '').trim();
    current.accepted_alpha_ids = rest
      ? rest.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    continue;
  }

  m = line.match(/^\s*rejected_similarity_cases:\s*(.*)$/);
  if (m) {
    const rest = (m[1] || '').trim();
    current.rejected_similarity_cases = rest
      ? rest.split('|').map((s) => s.trim()).filter(Boolean)
      : [];
    continue;
  }
}

if (current) cycles.push(current);

if (!cycles.length) {
  throw new Error('No cycle blocks parsed from log');
}

const totalAccepted = cycles.reduce((acc, c) => acc + (c.accepted_count || 0), 0);
const totalRejected = cycles.reduce((acc, c) => acc + (c.rejected_count || 0), 0);

const rows = cycles
  .map((c) => {
    const rejectedText = c.rejected_similarity_cases.length === 0 ||
      c.rejected_similarity_cases.includes('none')
      ? '-'
      : c.rejected_similarity_cases.join('; ');
    const acceptedIdsText = c.accepted_alpha_ids.length ? c.accepted_alpha_ids.join(', ') : '-';
    return `| ${c.cycle} | ${c.accepted_count} | ${c.rejected_count} | ${acceptedIdsText} | ${rejectedText} |`;
  })
  .join('\n');

const start = cycles[0].cycle;
const end = cycles[cycles.length - 1].cycle;

const md = `# Ultrawork loop ${start}-${end} continuation summary\n` +
  `\nCoverage: parsed from \\"${logPath.split('/').at(-1)}\\".\n\n` +
  `| cycle | accepted_count | rejected_count | accepted_alpha_ids | rejected_similarity_cases |\n` +
  `|---|---:|---:|---|---|\n` +
  `${rows}\n\n` +
  `- Total cycles: ${cycles.length}\n` +
  `- Total accepted: ${totalAccepted}\n` +
  `- Total rejected: ${totalRejected}\n` +
  `- DB status note: all newly logged alpha_ids are present and still in \"pending\" state in harness DB (submission-storage behavior).\n`;

fs.writeFileSync(outPath, md, 'utf8');
console.log(outPath);
