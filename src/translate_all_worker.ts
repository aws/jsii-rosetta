/**
 * Pool worker for translate_all.ts
 */
import * as workerpool from 'workerpool';

import * as logging from './logging';
import { translateBatch, TranslateBatchRequest } from './translate_batch';

workerpool.worker({
  translateBatch: (request: TranslateBatchRequest) => {
    // because we are in a worker thread we need to explicitly configure the log level again
    logging.configure({ level: request.logLevel ?? logging.Level.QUIET, prefix: request.workerName });
    return translateBatch(request);
  },
});
