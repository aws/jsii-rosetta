/**
 * A language plugin that needs to know which assemblies it is translating
 * examples for, for testing that workers are told.
 *
 * Why a language would need this: a snippet in a published example generally
 * does not typecheck (its fixtures are not shipped), so the visitor cannot ask
 * the type checker anything. Whether `Foo.BAR` is an enum member or a static
 * property, and which module `firehose.DeliveryStream` lives in, are answers
 * only the assembly holds. Languages whose rendering does not depend on type
 * identity never needed this, which is why nothing passes it today.
 *
 * Renders each identifier as `<name>@<number of assemblies it was told about>`
 * so a test can see what reached the worker.
 */
'use strict';

const { DefaultVisitor } = require('../../lib/languages/default');
const { registerTargetLanguage } = require('../../lib/languages');
const { OTree } = require('../../lib/o-tree');

/** Set by `prepare`, which the worker calls before translating. */
let known = [];

class AssemblyAwareVisitor extends DefaultVisitor {
  constructor() {
    super();
    this.language = 'assembly-aware-plugin';
    this.defaultContext = {};
  }
  mergeContext(old, update) {
    return { ...old, ...update };
  }
  identifier(node) {
    return new OTree([`${node.text}@${known.length}`]);
  }
}

try {
  registerTargetLanguage('assembly-aware-plugin', {
    version: '1',
    createVisitor: () => new AssemblyAwareVisitor(),
    prepare: (context) => {
      known = [...(context.assemblyLocations ?? [])];
    },
  });
} catch (e) {
  if (!/already registered/.test(String(e && e.message))) {
    throw e;
  }
}
