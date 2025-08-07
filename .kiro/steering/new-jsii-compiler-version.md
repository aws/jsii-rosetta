# New jsii-rosetta Version Release Process

This document outlines the complete process for adding support for a new TypeScript/jsii-compiler version in the jsii-rosetta project. This process should be followed whenever a new jsii-compiler version is released that corresponds to a new TypeScript version.

## Overview

The jsii-rosetta project maintains support for multiple TypeScript versions simultaneously, with a current version and several maintenance versions. When a new TypeScript/jsii-compiler version is released, the current version becomes a maintenance version, and the new version becomes current.

## Prerequisites

- New jsii-compiler version has been released
- Access to the AWS jsii-rosetta repository with push permissions
- GitHub CLI (`gh`) installed and authenticated
- Node.js and Yarn installed locally

## Step-by-Step Process

The complete process is documented in this steering document. This document is the source of truth.
Follow the following steps in order.

For any manual steps, give the user clear instructions on how to complete these steps.
Ask the user to complete the steps before continuing.
**Only continue once the user has confirmed instructions were successfully executed.**

### 1. Verify jsii-compiler Release

Confirm that the new jsii-compiler version has been released and note the corresponding TypeScript version.

```bash
npm view jsii versions --json | tail -10
npm view typescript versions --json | tail -10
```

### 2. Fork Current Main to Maintenance Branch

```bash
git switch main && git fetch --all && git pull
git push origin main:maintenance/vX.Y
```

Where `X.Y` is the TypeScript version that is about to be replaced by the new release.

### 3. Create Feature Branch

```bash
git switch --create feat/tsX.Y
```

Where `X.Y` is the new TypeScript version.

### 4. Update Support Policy

Edit `projenrc/support.ts`:

- Change `current` to the new TypeScript version (e.g., `'5.9'`)
- Update `currentMinVersionNumber` to match the new version
- Add the previous current version to the `maintenance` object
- Set the EOS (End of Support) date to **6 months from today**, rounded to the mid-point (15th) or end of month, whichever is closer

**Date Calculation Example:**

- If today is August 6, 2025
- 6 months later = February 6, 2026
- Round to closest: February 15, 2026 (midpoint is closer than February 28)

### 5. Update Minimum Node.js Version

In `.projenrc.ts`, update `minNodeVersion` following the AWS CDK extended support policy. The CDK supports Node.js versions for 6 months beyond their official End-of-Life (EOL) dates.

Check the current CDK Node.js support timeline: https://docs.aws.amazon.com/cdk/v2/guide/node-versions.html#node-version-timeline

Update `minNodeVersion` to the oldest Node.js version that is still supported by CDK (including the 6-month extension period), not just the official Node.js LTS versions.

Check current Node.js LTS versions for reference:

```bash
curl -s https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | jq -r 'to_entries[] | select(.value.lts != null) | "\(.key): LTS \(.value.lts) - End: \(.value.end)"'
```

### 6. Update Build Workflow Node.js Matrix

Edit `projenrc/build-workflow.ts` to ensure the Node.js version matrix respects the new `minNodeVersion`:

```typescript
// Filter out versions below the project's minimum Node.js version
const minMajorVersion = parseInt(project.minNodeVersion?.split('.')[0] ?? '18', 10);
if (release.majorVersion < minMajorVersion) {
  return [];
}
```

### 7. Update README Version Table

In `README.md`, update the version table:

- Add new version as "Current" with "TBD" EOS date
- Move previous current version to "Maintenance" with calculated EOS date
- **Remove any versions that have reached EOS** (past their EOS date)

### 8. Update GitHub Branch Protection Rules (Manual)

**Add to "current" ruleset:**

- `maintenance/vX.Y` (the new maintenance branch)

**Remove from "current" ruleset and add to "end-of-support" ruleset:**

- Any branches for versions that have reached EOS

### 9. Run Projen

```bash
npx projen
```

This regenerates all project files based on the updated configuration.

### 10. Build and Test

```bash
npx projen build
```

Resolve any TypeScript compilation errors that might be introduced by the new TypeScript version. Common issues include:

- **Stricter type checking**: New TypeScript versions often have stricter type checking
- **Deprecated APIs**: Some TypeScript APIs may be deprecated or removed
- **New compiler options**: May need to update tsconfig settings

**Verify the build matrix**: Check that `.github/workflows/build.yml` only includes supported Node.js versions.

### 11. Create Pull Request

Commit changes with conventional commit message:

```bash
git add .
git commit -m "feat: TypeScript X.Y

See: https://devblogs.microsoft.com/typescript/announcing-typescript-X-Y/"
```

Push and create PR:

```bash
git push -u origin feat/tsX.Y
gh pr create --title "feat: TypeScript X.Y" --body "Add support for TypeScript X.Y

See: https://devblogs.microsoft.com/typescript/announcing-typescript-X-Y/

---

By submitting this pull request, I confirm that my contribution is made under the terms of the [Apache 2.0 license].

[Apache 2.0 license]: https://www.apache.org/licenses/LICENSE-2.0"
```

### 12. Manual Release (Post-Merge) (Manual)

**Important:** Merging the PR does not trigger an automatic release. Releases are performed on a weekly schedule, but you can manually trigger a release:

1. Go to <https://github.com/aws/jsii-rosetta/actions/workflows/auto-tag-releases.yml>
2. Click "Run workflow"
3. Select the main branch
4. Click "Run workflow"

### 13. Update jsii-pacmak (Manual)

Add support for the new rosetta version line to `jsii-pacmak`.
See: <https://github.com/aws/jsii/blob/main/CONTRIBUTING.md#support-for-new-jsii-rosetta-versions>

### 14. Update jsii-docgen (Manual)

Add support for the new rosetta version line in `jsii-docgen`.
Look at RosettaPeerDependency in projenrc.ts.

### 15. Update projen (Manual)

Once jsii-docgen is released, add support for the new jsii version line to projen.
Example: <https://github.com/projen/projen/pull/3805>

## File Locations and Key Changes

### Files to Modify

- `projenrc/support.ts` - Support policy and version configuration
- `.projenrc.ts` - Minimum Node.js version
- `README.md` - Version table
- `projenrc/build-workflow.ts` - Node.js version filtering

### Files Auto-Generated by Projen

- `.github/workflows/build.yml` - Test matrix with Node.js versions
- `.github/workflows/auto-tag-releases-vX.Y.yml` - Release workflow for maintenance branch
- `.github/workflows/auto-tag-dev-vX.Y.yml` - Dev release workflow for maintenance branch
- `.github/workflows/upgrade-maintenance-vX.Y.yml` - Dependency upgrade workflow
- `.github/workflows/upgrade-jsii-maintenance-vX.Y.yml` - jsii upgrade workflow
- `releases.json` - Support policy JSON file

## Common Issues and Solutions

### Node.js Version Matrix Not Updating

If the build workflow still includes old Node.js versions after updating `minNodeVersion`:

1. Check `projenrc/build-workflow.ts` has proper filtering logic
2. Ensure the minimum version calculation is correct
3. Run `npx projen` to regenerate workflows
4. Verify `.github/workflows/build.yml` matrix only includes supported versions

### EOS Date Calculation

Always calculate EOS dates as **6 months from the current date**, not from the release date:

- Use the actual date when performing the update
- Round to 15th (midpoint) or end of month, whichever is closer
- Example: August 6, 2025 + 6 months = February 6, 2026 → February 15, 2026 (closer to midpoint)

### TypeScript Compilation Errors

- Check for new TypeScript strict mode options
- Update type annotations as needed
- Review nullable/undefined handling
- Check for deprecated TypeScript APIs

## Validation Checklist

Before submitting the PR, verify:

- [ ] New TypeScript version is set as current in `projenrc/support.ts`
- [ ] `currentMinVersionNumber` updated to match new version
- [ ] Previous version moved to maintenance with correct EOS date
- [ ] `minNodeVersion` updated to latest LTS Node.js version
- [ ] `projenrc/build-workflow.ts` filters Node.js versions correctly
- [ ] README version table updated and EOS versions removed
- [ ] `npx projen` runs without errors
- [ ] `npx projen build` passes all tests
- [ ] Build workflow matrix excludes old Node.js versions
- [ ] PR follows conventional commit format
- [ ] PR includes link to TypeScript release blog post
- [ ] PR includes Apache 2.0 license footer

## Post-Release Tasks

After the PR is merged and release is triggered:

1. Monitor the release workflow for any issues
2. Update jsii-pacmak with new rosetta version support
3. Update jsii-docgen with new rosetta version support
4. Update projen once jsii-docgen is released
5. Communicate the new version availability to stakeholders

## Notes for AI Agents

- Always use conventional commit format for branch names and PR titles
- For personal forks, prefix branch names with username: `username/feat/tsX.Y`
- Check for pull request templates in `.github/pull_request_template.md`
- Use `gh pr create` for creating pull requests
- The process involves multiple repositories (jsii-rosetta, jsii, jsii-docgen, projen)
- Manual release triggering is required - automatic releases don't happen on PR merge
- Pay special attention to Node.js version matrix updates when changing `minNodeVersion`

## References

- [TypeScript Release Blog Posts](https://devblogs.microsoft.com/typescript/)
- [Node.js Release Schedule](https://nodejs.org/en/about/releases/)
- [jsii-rosetta Repository](https://github.com/aws/jsii-rosetta)
- [jsii-compiler Repository](https://github.com/aws/jsii-compiler)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Current Status Template

Use this checklist to track progress for any release:

- [ ] Step 1: Verify jsii-compiler release
- [ ] Step 2: Create maintenance branch
- [ ] Step 3: Create feature branch
- [ ] Step 4: Update support policy
- [ ] Step 5: Update Node.js version support
- [ ] Step 6: Update build workflow Node.js matrix
- [ ] Step 7: Update documentation
- [ ] Step 8: Update branch protection rules
- [ ] Step 9: Generate and build
- [ ] Step 10: Build and test
- [ ] Step 11: Create pull request
- [ ] Step 12: Manual release trigger
- [ ] Step 13: Update jsii-pacmak
- [ ] Step 14: Update jsii-docgen
- [ ] Step 15: Update projen
