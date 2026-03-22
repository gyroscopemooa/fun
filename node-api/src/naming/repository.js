import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.js';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const dataDir = path.resolve(thisDir, '..', '..', '..', 'src', 'data', 'name-premium');

let cache = null;

const loadCsv = async (name) => {
  const content = await fs.readFile(path.join(dataDir, name), 'utf8');
  return parseCsv(content);
};

export async function getNamingDataset() {
  if (cache) return cache;

  const [strokesRows, metaRows, luckRows, surnameRows, poolRows] = await Promise.all([
    loadCsv('strokes.csv'),
    loadCsv('hanja_meta.csv'),
    loadCsv('luck81.csv'),
    loadCsv('surname.csv'),
    loadCsv('name_pool.csv')
  ]);

  const strokeMap = new Map(
    strokesRows
      .filter((row) => row.hanja && row.strokes)
      .map((row) => [row.hanja, Number(row.strokes)])
  );

  const metaMap = new Map(metaRows.filter((row) => row.hanja).map((row) => [row.hanja, row]));
  const luckMap = new Map(
    luckRows
      .filter((row) => row.number)
      .map((row) => [Number(row.number), row])
  );
  const surnameMap = new Map(surnameRows.filter((row) => row.hanja).map((row) => [row.hanja, row]));

  const pool = poolRows
    .filter((row) => row.hanja && row.enabled === 'true')
    .map((row) => ({
      hanja: row.hanja,
      priority: Number(row.priority || 0),
      strokes: strokeMap.get(row.hanja) ?? null,
      meta: metaMap.get(row.hanja) ?? null
    }))
    .filter((row) => Number.isFinite(row.strokes) && row.meta);

  cache = {
    strokeMap,
    metaMap,
    luckMap,
    surnameMap,
    pool
  };

  return cache;
}

export function clearNamingDatasetCache() {
  cache = null;
}
