import { JsonFile, Project } from 'projen';

type ReleaseLine = `${number}.${number}`;
type VersionNumber = `${number}.${number}.${number}`;
interface ReleasesDocument {
  readonly current: ReleaseLine;
  readonly currentMinVersionNumber: VersionNumber;
  readonly maintenance: { readonly [release: ReleaseLine]: Date };
  readonly endOfSupport?: readonly ReleaseLine[];
}

export const SUPPORT_POLICY: ReleasesDocument = {
  current: '5.3',
  // Define a different patch version here if a specific feature or bug-fix
  currentMinVersionNumber: '5.3.0',
  maintenance: {
    // version: End-of-support date
    '5.0': new Date('2024-01-31'),
    '5.1': new Date('2024-04-30'),
    '5.2': new Date('2024-06-30'),
  },
};

if (!SUPPORT_POLICY.currentMinVersionNumber.startsWith(SUPPORT_POLICY.current)) {
  throw new Error('currentMinVersionNumber must be part of the current version line');
}

export class SupportPolicy {
  public get branches(): {
    [version: string]: string;
  } {
    const branches = {
      [SUPPORT_POLICY.current]: 'main',
    };

    for (const version of Object.keys(SUPPORT_POLICY.maintenance)) {
      branches[version] = `maintenance/v${version}`;
    }

    return branches;
  }

  public constructor(project: Project) {
    new JsonFile(project, 'releases.json', {
      allowComments: false,
      editGitignore: false,
      obj: SUPPORT_POLICY,
      readonly: true,
    });
  }
}
