import { JsonFile, Project } from 'projen';
import type { ReleasesDocument } from '../src/support';

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
  public constructor(project: Project) {
    new JsonFile(project, 'releases.json', {
      allowComments: false,
      editGitignore: false,
      obj: SUPPORT_POLICY,
      readonly: true,
    });
  }
}
