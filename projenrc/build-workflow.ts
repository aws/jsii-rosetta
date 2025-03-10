import { NodeRelease } from '@jsii/check-node';
import { github, typescript } from 'projen';

export interface BuildWorkflowOptions {
  /**
   * If true (the default), a second workflow will be registered to enable
   * "merge when ready" (a.k.a: auto-merge) on any "ready for review" PR (all
   * PRs that are not draft, and are in an "opened" or "re-opened" state). This
   * saves the maintainers from having to manually enable this.
   *
   * @default true
   */
  readonly autoMerge?: boolean;

  /**
   * The default branch for the repository. The build automation will run for
   * `push` events on this branch. If set to `null`, the `push` event will not
   * trigger any workflow.
   *
   * @default 'main'
   */
  readonly defaultBranch?: string | null;
}

export class BuildWorkflow {
  public constructor(project: typescript.TypeScriptProject, opts: BuildWorkflowOptions = {}) {
    const wf = project.github!.addWorkflow('build');
    wf.on({
      mergeGroup: {},
      pullRequest: {},
      workflowDispatch: {},
    });

    if (opts.defaultBranch !== null) {
      wf.on({
        push: {
          branches: [opts.defaultBranch ?? 'main', 'maintenance/*'],
        },
      });
    }

    const nodeVersion = project.minNodeVersion?.split('.', 1).at(0) ?? 'lts/*';

    wf.addJobs({
      'build': {
        env: { CI: 'true' },
        outputs: {
          'self-mutation-needed': {
            stepId: 'self-mutation',
            outputName: 'needed',
          },
        },
        permissions: { contents: github.workflows.JobPermission.READ },
        runsOn: ['ubuntu-latest'],
        steps: [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': nodeVersion,
              'cache': 'yarn',
            },
          },
          {
            name: 'Cache build outputs',
            if: "github.event_name == 'pull_request'",
            uses: 'actions/cache@v3',
            with: {
              'key':
                "build-outputs-${{ hashFiles('tsconfig.json', 'build-tools/**/*.ts', 'src/**/*.ts', 'package.json', 'yarn.lock') }}",
              'path': ['tsconfig.tsbuildinfo', 'lib/**/*'].join('\n'),
              'restore-keys': 'build-outputs-',
            },
          },
          {
            name: 'Install dependencies',
            run: 'yarn install --check-files',
          },
          {
            name: 'compile',
            run: ['npx projen', 'npx projen pre-compile', 'npx projen compile', 'npx projen post-compile'].join(' && '),
          },

          // Run tests to allow self-mutation to be performed if needed...
          { name: 'test', run: 'npx projen test' },
          {
            name: 'Find mutations',
            id: 'self-mutation',
            run: [
              'git add .',
              'git diff --staged --patch --exit-code > .repo.patch || echo "needed=true" >> $GITHUB_OUTPUT',
            ].join('\n'),
          },
          {
            name: 'Upload patch',
            if: 'steps.self-mutation.outputs.needed',
            uses: 'actions/upload-artifact@v4.3.6',
            with: {
              name: '.repo.patch',
              path: '.repo.patch',
              overwrite: true,
            },
          },
          {
            name: 'Fail if self-mutation is needed',
            if: 'steps.self-mutation.outputs.needed',
            run: [
              'echo "::error::Files were changed during build (see build log). If this was triggered from a fork, you will need to update your branch."',
              'cat .repo.patch',
              'exit 1',
            ].join('\n'),
          },

          {
            name: 'Upload artifact',
            uses: 'actions/upload-artifact@v4.3.6',
            with: {
              name: 'build-output',
              path: [
                '${{ github.workspace }}',
                // Exclude node_modules to reduce artifact size (we won't use those anyway)...
                '!${{ github.workspace }}/node_modules',
                '!${{ github.workspace }}/fixtures/node_modules',
              ].join('\n'),
              overwrite: true,
            },
          },
        ],
      },
      'self-mutation': {
        env: { CI: 'true' },
        needs: ['build'],
        runsOn: ['ubuntu-latest'],
        permissions: { contents: github.workflows.JobPermission.WRITE },
        if: "always() && (github.event_name == 'pull_request') && needs.build.outputs.self-mutation-needed && (github.event.pull_request.head.repo.full_name == github.repository)",
        steps: [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
            with: {
              ref: '${{ github.event.pull_request.head.ref }}',
              repository: '${{ github.event.pull_request.head.repo.full_name }}',
              token: '${{ secrets.PROJEN_GITHUB_TOKEN }}',
            },
          },
          {
            name: 'Download patch',
            uses: 'actions/download-artifact@v4',
            with: {
              name: '.repo.patch',
              path: '${{ runner.temp }}',
            },
          },
          {
            name: 'Apply patch',
            run: '[ -s ${{ runner.temp }}/.repo.patch ] && git apply ${{ runner.temp }}/.repo.patch || echo "Empty patch. Skipping."',
          },
          {
            name: 'Set git identity',
            run: ['git config user.name "github-actions"', 'git config user.email "github-actions@github.com"'].join(
              '\n',
            ),
          },
          {
            name: 'Push changes',
            run: [
              'git add .',
              'git commit -s -m "chore: self-mutation"',
              'git push origin HEAD:${{ github.event.pull_request.head.ref }}',
            ].join('\n'),
          },
        ],
      },
      'matrix-test': {
        env: { CI: 'true' },
        if: 'success()',
        strategy: {
          failFast: false,
          matrix: {
            domain: {
              'node-version': NodeRelease.ALL_RELEASES.flatMap((release) => {
                if (!release.supported || isOdd(release.majorVersion)) {
                  return [];
                }
                return [`${release.majorVersion}.x`];
              }),
            },
          },
        },
        name: 'test (node ${{ matrix.node-version }})',
        needs: ['build'],
        permissions: {},
        runsOn: ['ubuntu-latest'],
        steps: [
          {
            name: 'Download artifact',
            uses: 'actions/download-artifact@v4',
            with: { name: 'build-output', path: '${{ github.workspace }}' },
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '${{ matrix.node-version }}',
              'cache': 'yarn',
            },
          },
          {
            name: 'Install dependencies',
            run: 'yarn install --frozen-lockfile',
          },
          // Re-run post-compile to ensure /fixtures/ symlinks are correctly present...
          {
            name: 'Re-run post-compile',
            run: 'npx projen post-compile',
          },
          { name: 'Test', run: 'npx projen test' },
          {
            name: 'Assert clean working directory',
            run: 'git diff --staged --exit-code',
          },
        ],
      },
      'matrix-clear': {
        // This is a simple "join target" to simplify branch protection rules.
        env: { CI: 'true' },
        name: 'Unit Tests',
        needs: ['matrix-test'],
        permissions: {},
        runsOn: ['ubuntu-latest'],
        if: 'always()',
        steps: [
          {
            name: 'Build result',
            run: 'echo ${{needs.matrix-test.result}}',
          },
          {
            if: "${{ needs.matrix-test.result != 'success' }}",
            name: 'Set status based on matrix build',
            run: 'exit 1',
          },
        ],
      },
      'package': {
        env: { CI: 'true' },
        name: 'package',
        needs: ['build'],
        permissions: {},
        runsOn: ['ubuntu-latest'],
        steps: [
          {
            name: 'Download artifact',
            uses: 'actions/download-artifact@v4',
            with: { name: 'build-output', path: '${{ github.workspace }}' },
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': nodeVersion,
              'cache': 'yarn',
            },
          },
          {
            name: 'Install dependencies',
            run: 'yarn install --frozen-lockfile',
          },
          {
            name: 'Package',
            run: 'npx projen package',
          },
          {
            name: 'Upload artifact',
            uses: 'actions/upload-artifact@v4.3.6',
            with: {
              name: 'release-package',
              path: '${{ github.workspace }}/dist',
              overwrite: true,
            },
          },
        ],
      },
    });

    if (opts.autoMerge ?? true) {
      const autoMerge = project.github!.addWorkflow('auto-merge');
      autoMerge.runName = 'Enable "Merge when ready" on PR #${{ github.event.number }}';
      autoMerge.on({
        pullRequestTarget: {
          types: ['opened', 'reopened', 'ready_for_review'],
        },
      });
      autoMerge.addJob('enable-auto-merge', {
        env: { CI: 'true' },
        name: 'Enable "Merge when ready" for this PR',
        permissions: {
          pullRequests: github.workflows.JobPermission.WRITE,
          contents: github.workflows.JobPermission.WRITE,
        },
        runsOn: ['ubuntu-latest'],
        steps: [
          {
            uses: 'peter-evans/enable-pull-request-automerge@v2',
            with: {
              'token': '${{ secrets.PROJEN_GITHUB_TOKEN }}',
              'pull-request-number': '${{ github.event.number }}',
              'merge-method': 'squash',
            },
          },
        ],
      });
    }
  }
}

const isOdd = function (x: number): boolean {
  return Boolean(x & 1);
};
