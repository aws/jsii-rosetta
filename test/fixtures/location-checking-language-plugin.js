/**
 * A language plugin that renders whether every assembly location it was given
 * exists, for testing that `prepare` receives paths a worker can open.
 *
 * Translation runs from a temporary compilation directory, so a location
 * passed on as the caller wrote it (relative to the caller's working
 * directory) points nowhere by the time a worker reads it.
 */
'use strict';

const fs = require('node:fs');
const { DefaultVisitor } = require('../../lib/languages/default');
const { registerTargetLanguage } = require('../../lib/languages');
const { OTree } = require('../../lib/o-tree');
const { PLUGIN_API_VERSION } = require('../../lib/plugins');

let locations = [];

class LocationCheckingVisitor extends DefaultVisitor {
  constructor() {
    super();
    this.language = 'location-checking-plugin';
    this.defaultContext = {};
  }
  mergeContext(old, update) {
    return { ...old, ...update };
  }
  identifier(node) {
    const allExist = locations.length > 0 && locations.every((location) => fs.existsSync(location));
    return new OTree([`${node.text}@${allExist ? 'found' : 'missing'}`]);
  }
}

registerTargetLanguage(
  'location-checking-plugin',
  {
    version: '1',
    createVisitor: () => new LocationCheckingVisitor(),
    prepare: (context) => {
      locations = [...(context.assemblyLocations ?? [])];
    },
  },
  { pluginApiVersion: PLUGIN_API_VERSION },
);
