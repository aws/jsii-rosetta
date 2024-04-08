import { DependencyType, javascript, JsonFile, JsonPatch, typescript, YamlFile } from 'projen';
import { BuildWorkflow } from './projenrc/build-workflow';
import { PullRequestBackport } from './projenrc/pull-request-backport';
import { ReleaseWorkflow } from './projenrc/release';
import { SUPPORT_POLICY, SupportPolicy } from './projenrc/support';
import { JsiiDependencyUpgrades } from './projenrc/upgrade-dependencies';

/**
 * See 'projenrc/support.ts' for jsii-compiler/TypeScripts versions we are tracking.
 * To add a new version:
 *
 * 1. Perform the new version release for jsii-compiler and make sure the version has been released
 * 2. Fork the current `main` to a maintenance branch:
 *    `git push origin main:maintenance/vx.y` (x.y is the TS version that is about to be replaced by a new release)
 * 3. Add a branch protection rule for the new maintenance branch
 * 4. Edit `support.ts`, maintenance EOL date for the current version is 6 months from
 *    today, make the new version current. Also update `currentMinVersionNumber`.
 * 5. Update `minNodeVersion` to the oldest LTS version of Node (i.e. dropping support for EOL versions of Node)
 * 6. `npx projen`
 * 7. Update the version list in the README (remember to remove EOS versions)
 * 8. Create a PR
 * 9. Add support for the new rosetta version line in `jsii-docgen` (have a look at RosettaPeerDependency in projenrc.ts).
 */

const project = new typescript.TypeScriptProject({
  projenrcTs: true,

  name: 'jsii-rosetta',
  license: 'Apache-2.0',

  authorName: 'Amazon Web Services',
  authorUrl: 'https://aws.amazon.com',

  homepage: 'https://aws.github.io/jsii',
  repository: 'https://github.com/aws/jsii-rosetta.git',

  pullRequestTemplateContents: [
    '',
    '',
    '---',
    '',
    'By submitting this pull request, I confirm that my contribution is made under the terms of the [Apache 2.0 license].',
    '',
    '[Apache 2.0 license]: https://www.apache.org/licenses/LICENSE-2.0',
  ],

  autoDetectBin: true,

  minNodeVersion: '18.12.0',
  tsconfig: {
    compilerOptions: {
      // @see https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping
      lib: ['es2020', 'es2021.WeakRef'],
      target: 'ES2020',
      moduleResolution: javascript.TypeScriptModuleResolution.NODE_NEXT,
      module: 'nodenext',
      esModuleInterop: false,
      noImplicitOverride: true,
      skipLibCheck: true,

      sourceMap: true,
      inlineSourceMap: false,
      inlineSources: true,
    },
  },

  prettier: true,
  prettierOptions: {
    ignoreFile: false,
    settings: {
      bracketSpacing: true,
      printWidth: 120,
      quoteProps: javascript.QuoteProps.CONSISTENT,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: javascript.TrailingComma.ALL,
    },
  },

  jestOptions: {
    configFilePath: 'jest.config.json',
    jestConfig: {
      moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
      watchPathIgnorePatterns: [
        // NB: Those are regexes...
        '<rootDir>/fixtures/\\..*',
        '<rootDir>/fixtures/node_modules',
        '<rootDir>/fixtures/.*\\.d\\.ts',
        '<rootDir>/fixtures/.*\\.js',
        '<rootDir>/fixtures/.*\\.map',
      ],
    },
    junitReporting: false,
  },

  buildWorkflow: false, // We have our own build workflow (need matrix test)
  release: false, // We have our own release workflow
  defaultReleaseBranch: 'main',

  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['aws-cdk-automation', 'github-bot'],
  },

  depsUpgrade: false, // We have our own custom upgrade workflow

  vscode: true,

  devDeps: [
    '@actions/core',
    '@actions/github',
    '@types/commonmark',
    '@types/mock-fs',
    '@types/stream-json',
    '@types/tar',
    '@types/workerpool',
    'fs-monkey',
    'memfs',
    'mock-fs',
    'tar',
    'ts-node',
  ],
  deps: [
    '@jsii/check-node',
    '@jsii/spec',
    '@xmldom/xmldom',
    'chalk@^4',
    'commonmark',
    'fast-glob',
    `jsii@~${SUPPORT_POLICY.currentMinVersionNumber}`,
    'semver-intersect',
    'semver',
    'stream-json',
    `typescript@~${SUPPORT_POLICY.current}`,
    'workerpool',
    'yargs',
  ],
});

// PR validation should run on merge group, too...
(project.tryFindFile('.github/workflows/pull-request-lint.yml')! as YamlFile).patch(
  JsonPatch.add('/on/merge_group', {}),
  JsonPatch.add(
    '/jobs/validate/steps/0/if',
    "github.event == 'pull_request' || github.event_name == 'pull_request_target'",
  ),
);

new JsiiDependencyUpgrades(project);

// contributors:update
project.addDevDeps('all-contributors-cli');
const contributors = project.addTask('contributors:update', {
  exec: 'all-contributors check | grep "Missing contributors" -A 1 | tail -n1 | sed -e "s/,//g" | xargs -n1 | grep -v "\\[bot\\]" | grep -v "aws-cdk-automation" | xargs -n1 -I{} all-contributors add {} code',
});
contributors.exec('all-contributors generate');

// VSCode will look at the "closest" file named "tsconfig.json" when deciding on which config to use
// for a given TypeScript file with the TypeScript language server. In order to make this "seamless"
// we'll be dropping `tsconfig.json` files at strategic locations in the project. These will not be
// committed as they are only here for VSCode comfort.
for (const dir of ['build-tools', 'projenrc', 'test', 'test/translations']) {
  new JsonFile(project, `${dir}/tsconfig.json`, {
    allowComments: true,
    committed: false,
    marker: true,
    obj: {
      extends: '../tsconfig.dev.json',
      references: [{ path: '../tsconfig.json' }],
    },
    readonly: true,
  });
}
project.tsconfig?.file?.patch(
  JsonPatch.add('/compilerOptions/composite', true),
  JsonPatch.add('/compilerOptions/declarationMap', true),
);
// Don't try to compile files under the `test/translations` directory with tests...
project.tsconfigDev.addExclude('test/translations/**/*.ts');
project.eslint?.addIgnorePattern('test/translations/**/*.ts');

// Don't show .gitignore'd files in the VSCode explorer
project.vscode!.settings.addSetting('explorer.excludeGitIgnore', true);
// Use the TypeScript SDK from the project dependencies
project.vscode!.settings.addSetting('typescript.tsdk', 'node_modules/typescript/lib');
// Format-on-save using ESLint
project.vscode!.extensions.addRecommendations('dbaeumer.vscode-eslint');
project.vscode!.settings.addSetting('editor.codeActionsOnSave', { 'source.fixAll.eslint': true });
project.vscode!.settings.addSetting('eslint.validate', ['typescript']);

// Exports map...
project.package.addField('exports', {
  '.': `./${project.package.entrypoint}`,
  './package.json': './package.json',
});

// Remove TypeScript devDependency (it's a direct/normal dependency here)
project.deps.removeDependency('typescript', DependencyType.BUILD);

// Modernize ts-jest configuration
if (project.jest?.config?.globals?.['ts-jest']) {
  delete project.jest.config.globals['ts-jest'];
  project.jest.config.transform ??= {};
  project.jest.config.transform['^.+\\.tsx?$'] = [
    'ts-jest',
    {
      compiler: 'typescript',
      tsconfig: 'tsconfig.dev.json',
    },
  ];
}

// Add fixtures & other exemptions to npmignore
project.npmignore?.addPatterns(
  '/.*',
  '/CODE_OF_CONDUCT.md',
  '/CONTRIBUTING.md',
  '/build-tools/',
  '/fixtures/',
  '/projenrc/',
  '*.tsbuildinfo',
  '*.d.ts.map', // Declarations map aren't useful in published packages.
);

// Customize ESLint rules
project.tsconfigDev.addInclude('build-tools/**/*.ts');
project.eslint!.rules!['no-bitwise'] = ['off']; // The TypeScript compiler API leverages some bit-flags.
project.eslint!.rules!.quotes = ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }];
project.addDevDeps('eslint-plugin-unicorn');
// Add Unicorn rules (https://github.com/sindresorhus/eslint-plugin-unicorn#rules)
project.eslint?.addPlugins('unicorn');
project.eslint?.addRules({
  'unicorn/prefer-node-protocol': ['error'],
  'unicorn/no-array-for-each': ['error'],
  'unicorn/no-unnecessary-await': ['error'],
});

// Add Node.js version matrix test
new BuildWorkflow(project);

// Add support policy documents & release workflows
const supported = new SupportPolicy(project);
const releases = new ReleaseWorkflow(project)
  .autoTag({
    preReleaseId: 'dev',
    runName: 'Auto-Tag Prerelease (default branch)',
    schedule: '0 0 * * 0,2-6', // Tuesday though sundays at midnight
  })
  .autoTag({
    runName: 'Auto-Tag Release (default branch)',
    schedule: '0 0 * * 1', // Mondays at midnight
  });

// We'll stagger release schedules so as to avoid everything going out at once.
let hour = 0;
for (const [version, until] of Object.entries(SUPPORT_POLICY.maintenance)) {
  if (Date.now() <= until.getTime()) {
    // Stagger schedules every 5 hours, rolling. 5 was selected because it's co-prime to 24.
    hour = (hour + 5) % 24;

    const tag = `v${version}`;

    releases
      .autoTag({
        preReleaseId: 'dev',
        runName: `Auto-Tag Prerelease (${tag})`,
        schedule: `0 ${hour} * * 0,2-6`, // Tuesday though sundays
        branch: supported.branches[version],
        nameSuffix: tag,
      })
      .autoTag({
        runName: `Auto-Tag Release (${tag})`,
        schedule: `0 ${hour} * * 1`, // Mondays
        branch: supported.branches[version],
        nameSuffix: tag,
      });
  }
}

// Allow PR backports to all maintained versions
new PullRequestBackport(project, {
  branches: Object.values(supported.branches),
});

project.synth();
