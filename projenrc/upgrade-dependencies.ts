import { Component, JsonPatch, javascript } from 'projen';
import { SUPPORT_POLICY } from './support';

export class JsiiDependencyUpgrades extends Component {
  public constructor(project: javascript.NodeProject) {
    super(project, 'jsii-deps-upgrades');

    const branches = [
      'main',
      ...Object.entries(SUPPORT_POLICY.maintenance).flatMap(([version, until]) => {
        if (Date.now() > until.getTime()) {
          return [];
        }
        return [`maintenance/v${version}`];
      }),
    ];

    const upgrades = new javascript.UpgradeDependencies(project, {
      exclude: ['jsii', 'typescript'],
      workflowOptions: {
        branches,
        labels: ['auto-approve'],
      },
    });
    
    for (const upgradeWorkflow of upgrades.workflows) {
      if (upgradeWorkflow.name.startsWith('upgrade-maintenance-')) {
        upgradeWorkflow.file?.patch(
          JsonPatch.add('/jobs/upgrade/steps/3', {
            name: 'Back-port projenrc changes from main',
            env: { CI: 'false' },
            run: 'git fetch origin main && git checkout FETCH_HEAD -- .projenrc.ts projenrc README.md && yarn projen',
          }),
        );
      }
    }

    // Upgrade jsii & typescript as patch only
    new javascript.UpgradeDependencies(project, {
      taskName: 'upgrade-jsii',
      include: ['jsii', 'typescript'],
      target: 'patch',
      pullRequestTitle: 'upgrade jsii & typescript',
      workflowOptions: {
        branches,
        labels: ['auto-approve'],
      },
    });    
  }
}
