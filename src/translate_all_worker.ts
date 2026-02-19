/**
 * Pool worker for extract.ts
 */
import { inspect } from 'node:util';
import * as workerpool from 'workerpool';

import * as logging from './logging';
import { formatLocation, TypeScriptSnippet } from './snippet';
import { snippetKey } from './tablets/key';
import { TranslatedSnippetSchema } from './tablets/schema';
import { TranslatedSnippet } from './tablets/tablets';
import { RosettaDiagnostic, makeRosettaDiagnostic, makeTimingDiagnostic, Translator } from './translate';
import { TranslateAllResult } from './translate_all';

export interface TranslateBatchRequest {
  readonly workerName: string;
  readonly snippets: TypeScriptSnippet[];
  readonly includeCompilerDiagnostics: boolean;
  readonly logLevel?: logging.Level;
  readonly batchSize?: number;
}

export interface TranslateBatchResponse {
  // Cannot be 'TranslatedSnippet' because needs to be serializable
  readonly translatedSchemas: TranslatedSnippetSchema[];
  readonly diagnostics: RosettaDiagnostic[];
}

function translateBatch(request: TranslateBatchRequest): TranslateBatchResponse {
  // because we are in a worker process we need to explicitly configure the log level again
  logging.configure({ level: request.logLevel ?? logging.Level.QUIET, prefix: request.workerName });

  if (process.env.TIMING === '1' && request.batchSize) {
    logging.warn('TIMING=1 is not supported in batch compilation mode');
  }

  const result = request.batchSize
    ? batchTranslateAll(request.snippets, request.includeCompilerDiagnostics)
    : singleThreadedTranslateAll(request.snippets, request.includeCompilerDiagnostics);

  return {
    translatedSchemas: result.translatedSnippets.map((s) => s.snippet),
    diagnostics: result.diagnostics,
  };
}

function batchTranslateAll(snippets: TypeScriptSnippet[], includeCompilerDiagnostics: boolean): TranslateAllResult {
  const translatedSnippets = new Array<TranslatedSnippet>();

  const failures = new Array<RosettaDiagnostic>();

  const translator = new Translator(includeCompilerDiagnostics);

  try {
    const results = translator.translateSnippets(snippets);
    translatedSnippets.push(...results);
  } catch (e: any) {
    const snippetKeys = snippets.map((s) => snippetKey(s)).join(', ');
    logging.error(`Failed translating batch containing: ${snippetKeys}`);
    failures.push(makeRosettaDiagnostic(true, `rosetta: error translating batch: ${e}\n${e.stack}`));
  }

  return {
    translatedSnippets,
    diagnostics: [...translator.diagnostics, ...failures],
  };
}

/**
 * Translate the given snippets using a single compiler
 */
export function singleThreadedTranslateAll(
  snippets: TypeScriptSnippet[],
  includeCompilerDiagnostics: boolean,
): TranslateAllResult {
  const translatedSnippets = new Array<TranslatedSnippet>();
  const failures = new Array<RosettaDiagnostic>();
  const timings = new Array<RosettaDiagnostic>();

  const translator = new Translator(includeCompilerDiagnostics);
  for (const block of snippets) {
    const start = performance.now();
    const currentSnippetKey = snippetKey(block);
    logging.debug(`Translating ${currentSnippetKey} ${inspect(block.parameters ?? {})}`);

    try {
      translatedSnippets.push(translator.translate(block));
    } catch (e: any) {
      logging.error(
        `Failed translating snippet: ${currentSnippetKey} at ${formatLocation(block.location)}, params: ${inspect(
          block.parameters ?? {},
        )}`,
      );
      failures.push(
        makeRosettaDiagnostic(true, `rosetta: error translating snippet: ${e}\n${e.stack}\n${block.completeSource}`),
      );
    }

    const timing = makeTimingDiagnostic(currentSnippetKey, formatLocation(block.location), performance.now() - start);
    timings.push(timing);
    logging.debug(
      `Completed ${timing.timingInfo!.snippetKey} ${inspect({
        duration: `${(timing.timingInfo!.durationMs / 1000).toFixed(2)}s`,
      })}`,
    );
  }

  return {
    translatedSnippets,
    diagnostics: [...translator.diagnostics, ...failures, ...timings],
  };
}

workerpool.worker({ translateBatch });
