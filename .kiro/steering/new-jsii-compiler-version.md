# New jsii-rosetta Version Release Process

This document outlines the step-by-step process for releasing a new version of jsii-rosetta when a new TypeScript/jsii-compiler version is available.

## Prerequisites

- New jsii-compiler version has been released
- Access to the jsii-rosetta repository with push permissions
- GitHub CLI (`gh`) installed and configured

## Process Overview

The release process involves creating a maintenance branch for the current version, updating support policies, and preparing for the new TypeScript version support.

## Step-by-Step Instructions

### 1. Verify jsii-compiler Release

- [ ] Confirm the new jsii-compiler version has been released
- [ ] Note the TypeScript version that will be supported

### 2. Create Maintenance Branch

```bash
git switch main && git fetch --all && git pull
git push origin main:maintenance/vX.Y
```

Where X.Y is the TypeScript version that is about to be replaced.

### 3. Update Branch Protection Rules

- [ ] Add the newly created maintenance branch as a target to the "current" ruleset in GitHub

### 4. Create Feature Branch

```bash
git switch --create feat/tsX.Y
```

Where X.Y is the new TypeScript version.

### 5. Update Support Policy

Edit `projenrc/support.ts`:

- [ ] Set maintenance EOL date for current version (6 months from today, rounded to mid-point (15th) or end of month (last day), whichever is closer)
- [ ] Make the new version current
- [ ] Update `currentMinVersionNumber`

### 6. Update Node.js Version Support

- [ ] Update `minNodeVersion` to the oldest LTS version of Node (dropping EOL versions)
- [ ] **Important**: Also update `projenrc/build-workflow.ts` to filter the Node.js matrix based on the new minimum version

### 7. Update Documentation

- [ ] Update the version list in README.md
- [ ] Remove any EOS (End of Support) versions from the README

### 8. Update Branch Protection (if needed)

If any versions dropped into EOS:

- [ ] Add respective branches as targets to the "end-of-support" ruleset
- [ ] Remove them from the "current" ruleset

### 9. Generate and Build

```bash
npx projen
npx projen build
```

- [ ] Fix any issues that come up during the build
- [ ] **Important**: Verify that the build matrix in `.github/workflows/build.yml` only includes supported Node.js versions

### 10. Create Pull Request

```bash
gh pr create --title "feat: TypeScript X.Y" --body "Add support for TypeScript X.Y

See: https://devblogs.microsoft.com/typescript/announcing-typescript-X-Y/

---

By submitting this pull request, I confirm that my contribution is made under the terms of the [Apache 2.0 license].

[Apache 2.0 license]: https://www.apache.org/licenses/LICENSE-2.0"
```

- [ ] Follow conventional commit format for PR title
- [ ] Include link to TypeScript release announcement
- [ ] Include Apache 2.0 license footer from PR template

### 11. Manual Release Trigger

After PR is merged:

- [ ] Manually trigger release workflow: <https://github.com/aws/jsii-rosetta/actions/workflows/auto-tag-releases.yml>
- [ ] Note: Merging the PR doesn't automatically trigger a release

### 12. Update jsii-pacmak

- [ ] Add support for the new rosetta version line to `jsii-pacmak`
- [ ] See: <https://github.com/aws/jsii/blob/main/CONTRIBUTING.md#support-for-new-jsii-rosetta-versions>

### 13. Update jsii-docgen

- [ ] Add support for the new rosetta version line in `jsii-docgen`
- [ ] Look at RosettaPeerDependency in projenrc.ts

### 14. Update projen

Once jsii-docgen is released:

- [ ] Add support for the new jsii version line to projen
- [ ] Example: <https://github.com/projen/projen/pull/3805>

## Important Notes

### EOL Date Calculation

When setting the maintenance EOL date, calculate 6 months from the release date and round to the closest mid-point (15th) or end of month:

- If the 6-month date is closer to the 15th, use the 15th
- If the 6-month date is closer to the end of month, use the last day of the month

### Node.js Version Matrix

When updating `minNodeVersion`, you must also update the build workflow to prevent testing on unsupported Node.js versions:

1. Edit `projenrc/build-workflow.ts` to filter the matrix based on `minNodeVersion`
2. Run `npx projen` to regenerate the workflow files
3. Verify that `.github/workflows/build.yml` only includes supported versions

### Commit Messages

- Use conventional commit format: `feat: TypeScript X.Y`
- Include link to TypeScript release announcement
- Keep commit messages concise

## Notes for AI Agents

- Always use conventional commit format for branch names and PR titles
- For personal forks, prefix branch names with username: `username/feat/tsX.Y`
- Check for pull request templates in `.github/pull_request_template.md`
- Use `gh pr create` for creating pull requests
- The process involves multiple repositories (jsii-rosetta, jsii, jsii-docgen, projen)
- Manual release triggering is required - automatic releases don't happen on PR merge
- Pay special attention to Node.js version matrix updates when changing `minNodeVersion`

## Current Status Template

Use this checklist to track progress for any release:

- [ ] Step 1: Verify jsii-compiler release
- [ ] Step 2: Create maintenance branch
- [ ] Step 3: Update branch protection rules
- [ ] Step 4: Create feature branch
- [ ] Step 5: Update support policy
- [ ] Step 6: Update Node.js version support
- [ ] Step 7: Update documentation
- [ ] Step 8: Update branch protection (if needed)
- [ ] Step 9: Generate and build
- [ ] Step 10: Create pull request
- [ ] Step 11: Manual release trigger
- [ ] Step 12: Update jsii-pacmak
- [ ] Step 13: Update jsii-docgen
- [ ] Step 14: Update projen
