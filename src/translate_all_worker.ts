/**
 * Pool worker for extract.ts
 */
import * as workerpool from 'workerpool';

import * as logging from './logging';
import { TypeScriptSnippet } from './snippet';
import { TranslatedSnippetSchema } from './tablets/schema';
import { TranslatedSnippet } from './tablets/tablets';
import { RosettaDiagnostic, makeRosettaDiagnostic, Translator } from './translate';
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

  const translator = new Translator(includeCompilerDiagnostics);
  for (const block of snippets) {
    try {
      translatedSnippets.push(translator.translate(block));
    } catch (e: any) {
      failures.push(
        makeRosettaDiagnostic(true, `rosetta: error translating snippet: ${e}\n${e.stack}\n${block.completeSource}`),
      );
    }
  }

  return {
    translatedSnippets,
    diagnostics: [...translator.diagnostics, ...failures],
  };
}

workerpool.worker({ translateBatch });
