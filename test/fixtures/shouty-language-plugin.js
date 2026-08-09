/**
 * A language plugin as a loadable module, for testing that worker threads can
 * be told to load plugins before translating.
 *
 * Worker threads are fresh module contexts: a language registered in the main
 * thread does not exist in them, so a worker-backed extract would silently
 * produce a tablet with no translations for that language.
 */
'use strict';

const { DefaultVisitor } = require('../../lib/languages/default');
const { registerTargetLanguage } = require('../../lib/languages');
const { OTree } = require('../../lib/o-tree');

class ShoutyVisitor extends DefaultVisitor {
  constructor() {
    super();
    this.language = 'shouty-plugin';
    this.defaultContext = {};
  }
  mergeContext(old, update) {
    return { ...old, ...update };
  }
  identifier(node) {
    return new OTree([String(node.text).toUpperCase()]);
  }
}

try {
  registerTargetLanguage('shouty-plugin', {
    version: '1',
    createVisitor: () => new ShoutyVisitor(),
  });
} catch (e) {
  if (!/already registered/.test(String(e && e.message))) {
    throw e;
  }
}
