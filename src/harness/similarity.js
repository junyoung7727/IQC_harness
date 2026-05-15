const RESERVED = new Set([
  'if', 'else', 'true', 'false', 'null', 'undefined', 'and', 'or', 'not'
]);

const OPERATOR_REGEX = /(==|!=|<=|>=|&&|\|\||[+\-*/%^<>=?:])/g;
const IDENTIFIER_REGEX = /[A-Za-z_][A-Za-z0-9_]*/g;
const NUMBER_REGEX = /\b\d+(?:\.\d+)?\b/g;

export function countTokens(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function extractAssignedVariables(expression) {
  const assigned = new Set();
  for (const line of expression.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) assigned.add(match[1]);
  }
  return assigned;
}

function collectMatches(regex, expression, mapper) {
  const results = [];
  for (const match of expression.matchAll(regex)) {
    results.push({
      start: match.index,
      end: match.index + match[0].length,
      ...mapper(match)
    });
  }
  return results;
}

function makeStructureBigrams(tokens) {
  if (tokens.length < 2) return [];
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]}>${tokens[i + 1]}`);
  }
  return bigrams;
}

export function parseExpression(expression) {
  const assignedVariables = extractAssignedVariables(expression);

  const operatorMatches = collectMatches(OPERATOR_REGEX, expression, (match) => ({
    category: 'operator',
    token: match[0],
    structureToken: `OP:${match[0]}`
  }));

  const numberMatches = collectMatches(NUMBER_REGEX, expression, () => ({
    category: 'number',
    token: 'NUMBER',
    structureToken: 'NUMBER'
  }));

  const identifierMatches = collectMatches(IDENTIFIER_REGEX, expression, (match) => {
    const token = match[0];
    const after = expression.slice(match.index + token.length);
    const isFunction = /^\s*\(/.test(after);
    if (RESERVED.has(token)) {
      return { category: 'reserved', token, structureToken: `KW:${token}` };
    }
    if (isFunction) {
      return { category: 'function', token, structureToken: `FUNC:${token}` };
    }
    if (assignedVariables.has(token)) {
      return { category: 'variable', token, structureToken: 'VAR' };
    }
    return { category: 'datafield', token, structureToken: `FIELD:${token}` };
  });

  const allTokens = [...operatorMatches, ...numberMatches, ...identifierMatches]
    .filter((entry) => entry.category !== 'reserved')
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const structureBigrams = makeStructureBigrams(allTokens.map((entry) => entry.structureToken));

  return {
    functionCounts: countTokens(identifierMatches.filter((entry) => entry.category === 'function').map((entry) => entry.token)),
    datafieldCounts: countTokens(identifierMatches.filter((entry) => entry.category === 'datafield').map((entry) => entry.token)),
    operatorCounts: countTokens(operatorMatches.map((entry) => entry.token)),
    structureCounts: countTokens(structureBigrams)
  };
}

export function weightedJaccard(left, right) {
  const keys = new Set([...left.keys(), ...right.keys()]);
  let minSum = 0;
  let maxSum = 0;
  for (const key of keys) {
    const a = left.get(key) ?? 0;
    const b = right.get(key) ?? 0;
    minSum += Math.min(a, b);
    maxSum += Math.max(a, b);
  }
  return maxSum === 0 ? 0 : minSum / maxSum;
}

function hasAnyTokens(left, right) {
  return left.size > 0 || right.size > 0;
}

export function computeSimilarity(leftSignature, rightSignature) {
  const dimensions = [
    weightedJaccard(leftSignature.operatorCounts, rightSignature.operatorCounts),
    weightedJaccard(leftSignature.datafieldCounts, rightSignature.datafieldCounts),
    weightedJaccard(leftSignature.functionCounts, rightSignature.functionCounts),
    weightedJaccard(leftSignature.structureCounts, rightSignature.structureCounts)
  ];

  const active = [
    hasAnyTokens(leftSignature.operatorCounts, rightSignature.operatorCounts),
    hasAnyTokens(leftSignature.datafieldCounts, rightSignature.datafieldCounts),
    hasAnyTokens(leftSignature.functionCounts, rightSignature.functionCounts),
    hasAnyTokens(leftSignature.structureCounts, rightSignature.structureCounts)
  ];

  const usedScores = dimensions.filter((_, index) => active[index]);
  if (usedScores.length === 0) return 0;
  return usedScores.reduce((sum, score) => sum + score, 0) / usedScores.length;
}

export function serializeCounts(countMap) {
  return JSON.stringify(Object.fromEntries([...countMap.entries()].sort(([a], [b]) => a.localeCompare(b))));
}

export function deserializeCounts(serialized) {
  if (!serialized) return new Map();
  return new Map(Object.entries(JSON.parse(serialized)));
}
