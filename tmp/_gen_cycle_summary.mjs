import fs from 'node:fs';

const logPath = 'C:/Users/user/worldquant-multi-agent-harness/tmp/ultrawork-loop-run.log.utf8.txt';
const outPath = 'C:/Users/user/worldquant-multi-agent-harness/tmp/ultrawork-cycle-summary-87-100.md';

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

  const mAccepted = line.match(/^\s*accepted_count:\s*(\d+)\s*$/);
  if (mAccepted) {
    current.accepted_count = Number(mAccepted[1]);
    continue;
  }

  const mRejected = line.match(/^\s*rejected_count:\s*(\d+)\s*$/);
  if (mRejected) {
    current.rejected_count = Number(mRejected[1]);
    continue;
  }

  const mAcceptedIds = line.match(/^\s*accepted_alpha_ids:\s*(.*)$/);
  if (mAcceptedIds) {
    const rest = (mAcceptedIds[1] || '').trim();
    current.accepted_alpha_ids = rest
      ? rest.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    continue;
  }

  const mRejectedCases = line.match(/^\s*rejected_similarity_cases:\s*(.*)$/);
  if (mRejectedCases) {
    const rest = (mRejectedCases[1] || '').trim();
    current.rejected_similarity_cases = rest
      ? rest.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }
}

if (current) cycles.push(current);

const totalAccepted = cycles.reduce((acc, c) => acc + (c.accepted_count || 0), 0);
const totalRejected = cycles.reduce((acc, c) => acc + (c.rejected_count || 0), 0);

const rows = cycles
  .map((c) => {
    const rejectedText = c.rejected_similarity_cases.includes('none') || c.rejected_similarity_cases.length === 0
      ? '-'
      : c.rejected_similarity_cases.join('; ');
    const acceptedIdsText = c.accepted_alpha_ids.length ? c.accepted_alpha_ids.join(', ') : '-';
    return `| ${c.cycle} | ${c.accepted_count} | ${c.rejected_count} | ${acceptedIdsText} | ${rejectedText} |`;
  })
  .join('\n');

const markdown = `# Ultrawork loop 87-100 summary

Coverage: only cycles present in \\"ultrawork-loop-run.log.utf8.txt\\" (cycles 87 through 100).

| cycle | accepted_count | rejected_count | accepted_alpha_ids | rejected_similarity_cases |
|---|---:|---:|---|---|
${rows}

- Total cycles: ${cycles.length}
- Total accepted: ${totalAccepted}
- Total rejected: ${totalRejected}
- Status note: local DB shows all reported accepted IDs as \"pending\" currently, which is expected for initial storage state in this harness.\n`;

fs.writeFileSync(outPath, markdown, 'utf8');
console.log(outPath);
