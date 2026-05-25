import { readFileSync, existsSync } from 'node:fs';

const OPERATORS_CSV_PATH = 'C:\\Users\\user\\Desktop\\alpha\\IQC_brain_operators.csv';
const DATAFIELDS_CSV_PATH = 'C:\\Users\\user\\Desktop\\alpha\\IQC_brain_datafields.csv';

const RESERVED_WORDS = new Set([
  'and',
  'or',
  'not',
  'if_else',
  'less',
  'equal',
  'greater',
  'not_equal',
  'less_equal',
  'greater_equal',
  'true',
  'false',
  'nan',
  'null',
  'undefined',
  'abs',
  'add',
  'max',
  'min',
  'and_',
  'or_'
]);

let operatorsCache = null;
let datafieldsCache = null;

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      if (inQuotes) {
        escaped = true;
      }
      current += char;
      continue;
    }

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCSV(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '').trim();
  if (!raw) {
    return [];
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().replace(/^\uFEFF/, ''));

  return lines.slice(1)
    .map((line) => {
      if (!line.trim()) return null;
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        const value = values[index] ?? '';
        const normalized = typeof value === 'string' ? value.trim() : String(value);
        row[header] = normalized;
      });
      return row;
    })
    .filter(Boolean);
}

function getOperators() {
  if (!operatorsCache) {
    operatorsCache = parseCSV(OPERATORS_CSV_PATH);
  }
  return operatorsCache;
}

function getDatafields() {
  if (!datafieldsCache) {
    datafieldsCache = parseCSV(DATAFIELDS_CSV_PATH);
  }
  return datafieldsCache;
}

function isIdentifierStart(char) {
  return /[a-zA-Z_]/.test(char);
}

function isIdentifierChar(char) {
  return /[a-zA-Z0-9_]/.test(char);
}

function skipStringLiteral(expr, index) {
  const quote = expr[index];
  let i = index + 1;
  let escaped = false;
  while (i < expr.length) {
    const char = expr[i];
    if (!escaped && char === '\\') {
      escaped = true;
      i += 1;
      continue;
    }

    if (!escaped && char === quote) {
      return i;
    }

    escaped = false;
    i += 1;
  }
  return expr.length - 1;
}

function splitCommaList(text) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (inQuotes) {
      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }
      if (char === quoteChar) {
        inQuotes = false;
      }
      current += char;
      continue;
    }

    if (char === '\'' || char === '"') {
      inQuotes = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      if (depth > 0) depth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current !== '') {
    parts.push(current.trim());
  }

  return parts;
}

function parseFunctionCall(expr, openIndex) {
  const args = [];
  const errors = [];
  let i = openIndex + 1;
  let depth = 1;
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let escaped = false;

  const pushCurrent = () => {
    args.push(current.trim());
    current = '';
  };

  for (; i < expr.length; i += 1) {
    const char = expr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (inQuotes) {
      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }
      if (char === quoteChar) {
        inQuotes = false;
      }
      current += char;
      continue;
    }

    if (char === '\'' || char === '"') {
      inQuotes = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        args.push(current.trim());
        return { args, endIndex: i, errors };
      }
      current += char;
      continue;
    }

    if (char === ',' && depth === 1) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  errors.push('Unmatched opening parenthesis "("');
  return { args, endIndex: expr.length - 1, errors };
}

function extractFunctionTokens(expr, errors) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (char === '\'' || char === '"') {
      i = skipStringLiteral(expr, i);
      i += 1;
      continue;
    }

    if (!isIdentifierStart(char)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < expr.length && isIdentifierChar(expr[j])) {
      j += 1;
    }

    const tokenName = expr.slice(i, j);
    let k = j;
    while (k < expr.length && /\s/.test(expr[k])) {
      k += 1;
    }

    if (expr[k] === '(') {
      const { args, endIndex, errors: parseErrors } = parseFunctionCall(expr, k);
      parseErrors.forEach((error) => errors.push(`Function '${tokenName}' ${error}`));
      tokens.push({ type: 'function', name: tokenName, args });
      i = endIndex + 1;
      continue;
    }

    if (!RESERVED_WORDS.has(tokenName.toLowerCase())) {
      tokens.push({ type: 'field', name: tokenName });
    }

    i = j;
  }

  return tokens;
}

function checkParentheses(expr, errors) {
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < expr.length; i += 1) {
    const char = expr[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inQuotes) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quoteChar) {
        inQuotes = false;
      }
      continue;
    }

    if (char === '\'' || char === '"') {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth < 0) {
        errors.push('Unmatched closing parenthesis ")"');
        return;
      }
    }
  }

  if (depth > 0) {
    errors.push(`Missing ${depth} closing parenthesis(s) ")"`);
  }
}

function tokenizeExpression(expr) {
  const tokens = [];
  const errors = [];

  if (typeof expr !== 'string') {
    errors.push('Expression must be a string');
    return { tokens, errors };
  }

  checkParentheses(expr, errors);

  if (expr.trim()) {
    tokens.push(...extractFunctionTokens(expr, errors));
  }

  return { tokens, errors };
}

function collectNestedTokens(tokens, errors) {
  const collected = [];
  const queue = [...tokens];

  while (queue.length > 0) {
    const token = queue.shift();
    collected.push(token);

    if (token.type !== 'function') {
      continue;
    }

    for (const arg of token.args) {
      const trimmedArg = arg.trim();
      if (!trimmedArg) {
        continue;
      }

      const nested = tokenizeExpression(trimmedArg);
      nested.errors.forEach((error) => {
        errors.push(`In function '${token.name}': ${error}`);
      });
      queue.push(...nested.tokens);
    }
  }

  return collected;
}

function parseOperatorSignature(definition) {
  const match = /^(?:\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)?\((.*)\)/.exec(definition);
  if (!match) return null;

  const paramsText = match[1].trim();
  const params = splitCommaList(paramsText).filter((p) => p.trim().length > 0);

  let hasVariadic = false;
  let required = 0;
  let optional = 0;

  params.forEach((param) => {
    const normalized = param.replace(/\s+/g, ' ').trim();
    if (normalized.includes('...') || normalized.includes('..')) {
      hasVariadic = true;
      return;
    }
    if (normalized.includes('=')) {
      optional += 1;
      return;
    }
    required += 1;
  });

  return {
    signature: `${match[0]}`,
    min: required,
    max: hasVariadic ? Infinity : required + optional,
    hasVariadic
  };
}

function validateOperatorArity(funcName, argValues, operatorDef) {
  const definition = (operatorDef.definition ?? '').trim();
  const parsed = parseOperatorSignature(definition);
  const argCount = argValues.length;

  if (!parsed) {
    return { valid: true };
  }

  if (argCount < parsed.min) {
    return {
      valid: false,
      message: `Operator '${funcName}' requires at least ${parsed.min} argument(s), but got ${argCount}. Signature: ${parsed.signature}`
    };
  }

  if (!parsed.hasVariadic && parsed.max !== Infinity && argCount > parsed.max) {
    return {
      valid: false,
      message: `Operator '${funcName}' accepts at most ${parsed.max} argument(s), but got ${argCount}. Signature: ${parsed.signature}`
    };
  }

  const emptyArgPositions = argValues
    .map((arg, idx) => (arg.trim().length > 0 ? null : idx + 1))
    .filter(Boolean);

  if (emptyArgPositions.length > 0) {
    return {
      valid: false,
      message: `Operator '${funcName}' has empty argument(s) at position(s) ${emptyArgPositions.join(', ')}`
    };
  }

  return { valid: true };
}

export function validateAlphaExpression(expr) {
  const errors = [];
  const warnings = [];

  if (typeof expr !== 'string' || expr.trim().length === 0) {
    return {
      valid: false,
      errors: ['Expression is empty'],
      warnings: []
    };
  }

  const operators = getOperators();
  const datafields = getDatafields();

  if (operators.length === 0) {
    warnings.push(`Operators CSV not found at ${OPERATORS_CSV_PATH} - skipping operator validation`);
  }

  if (datafields.length === 0) {
    warnings.push(`Datafields CSV not found at ${DATAFIELDS_CSV_PATH} - skipping datafield validation`);
  }

  const operatorMap = new Map();
  operators.forEach((operator) => {
    if (operator.name) {
      operatorMap.set(String(operator.name).trim().toLowerCase(), operator);
    }
  });

  const datafieldNames = new Set();
  datafields.forEach((field) => {
    if (field.id) datafieldNames.add(field.id);
    if (field.name) datafieldNames.add(field.name);
    if (field.field) datafieldNames.add(field.field);
    if (field.identifier) datafieldNames.add(field.identifier);
  });

  const { tokens, errors: tokenizeErrors } = tokenizeExpression(expr);
  errors.push(...tokenizeErrors);

  const allTokens = collectNestedTokens(tokens, errors);
  for (const token of allTokens) {
    if (token.type === 'function') {
      const operator = operatorMap.get(token.name.toLowerCase());
      if (!operator) {
        errors.push(`Unknown operator: '${token.name}' (not found in IQC_brain_operators.csv)`);
        continue;
      }

      const arityResult = validateOperatorArity(token.name, token.args, operator);
      if (!arityResult.valid) {
        errors.push(arityResult.message);
      }
      continue;
    }

    if (!datafieldNames.has(token.name) && !datafieldNames.has(token.name.toLowerCase())) {
      errors.push(`Unknown datafield: '${token.name}' (not found in IQC_brain_datafields.csv)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
