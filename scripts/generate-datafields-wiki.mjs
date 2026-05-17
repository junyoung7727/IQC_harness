import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'docs', 'datafields-reference.md');
const outDir = path.join(repoRoot, 'docs', 'datafields-wiki');

const toObjectField = (value, key) => {
  if (typeof value !== 'string') {
    return '';
  }

  const regex = new RegExp(`['\"]${key}['\"]\\s*:\\s*['\"]([^'\"]*)['\"]`);
  const match = value.match(regex);
  return match ? match[1].trim() : '';
};

const parseDictLike = (value) => {
  if (typeof value !== 'string') {
    return { id: '', name: '' };
  }

  const text = value.trim();
  if (!text.startsWith('{')) {
    return { id: '', name: text };
  }

  return {
    id: toObjectField(text, 'id'),
    name: toObjectField(text, 'name'),
  };
};

const sanitizeFileName = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const parseRow = (line) => {
  const raw = line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell, idx, all) => {
      if (idx === 0 || idx === all.length - 1) {
        return cell.length > 0;
      }
      return true;
    });

  return raw[0] === '' ? raw.slice(1, -1) : raw;
};

const buildSlug = (name, fallback) => {
  const base = (name || fallback || 'unknown').trim().toLowerCase();
  return sanitizeFileName(base) || fallback || 'unknown';
};

const main = () => {
  const content = fs.readFileSync(sourcePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));

  if (!tableLines.length) {
    throw new Error('No markdown table rows found in source reference file.');
  }

  const [headerLine, _sep, ...dataLines] = tableLines;
  const headers = parseRow(headerLine);

  const rows = dataLines
    .map((line) => parseRow(line))
    .filter((row) => row.length >= headers.length && row[0])
    .map((row) => {
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = row[idx] ?? '';
      });
      return rowObj;
    });

  const required = headers.filter((h) =>
    [
      'id',
      'description',
      'dataset',
      'category',
      'subcategory',
      'dataset_name',
      'category_name',
      'subcategory_name',
      'region',
      'universe',
      'type',
      'dateCoverage',
      'coverage',
      'userCount',
      'alphaCount',
      'pyramidMultiplier',
    ].includes(h)
  );

  const missingCols = required.filter((col) => !(col in rows[0]));
  if (missingCols.length) {
    throw new Error(`Missing expected columns: ${missingCols.join(', ')}`);
  }

  const uniqueIds = new Set();
  const categoryMap = new Map();
  const categoryIndex = [];

  rows.forEach((row) => {
    const id = String(row.id || '').trim();
    if (!id) {
      return;
    }

    if (uniqueIds.has(id)) {
      return;
    }
    uniqueIds.add(id);

    const categoryParsed = parseDictLike(String(row.category));
    const subcategoryParsed = parseDictLike(String(row.subcategory));

    const categoryName = categoryParsed.name || String(row.category_name || 'Uncategorized').trim();
    const categorySlug = buildSlug(categoryParsed.id || categoryName, categoryName);

    const subcategoryName = subcategoryParsed.name || String(row.subcategory_name || 'Uncategorized').trim();
    const subcategorySlug = buildSlug(subcategoryParsed.id || subcategoryName, subcategoryName);

    const datasetName =
      String(row.dataset_name || '').trim() ||
      parseDictLike(String(row.dataset)).name ||
      '(unknown)';

    const datasetSlug = buildSlug(String(row.dataset_id || ''), datasetName);

    const entry = {
      id,
      description: String(row.description || '').trim(),
      region: String(row.region || '').trim(),
      delay: String(row.delay || '').trim(),
      universe: String(row.universe || '').trim(),
      type: String(row.type || '').trim(),
      dateCoverage: String(row.dateCoverage || '').trim(),
      coverage: String(row.coverage || '').trim(),
      userCount: String(row.userCount || '').trim(),
      alphaCount: String(row.alphaCount || '').trim(),
      pyramidMultiplier: String(row.pyramidMultiplier || '').trim(),
      themes: String(row.themes || '').trim(),
      datasetId: String(row.dataset_id || '').trim(),
      datasetName,
      datasetSlug,
      categoryName,
      categorySlug,
      subcategoryName,
      subcategorySlug,
    };

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        name: categoryName,
        slug: categorySlug,
        count: 0,
        subcategoryMap: new Map(),
        items: [],
      });
      categoryIndex.push(categoryName);
    }

    const cat = categoryMap.get(categoryName);
    cat.count += 1;
    cat.items.push(entry);

    if (!cat.subcategoryMap.has(subcategoryName)) {
      cat.subcategoryMap.set(subcategoryName, {
        name: subcategoryName,
        slug: subcategorySlug,
        items: [],
      });
    }
    cat.subcategoryMap.get(subcategoryName).items.push(entry);
  });

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const dataFieldsDir = path.join(outDir, 'datafields');
  const categoriesDir = path.join(outDir, 'categories');
  fs.mkdirSync(dataFieldsDir, { recursive: true });
  fs.mkdirSync(categoriesDir, { recursive: true });

  for (const row of rows) {
    const id = String(row.id || '').trim();
    if (!id) {
      continue;
    }

    const categoryParsed = parseDictLike(String(row.category));
    const subcategoryParsed = parseDictLike(String(row.subcategory));

    const categoryName = categoryParsed.name || String(row.category_name || 'Uncategorized').trim();
    const categorySlug = buildSlug(categoryParsed.id || categoryName, categoryName);

    const subcategoryName = subcategoryParsed.name || String(row.subcategory_name || 'Uncategorized').trim();
    const datasetName =
      String(row.dataset_name || '').trim() ||
      parseDictLike(String(row.dataset)).name ||
      '(unknown)';
    const datasetId = String(row.dataset_id || '').trim();

    const contentText = [
      `# Datafield: ${id}`,
      '',
      `- Category: [${categoryName}](../categories/${categorySlug}.md)`,
      `- Subcategory: ${subcategoryName}`,
      `- Dataset: ${datasetName} (${datasetId || 'n/a'})`,
      `- Region: ${String(row.region || '').trim() || 'n/a'}`,
      `- Delay: ${String(row.delay || '').trim() || 'n/a'}`,
      `- Universe: ${String(row.universe || '').trim() || 'n/a'}`,
      `- Type: ${String(row.type || '').trim() || 'n/a'}`,
      `- Date coverage: ${String(row.dateCoverage || '').trim() || 'n/a'}`,
      `- Coverage: ${String(row.coverage || '').trim() || 'n/a'}`,
      `- User count: ${String(row.userCount || '').trim() || 'n/a'}`,
      `- Alpha count: ${String(row.alphaCount || '').trim() || 'n/a'}`,
      `- Pyramid multiplier: ${String(row.pyramidMultiplier || '').trim() || 'n/a'}`,
      `- Themes: ${String(row.themes || '').trim() || '[]'}`,
      '',
      '## Description',
      '',
      `${String(row.description || '').trim() || 'No description provided.'}`,
      '',
    ].join('\n');

    const file = path.join(dataFieldsDir, `${sanitizeFileName(id)}.md`);
    fs.writeFileSync(file, contentText);
  }

  const categoryRows = [];

  for (const categoryName of [...categoryIndex].sort((a, b) => a.localeCompare(b))) {
    const cat = categoryMap.get(categoryName);

    const categoryFile = path.join(categoriesDir, `${cat.slug}.md`);
    const categorySubDir = path.join(categoriesDir, cat.slug);
    fs.mkdirSync(categorySubDir, { recursive: true });

    const subcategoryEntries = [...cat.subcategoryMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const subcategoryIndexLines = ['## Subcategories'];
    const parentLines = [
      `# Datafield Category: ${categoryName}`,
      '',
      `- Total fields: ${cat.items.length}`,
      `- Subcategories: ${subcategoryEntries.length}`,
      '',
    ];

    for (const [subName, info] of subcategoryEntries) {
      const sortedSubItems = info.items.slice().sort((a, b) => a.id.localeCompare(b.id));
      const subSlug = info.slug;
      const subFileName = `${subSlug}.md`;
      const subPath = path.join(categorySubDir, subFileName);
      const subTitle = `# Datafield Category: ${categoryName} / ${subName}`;

      const subLines = [
        subTitle,
        '',
        `- Parent category: [${categoryName}](../${cat.slug}.md)`,
        `- Total fields: ${sortedSubItems.length}`,
        '',
        `## Fields`,
        '',
        ...sortedSubItems.map(
          (item) => `- [${item.id}](../../datafields/${sanitizeFileName(item.id)}.md) ${
            item.description ? `- ${item.description}` : ''
          }`
        ),
        '',
      ];

      fs.writeFileSync(subPath, subLines.join('\n'));

      subcategoryIndexLines.push(`- ${subName} (${sortedSubItems.length}): [${subFileName}](./${cat.slug}/${subFileName})`);
    }

    const categoryBody = [
      ...parentLines,
      ...subcategoryIndexLines,
      '',
      '## Field List',
      '',
      '이 카테고리는 서브카테고리로 분할되어 있습니다.',
      '',
    ].join('\n');

    fs.writeFileSync(categoryFile, categoryBody);
    categoryRows.push(`- ${categoryName} (${cat.items.length}): [categories/${cat.slug}.md](categories/${cat.slug}.md)`);
  }

  fs.writeFileSync(
    path.join(outDir, 'category-index.md'),
    ['# Datafield Category Index', '', ...categoryRows.sort((a, b) => a.localeCompare(b))].join('\n') + '\n'
  );

  const alphaBuckets = new Map();
  const alphaEntries = rows
    .filter((row) => String(row.id || '').trim())
    .map((row) => ({
      id: String(row.id).trim(),
      description: String(row.description || '').trim(),
    }))
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  alphaEntries.forEach(({ id }) => {
    const first = id[0].toUpperCase();
    const key = /[A-Z]/i.test(first) ? first : '#';
    if (!alphaBuckets.has(key)) {
      alphaBuckets.set(key, []);
    }
    alphaBuckets.get(key).push(id);
  });

  const alphaSections = [...alphaBuckets.keys()]
    .sort()
    .map((key) => {
      const items = alphaBuckets.get(key);
      const lines = [`## ${key}`, ''];
      items.forEach((id) => {
        lines.push(`- [${id}](datafields/${sanitizeFileName(id)}.md)`);
      });
      lines.push('');
      return lines.join('\n');
    })
    .join('\n');

  fs.writeFileSync(
    path.join(outDir, 'alphabetical-index.md'),
    ['# Datafield Alphabetical Index', '', alphaSections, ''].join('\n')
  );

  const validIds = new Set(
    rows.map((row) => String(row.id || '').trim()).filter((id) => id)
  );

  const readme = [
    '# Datafield Wiki',
    '',
    '- [Category Index](category-index.md)',
    '- [Alphabetical Index](alphabetical-index.md)',
    '- Source: `datafields-reference.md`',
    '',
    '## 전체 데이터필드',
    '',
    `총 ${validIds.size}개 항목`,
    `총 카테고리 ${categoryIndex.length}개`,
    '',
    '## 인덱스 빠르게 찾기',
    '- 전체 항목은 [Alphabetical Index](alphabetical-index.md)에서 알파벳별로 탐색하세요.',
    `- 데이터 필드는 [Category Index](category-index.md)에서 ${categoryIndex.length}개 카테고리로 분류되어 있습니다.`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'README.md'), readme + '\n');

  const summary = [
    `Generated: ${validIds.size} datafields`,
    `Source: ${sourcePath}`,
    `Root: ${outDir}`,
    `Categories: ${categoryIndex.length}`,
  ].join('\n');

  fs.writeFileSync(path.join(outDir, '_generation-summary.txt'), summary);

  const uniqueIdsCount = uniqueIds.size;
  const expectedRows = rows.filter((row) => String(row.id || '').trim()).length;

  if (uniqueIdsCount !== expectedRows) {
    throw new Error(`Expected ${expectedRows} rows but got ${uniqueIdsCount} unique ids`);
  }

  const categoryDirCount = fs.readdirSync(categoriesDir).filter((f) => f.endsWith('.md')).length;
  const dataFieldCount = fs.readdirSync(dataFieldsDir).filter((f) => f.endsWith('.md')).length;

  console.log('Generated datafield wiki.');
  console.log('datafields:', uniqueIdsCount);
  console.log('datafield pages:', dataFieldCount);
  console.log('category pages:', categoryDirCount);
};

main();
