import * as os from 'node:os';
import * as path from 'node:path';
import * as workerpool from 'workerpool';

import * as logging from './logging';
import { TypeScriptSnippet } from './snippet';
import { TranslatedSnippet } from './tablets/tablets';
import { RosettaDiagnostic } from './translate';
import type { TranslateBatchRequest, TranslateBatchResponse } from './translate_all_worker';

/**
 * Divide the work evenly over all processors by running 'translate_all_worker' in Worker Threads, then combine results
 *
 * The workers are fed small queues of work each. We used to divide the entire queue into N
 * but since the work is divided unevenly that led to some workers stopping early, idling while
 * waiting for more work.
 *
 * Never include 'translate_all_worker' directly, only do TypeScript type references (so that in
 * the script we may assume that 'worker_threads' successfully imports).
 */
export async function translateAll(
  snippets: TypeScriptSnippet[],
  includeCompilerDiagnostics: boolean,
  batchSize?: number,
): Promise<TranslateAllResult> {
  // Use about half the advertised cores because hyperthreading doesn't seem to
  // help that much, or we become I/O-bound at some point. On my machine, using
  // more than half the cores actually makes it slower.
  // Cap to a reasonable top-level limit to prevent thrash on machines with many, many cores.
  const N = process.env.JSII_ROSETTA_MAX_WORKER_COUNT
    ? parseInt(process.env.JSII_ROSETTA_MAX_WORKER_COUNT)
    : Math.min(16, Math.max(1, Math.ceil(os.cpus().length / 2)));
  const snippetArr = Array.from(snippets);
  const batchesOf = batchSize ? ` (in batches of ${batchSize})` : '';
  logging.info(`Translating ${snippetArr.length} snippets using ${N} workers${batchesOf}`);

  const pool = workerpool.pool(path.join(__dirname, 'translate_all_worker.js'), {
    maxWorkers: N,
  });

  try {
    const shouldBatchCompilation = batchSize != null;
    const requests = batchSnippets(snippetArr, includeCompilerDiagnostics, batchSize, shouldBatchCompilation);

    const responses: TranslateBatchResponse[] = await Promise.all(
      requests.map((request) => pool.exec('translateBatch', [request])),
    );

    const diagnostics = new Array<RosettaDiagnostic>();
    const translatedSnippets = new Array<TranslatedSnippet>();

    // Combine results
    for (const response of responses) {
      diagnostics.push(...response.diagnostics);
      translatedSnippets.push(...response.translatedSchemas.map(TranslatedSnippet.fromSchema));
    }
    return { diagnostics, translatedSnippets };
  } finally {
    // Not waiting on purpose
    void pool.terminate();
  }
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
}
