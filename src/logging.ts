import * as util from 'node:util';

export enum Level {
  ERROR = -2,
  WARN = -1,
  QUIET = 0,
  INFO = 1,
  VERBOSE = 2,
}

export const LEVEL_INFO: number = Level.INFO;
export const LEVEL_VERBOSE: number = Level.VERBOSE;

/** The minimal logging level for messages to be emitted. */
let level = Level.QUIET;

/** Optionally emit messages with a prefix */
let prefix: string | null = null;

export function current(): Level {
  return level;
}

export function configure({ level: newLevel, prefix: newPrefix }: { level: Level; prefix?: string }) {
  level = newLevel;
  prefix = newPrefix ?? null;
}

export function warn(fmt: string, ...args: any[]) {
  log(Level.WARN, fmt, ...args);
}

export function error(fmt: string, ...args: any[]) {
  log(Level.ERROR, fmt, ...args);
}

export function info(fmt: string, ...args: any[]) {
  log(Level.INFO, fmt, ...args);
}

export function debug(fmt: string, ...args: any[]) {
  log(Level.VERBOSE, fmt, ...args);
}

function log(messageLevel: Level, fmt: string, ...args: any[]) {
  if (level >= messageLevel) {
    const levelName = Level[messageLevel];
    const pref = prefix ? ` [${prefix}] ` : '';
    // `console.error` will automatically be transported from worker child to worker parent,
    // process.stderr.write() won't.
    console.error(`[jsii-rosetta] [${levelName}]${pref} ${util.format(fmt, ...args)}`);
  }
}
