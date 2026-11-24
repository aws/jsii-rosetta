import { existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as workerpool from 'workerpool';

import * as logging from './logging';
import { TypeScriptSnippet } from './snippet';
import { TranslatedSnippet } from './tablets/tablets';
import { RosettaDiagnostic, SnippetTimingInfo, extractTimingInfo } from './translate';
import { translateBatch, TranslateBatchRequest, TranslateBatchResponse } from './translate_batch';

/**
 * Divide the work evenly over all processors by running 'translate_all_worker' in Worker Threads, then combine results
 *
 * The workers are fed small queues of work each. We used to divide the entire queue into N
 * but since the work is divided unevenly that led to some workers stopping early, idling while
 * waiting for more work.
 *
 * If the worker script is not next to this file (for example because jsii-rosetta was bundled
 * and the bundler did not emit it), the work is done in the main thread instead.
 */
export async function translateAll(
  snippets: TypeScriptSnippet[],
  includeCompilerDiagnostics: boolean,
  batchSize?: number,
  workerScript = path.join(__dirname, 'translate_all_worker.js'),
): Promise<TranslateAllResult> {
  const snippetArr = Array.from(snippets);
  const shouldBatchCompilation = batchSize != null;
  const requests = batchSnippets(snippetArr, includeCompilerDiagnostics, batchSize, shouldBatchCompilation);

  const responses = existsSync(workerScript)
    ? await translateInWorkers(workerScript, requests, batchSize)
    : translateInProcess(workerScript, requests);

  const allDiagnostics = new Array<RosettaDiagnostic>();
  const translatedSnippets = new Array<TranslatedSnippet>();

  // Combine results
  for (const response of responses) {
    allDiagnostics.push(...response.diagnostics);
    translatedSnippets.push(...response.translatedSchemas.map(TranslatedSnippet.fromSchema));
  }

  // Extract timing info if enabled
  const { timings, diagnostics } = extractTimingInfo(allDiagnostics);

  return {
    diagnostics,
    translatedSnippets,
    timings: process.env.TIMING === '1' ? timings : undefined,
  };
}

async function translateInWorkers(
  workerScript: string,
  requests: TranslateBatchRequest[],
  batchSize?: number,
): Promise<TranslateBatchResponse[]> {
  // Use about half the advertised cores because hyperthreading doesn't seem to
  // help that much, or we become I/O-bound at some point. On my machine, using
  // more than half the cores actually makes it slower.
  // Cap to a reasonable top-level limit to prevent thrash on machines with many, many cores.
  const N = process.env.JSII_ROSETTA_MAX_WORKER_COUNT
    ? parseInt(process.env.JSII_ROSETTA_MAX_WORKER_COUNT)
    : Math.min(16, Math.max(1, Math.ceil(os.cpus().length / 2)));
  const snippetCount = requests.reduce((n, r) => n + r.snippets.length, 0);
  const batchesOf = batchSize ? ` (in batches of ${batchSize})` : '';
  logging.info(`Translating ${snippetCount} snippets using ${N} workers${batchesOf}`);

  const pool = workerpool.pool(workerScript, {
    maxWorkers: N,
  });

  try {
    return await Promise.all(requests.map((request) => pool.exec('translateBatch', [request])));
  } finally {
    // Not waiting on purpose
    void pool.terminate();
  }
}

function translateInProcess(workerScript: string, requests: TranslateBatchRequest[]): TranslateBatchResponse[] {
  logging.warn(
    `${workerScript} not found, translating in the main thread. ` +
      'If you bundle jsii-rosetta, see https://github.com/aws/jsii-rosetta#bundling-jsii-rosetta',
  );
  return requests.map(translateBatch);
}

function batchSnippets(
  snippets: TypeScriptSnippet[],
  includeCompilerDiagnostics: boolean,
  batchSize = 10,
  shouldBatchCompilation: boolean = false,
): TranslateBatchRequest[] {
  const logLevel = logging.current();
  const ret: TranslateBatchRequest[] = [];

  for (let i = 0; i < snippets.length; i += batchSize) {
    // create a unique worker name, purely for logging so can be pseudo random
    const workerId = Math.random().toString(16).slice(2, 6).toUpperCase();
    ret.push({
      workerName: `Worker#${workerId}`,
      snippets: snippets.slice(i, i + batchSize),
      includeCompilerDiagnostics,
      logLevel,
      batchSize: shouldBatchCompilation ? batchSize : undefined,
    });
  }

  return ret;
}

export interface TranslateAllResult {
  translatedSnippets: TranslatedSnippet[];
  diagnostics: RosettaDiagnostic[];
  timings?: SnippetTimingInfo[];
}
