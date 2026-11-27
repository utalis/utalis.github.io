#!/usr/bin/env node
/**
 * 真君リスト R8.11.26 の新着を MASTER_SONGS に追加する。
 * 読み（y/k, ty/tk）とジャンルを同時に付ける。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMOKARA_20261126 } from './data/emokara-2026-11-26.mjs';
import { classifySongGenres } from './lib/master-genre-rules.mjs';
import { firstKanaChar } from './lib/title-reading.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(ROOT, 'index.html');

const html = fs.readFileSync(indexPath, 'utf8');
const match = html.match(/const MASTER_SONGS = (\[[\s\S]*?\]);/);
if (!match) throw new Error('MASTER_SONGS not found');
const songs = eval(match[1]);

function normKey(a, t) {
  return `${String(a).normalize('NFKC').toLowerCase().replace(/\s+/g, '')}\u0001${String(t).normalize('NFKC').toLowerCase().replace(/\s+/g, '')}`;
}

const existing = new Set(songs.map((s) => normKey(s.a, s.t)));
const yByArtist = new Map();
for (const s of songs) {
  if (!yByArtist.has(s.a)) yByArtist.set(s.a, s.y);
}

let nextId = Math.max(...songs.map((s) => s.id)) + 1;
const added = [];

for (const entry of EMOKARA_20261126) {
  const key = normKey(entry.a, entry.t);
  if (existing.has(key)) {
    console.log(`skip duplicate ${entry.t} / ${entry.a}`);
    continue;
  }
  const knownY = yByArtist.get(entry.a);
  if (knownY && knownY !== entry.y) {
    throw new Error(`artist reading mismatch ${entry.a}: catalog=${knownY} entry=${entry.y}`);
  }
  const k = [...entry.y][0];
  const tk = firstKanaChar(entry.ty);
  if (!k || [...entry.y][0] !== k) throw new Error(`bad y ${entry.a}`);
  if (k !== entry.y[0]) throw new Error(`k mismatch ${entry.a}`);
  if (!tk || tk !== [...entry.ty][0]) throw new Error(`bad ty ${entry.t} ${entry.ty}`);
  const song = {
    id: nextId++,
    k,
    y: entry.y,
    a: entry.a,
    t: entry.t,
    ty: entry.ty,
    tk,
    genres: [],
  };
  song.genres = classifySongGenres(song);
  if (!song.genres.length) throw new Error(`no genre ${entry.t} / ${entry.a}`);
  songs.push(song);
  existing.add(key);
  yByArtist.set(entry.a, entry.y);
  added.push(song);
}

fs.writeFileSync(
  indexPath,
  html.replace(/const MASTER_SONGS = (\[[\s\S]*?\]);/, `const MASTER_SONGS = ${JSON.stringify(songs)};`),
);

console.log(`Added ${added.length} songs (${songs.length} total)`);
for (const s of added) {
  console.log(`${s.genres.join('+')}\t${s.k}/${s.y}\t${s.tk}/${s.ty}\t${s.t} / ${s.a}`);
}
