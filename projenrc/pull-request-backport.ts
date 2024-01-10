import { IConstruct } from 'constructs';
import { Component, JsonFile, github, release } from 'projen';

export interface PullRequestBackportOptions {
  /**
   * The name of the workflow.
   *
   * @default "backport"
   */
  readonly workflowName?: string;

  /**
   * Should this created Backport PRs with conflicts.
   *
   * Conflicts will have to be resolved manually, but a PR is always created.
   * Set to `false` to prevent the backport PR from being created if there are conflicts.
   *
   * @default true
   */
  readonly createWithConflicts?: boolean;

  /**
   * The labels added to the created backport PR.
   *
   * @default ["backport"]
   */
  readonly backportPRLabels?: string[];

  /**
   * Should backport PRs be automatically approved.
   *
   * @default true
   */
  readonly autoApproveBackport?: boolean;

  /**
   * List of branches that can be a target for backports
   *
   * @default - enable backports to all release branches
   */
  readonly branches?: string[];

  /**
   * The prefix used to detect PRs that should be backported.
   */
  readonly labelPrefix?: string;
}

export class PullRequestBackport extends Component {
  public readonly file: JsonFile;
  public readonly workflow: github.GithubWorkflow;

  public constructor(scope: IConstruct, options: PullRequestBackportOptions = {}) {
    super(scope);

    const workflowEngine = github.GitHub.of(this.project);
    if (!workflowEngine) {
      throw new Error(
        `Cannot add ${new.target.name} to project with GitHub enabled. Please enable GitHub for this project.`,
      );
    }

    const branches = options.branches ?? release.Release.of(this.project)?.branches ?? [];
    if (branches.length === 0) {
      this.project.logger.warn(
        'PullRequestBackport could not find any target branches. Backports will not be available. Please add release branches or configure `branches` manually.',
      );
    }

    const shouldAutoApprove = options.autoApproveBackport ?? true;
    const targetPRLabels = options.backportPRLabels ?? ['backport'];
    if (shouldAutoApprove) {
      const autoApprove = this.project.components.find((c): c is github.AutoApprove => c instanceof github.AutoApprove);
      if (autoApprove?.label) {
        targetPRLabels.push(autoApprove.label);
      }
    }

    // Configuration
    this.file = new JsonFile(this, '.backportrc.json', {
      obj: {
        commitConflicts: options.createWithConflicts ?? true,
        targetPRLabels,
        backportBranchName: 'backport/{{targetBranch}}-{{refValues}}',
        prTitle: '{{sourcePullRequest.title}} (backport #{{sourcePullRequest.number}})',
        targetBranchChoices: branches,
      },
    });
    this.project.addPackageIgnore(this.file.path);

    // Workflow
    this.workflow = new github.GithubWorkflow(workflowEngine, options.workflowName ?? 'backport');
    this.workflow.on({
      pullRequestTarget: {
        types: ['labeled', 'closed'],
      },
    });

    this.workflow.addJob('backport', {
      name: 'Backport PR',
      runsOn: ['ubuntu-latest'],
      permissions: {},
      steps: [
        ...workflowEngine.projenCredentials.setupSteps,
        {
          name: 'Backport Action',
          uses: 'sqren/backport-github-action@v9.3.0',
          with: {
            github_token: workflowEngine.projenCredentials.tokenRef,
            auto_backport_label_prefix: options.labelPrefix ?? 'backport-to-',
          },
        },
      ],
    });
  }
}
