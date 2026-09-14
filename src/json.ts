import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

// NB: In node 15+, there is a node:stream.promises object that has this built-in.
const asyncPipeline = promisify(pipeline);

// `stream-json` v3+ is published as an ESM-only package. This module is compiled
// to CommonJS. We therefore load it via dynamic `import()`, which bridges CJS -> ESM.
//
// The import is kicked off once, eagerly, at module load time (rather than lazily
// inside `parse`/`stringify`). Module load happens on the very first `require` of
// this file, before any consumer has a chance to swap the filesystem out from
// under us (e.g. tests using `mock-fs`). Resolving the `stream-json` files lazily
// on first call would instead race against such mocks and fail with "Cannot find module" error.
//
// We would love to use `Promise.all` to do all the imports in parallel, but according
// to AI Node 20 and 22 have a bug in the ESM importer that causes a
// "request for '../index.js' is not in cache" error. So we do it in a loop instead.

const parserP = import('stream-json/parser.js').then((mod) => mod.parser);
const AssemblerP = import('stream-json/assembler.js').then((mod) => mod.default);
const disassemblerP = import('stream-json/disassembler.js').then((mod) => mod.disassembler);
const stringerP = import('stream-json/stringer.js').then((mod) => mod.stringer);

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
  const parser = await parserP;
  const Assembler = await AssemblerP;

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
  const disassembler = await disassemblerP;
  const stringer = await stringerP;

  const reader = new Readable({ objectMode: true });
  reader.push(value);
  reader.push(null);

  // v3's subpath factories expose `.asStream()` to obtain a Node Duplex stream
  // (the bare factory returns a `stream-chain` stage, not a Node stream).
  return asyncPipeline(reader, disassembler.asStream(), stringer.asStream(), ...writers);
}
