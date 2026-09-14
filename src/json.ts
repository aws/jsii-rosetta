import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

// NB: In node 15+, there is a node:stream.promises object that has this built-in.
const asyncPipeline = promisify(pipeline);

/**
 * Load 'stream-json' eagerly, not lazily.
 *
 * Necessary for tests that use mockfs, otherwise the mocks will
 * interfere with the lazy import() call.
 */
export async function eagerlyLoadStreamJsonBeforeMockFs() {
  await loadStreamJson();
}

async function loadStreamJson() {
  // Must not be loaded through Promise.all() because then we get race conditions
  // on Node 20-22.
  const { parser } = await import('stream-json/parser.js');
  const { Assembler } = await import('stream-json/assembler.js');
  const { disassembler } = await import('stream-json/disassembler.js');
  const { stringer } = await import('stream-json/stringer.js');
  return { parser, Assembler, disassembler, stringer };
}

/**
 * Asynchronously parses a single JSON value from the provided reader. The JSON
 * text might be longer than what could fit in a single string value, since the
 * processing is done in a streaming manner.
 *
 * Prefer using JSON.parse if you know the entire JSON text is always small
 * enough to fit in a string value, as this would have better performance.
 *
 * @param reader the reader from which to consume JSON text.
 *
 * @returns the parse JSON value as a Javascript value.
 */
export async function parse(reader: Readable): Promise<any> {
  // Load ESM package from CJS. Not in parallel to avoid triggering a bug in Nodes 20-22.
  const { parser, Assembler } = await loadStreamJson();

  const assembler = new Assembler();
  // v3's subpath factories expose `.asStream()` to obtain a Node Duplex stream
  // (the bare factory returns a `stream-chain` stage, not a Node stream).
  const jsonParser = parser.asStream();
  assembler.connectTo(jsonParser);
  return asyncPipeline(reader, jsonParser).then(() => assembler.current);
}

/**
 * Serializes a possibly large object into the provided writer. The object may
 * be large enough that the JSON text cannot fit in a single string value.
 *
 * Prefer using JSON.stringify if you know the object is always small enough
 * that the JSON text can fit in a single string value, as this would have
 * better performance.
 *
 * @param value the value to be serialized.
 * @param writers the sequence of write streams to use to output the JSON text.
 */
export async function stringify(
  value: any,
  ...writers: Array<NodeJS.ReadWriteStream | NodeJS.WritableStream>
): Promise<void> {
  // Load ESM package from CJS. Not in parallel to avoid triggering a bug in Nodes 20-22.
  const { disassembler, stringer } = await loadStreamJson();

  const reader = new Readable({ objectMode: true });
  reader.push(value);
  reader.push(null);

  // v3's subpath factories expose `.asStream()` to obtain a Node Duplex stream
  // (the bare factory returns a `stream-chain` stage, not a Node stream).
  return asyncPipeline(reader, disassembler.asStream(), stringer.asStream(), ...writers);
}
