import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { resolveTranslateAllWorker } from '../src/translate_all';

const WORKER_FILE = 'translate_all_worker.js';
const packagedWorker = path.resolve(__dirname, '..', 'lib', WORKER_FILE);

function withTempDir(parent: string, callback: (dir: string) => void) {
  const dir = mkdtempSync(path.join(parent, 'rosetta-worker-'));
  try {
    callback(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

test('uses the worker next to this file when present', () => {
  withTempDir(tmpdir(), (dir) => {
    const localWorker = path.join(dir, WORKER_FILE);
    writeFileSync(localWorker, '');
    const bundle = path.join(dir, 'bundle.cjs');
    writeFileSync(bundle, '');

    expect(resolveTranslateAllWorker(dir, bundle)).toBe(localWorker);
  });
});

test('resolves the worker from the installed package when __dirname is a bundle directory', () => {
  // The fake bundle must live inside this package so Node can self-resolve
  // `jsii-rosetta/package.json` from `fromFile` (no process.cwd() fallback).
  withTempDir(__dirname, (dir) => {
    const bundle = path.join(dir, 'bundle.cjs');
    writeFileSync(bundle, '');

    expect(resolveTranslateAllWorker(dir, bundle)).toBe(packagedWorker);
  });
});
