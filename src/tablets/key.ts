import * as crypto from 'node:crypto';

import { RECORD_REFERENCES_VERSION } from '../languages/record-references-version';
import { TypeScriptSnippet, renderApiLocation } from '../snippet';

/**
 * Determine the key for a code block
 */
export function snippetKey(snippet: TypeScriptSnippet) {
  const h = crypto.createHash('sha256');
  h.update(String(RECORD_REFERENCES_VERSION));
  // Mix in API location to distinguish between similar snippets
  h.update(renderApiLocation(snippet.location.api));
  h.update(':');
  h.update(snippet.visibleSource);
  return h.digest('hex');
}
