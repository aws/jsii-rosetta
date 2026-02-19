import * as cp from 'node:child_process';
import { promises as fsPromises } from 'node:fs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PackageJson } from '@jsii/spec';
import * as fastGlob from 'fast-glob';
import * as semver from 'semver';

import { findDependencyDirectory, findUp, isBuiltinModule } from './find-utils';
import * as logging from './logging';
import { TypeScriptSnippet, CompilationDependency, formatLocation } from './snippet';
import { mkDict, formatList, pathExists } from './util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { intersect } = require('semver-intersect');

/**
 * Collect the dependencies of a bunch of snippets together in one declaration
 *
 * We assume here the dependencies will not conflict.
 */
export function collectDependencies(snippets: TypeScriptSnippet[]) {
  const prevSnippet: Record<string, TypeScriptSnippet> = {};
  const ret: Record<string, CompilationDependency> = {};
  for (const curSnippet of snippets) {
    for (const [name, source] of Object.entries(curSnippet.compilationDependencies ?? {})) {
      try {
        ret[name] = resolveConflict(name, source, ret[name]);
        prevSnippet[name] = curSnippet;
      } catch (e: any) {
        throw new Error(
          `Dependency conflict between snippets ${fmtSource(curSnippet)} and ${fmtSource(prevSnippet[name])}: ${
            e.message
          }`,
        );
      }
    }
  }
  return ret;
}

/**
 * Add transitive dependencies of concrete dependencies to the array
 *
 * This is necessary to prevent multiple copies of transitive dependencies on disk, which
 * jsii-based packages might not deal with very well.
 */
export async function expandWithTransitiveDependencies(deps: Record<string, CompilationDependency>) {
  const pathsSeen = new Set<string>();
  const queue = Object.values(deps).filter(isConcrete);

  let next = queue.shift();
  while (next) {
    await addDependenciesOf(next.resolvedDirectory);
    next = queue.shift();
  }

  async function addDependenciesOf(dir: string) {
    if (pathsSeen.has(dir)) {
      return;
    }
    pathsSeen.add(dir);
    try {
      const pj: PackageJson = JSON.parse(
        await fsPromises.readFile(path.join(dir, 'package.json'), { encoding: 'utf-8' }),
      );
      for (const [name, dep] of Object.entries(await resolveDependenciesFromPackageJson(pj, dir))) {
        if (!deps[name]) {
          deps[name] = dep;
          queue.push(dep);
        }
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return;
      }
      throw e;
    }
  }
}

/**
 * Find the corresponding package directories for all dependencies in a package.json
 */
export async function resolveDependenciesFromPackageJson(packageJson: PackageJson | undefined, directory: string) {
  return mkDict(
    await Promise.all(
      Object.keys({ ...packageJson?.dependencies, ...packageJson?.peerDependencies })
        .filter((name) => !isBuiltinModule(name))
        .filter(
          (name) =>
            !packageJson?.bundledDependencies?.includes(name) && !packageJson?.bundleDependencies?.includes(name),
        )
        .map(
          async (name) =>
            [
              name,
              {
                type: 'concrete',
                resolvedDirectory: await fsPromises.realpath(await findDependencyDirectory(name, directory)),
              },
            ] as const,
        ),
    ),
  );
}

function resolveConflict(
  name: string,
  a: CompilationDependency,
  b: CompilationDependency | undefined,
): CompilationDependency {
  if (!b) {
    return a;
  }

  if (a.type === 'concrete' && b.type === 'concrete') {
    if (b.resolvedDirectory !== a.resolvedDirectory) {
      // Different locations on disk, check the actual versions, we may have hoisting issues
      const aVersion = JSON.parse(fs.readFileSync(`${a.resolvedDirectory}/package.json`, 'utf-8')).version;
      const bVersion = JSON.parse(fs.readFileSync(`${b.resolvedDirectory}/package.json`, 'utf-8')).version;

      // Versions are the same, good enough
      if (aVersion === bVersion) {
        return a;
      }

      throw new Error(
        `${name} can be either ${a.resolvedDirectory} (v${aVersion})‚ or ${b.resolvedDirectory} (v${bVersion})`,
      );
    }
    return a;
  }

  if (a.type === 'symbolic' && b.type === 'symbolic') {
    // Intersect the ranges
    return {
      type: 'symbolic',
      versionRange: myVersionIntersect(a.versionRange, b.versionRange),
    };
  }

  if (a.type === 'concrete' && b.type === 'symbolic') {
    const concreteVersion: string = JSON.parse(
      fs.readFileSync(path.join(a.resolvedDirectory, 'package.json'), 'utf-8'),
    ).version;

    if (!semver.satisfies(concreteVersion, b.versionRange, { includePrerelease: true })) {
      throw new Error(
        `${name} expected to match ${b.versionRange} but found ${concreteVersion} at ${a.resolvedDirectory}`,
      );
    }

    return a;
  }

  if (a.type === 'symbolic' && b.type === 'concrete') {
    // Reverse roles so we fall into the previous case
    return resolveConflict(name, b, a);
  }

  throw new Error('Cases should have been exhaustive');
}

/**
 * Check that the directory we were given has all the necessary dependencies in it
 *
 * It's a warning if this is not true, not an error.
 */
export async function validateAvailableDependencies(directory: string, deps: Record<string, CompilationDependency>) {
  logging.info(`Validating dependencies at ${directory}`);
  const failures = await Promise.all(
    Object.entries(deps).flatMap(async ([name, _dep]) => {
      try {
        await findDependencyDirectory(name, directory);
        return [];
      } catch {
        return [name];
      }
    }),
  );

  if (failures.length > 0) {
    logging.warn(
      `${directory}: packages necessary to compile examples missing from supplied directory: ${failures.join(', ')}`,
    );
  }
}

/**
 * Intersect two semver ranges
 *
 * The package we are using for this doesn't support all syntaxes yet.
 * Do some work on top.
 */
function myVersionIntersect(a: string, b: string): string {
  if (a === '*') {
    return b;
  }
  if (b === '*') {
    return a;
  }

  try {
    return intersect(a, b);
  } catch (e: any) {
    throw new Error(`semver-intersect does not support either '${a}' or '${b}': ${e.message}`);
  }
}

/**
 * Prepare a temporary directory with symlinks to all the dependencies we need.
 *
 * - Symlinks the concrete dependencies
 * - Tries to first find the symbolic dependencies in a potential monorepo that might be present
 *   (try both `lerna` and `yarn` monorepos).
 * - Installs the remaining symbolic dependencies using 'npm'.
 */
export async function prepareDependencyDirectory(deps: Record<string, CompilationDependency>): Promise<string> {
  const concreteDirs = Object.values(deps)
    .filter(isConcrete)
    .map((x) => x.resolvedDirectory);
  const monorepoPackages = await scanMonoRepos(concreteDirs);

  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'rosetta'));
  logging.info(`Preparing dependency closure at ${tmpDir} (-vv for more details)`);

  // Resolved symbolic packages against monorepo
  const resolvedDeps = mkDict(
    Object.entries(deps).map(([name, dep]) => [
      name,
      dep.type === 'concrete'
        ? dep
        : ((monorepoPackages[name]
            ? { type: 'concrete', resolvedDirectory: monorepoPackages[name] }
            : dep) as CompilationDependency),
    ]),
  );

  const dependencies: Record<string, string> = {};
  for (const [name, dep] of Object.entries(resolvedDeps)) {
    if (isConcrete(dep)) {
      logging.debug(`${name} -> ${dep.resolvedDirectory}`);
      dependencies[name] = `file:${dep.resolvedDirectory}`;
    } else {
      logging.debug(`${name} @ ${dep.versionRange}`);
      dependencies[name] = dep.versionRange;
    }
  }

  await fsPromises.writeFile(
    path.join(tmpDir, 'package.json'),
    JSON.stringify(
      {
        name: 'examples',
        version: '0.0.1',
        private: true,
        dependencies,
      },
      undefined,
      2,
    ),
    {
      encoding: 'utf-8',
    },
  );

  // Run NPM install on this package.json.
  cp.execSync(
    [
      'npm install',
      // We need to include --force for packages
      // that have a symbolic version in the symlinked dev tree (like "0.0.0"), but have
      // actual version range dependencies from externally installed packages (like "^2.0.0").
      '--force',
      // this is critical from a security perspective to prevent
      // code execution as part of the install command using npm hooks. (e.g postInstall)
      '--ignore-scripts',
      // save time by not running audit
      '--no-audit',
      // ensures npm does not insert anything in $PATH
      '--no-bin-links',
      // don't write or update a package-lock.json file
      '--no-package-lock',
      // only print errors
      `--loglevel error`,
    ].join(' '),
    {
      cwd: tmpDir,
      encoding: 'utf-8',
    },
  );

  return tmpDir;
}

/**
 * Map package name to directory
 */
async function scanMonoRepos(startingDirs: readonly string[]): Promise<Record<string, string>> {
  const globs = new Set<string>();
  for (const dir of startingDirs) {
    // eslint-disable-next-line no-await-in-loop
    setExtend(globs, await findMonoRepoGlobs(dir));
  }

  if (globs.size === 0) {
    return {};
  }

  logging.debug(`Monorepo package sources: ${Array.from(globs).join(', ')}`);

  const packageDirectories = await fastGlob(Array.from(globs).map(windowsToUnix), { onlyDirectories: true });
  const results = mkDict(
    (
      await Promise.all(
        packageDirectories.map(async (directory) => {
          const pjLocation = path.join(directory, 'package.json');
          return (await pathExists(pjLocation))
            ? [[JSON.parse(await fsPromises.readFile(pjLocation, 'utf-8')).name as string, directory] as const]
            : [];
        }),
      )
    ).flat(),
  );

  logging.debug(`Found ${Object.keys(results).length} packages in monorepo: ${formatList(Object.keys(results))}`);
  return results;
}

async function findMonoRepoGlobs(startingDir: string): Promise<Set<string>> {
  const ret = new Set<string>();

  // Lerna monorepo
  const lernaJsonDir = await findUp(startingDir, async (dir) => pathExists(path.join(dir, 'lerna.json')));
  if (lernaJsonDir) {
    const lernaJson = JSON.parse(await fsPromises.readFile(path.join(lernaJsonDir, 'lerna.json'), 'utf-8'));
    for (const glob of lernaJson?.packages ?? []) {
      ret.add(path.join(lernaJsonDir, glob));
    }
  }

  // Yarn monorepo
  const yarnWsDir = await findUp(
    startingDir,
    async (dir) =>
      (await pathExists(path.join(dir, 'package.json'))) &&
      JSON.parse(await fsPromises.readFile(path.join(dir, 'package.json'), 'utf-8'))?.workspaces !== undefined,
  );
  if (yarnWsDir) {
    const yarnWs = JSON.parse(await fsPromises.readFile(path.join(yarnWsDir, 'package.json'), 'utf-8'));
    for (const glob of yarnWs.workspaces?.packages ?? []) {
      ret.add(path.join(yarnWsDir, glob));
    }
  }

  return ret;
}

function isConcrete(x: CompilationDependency): x is Extract<CompilationDependency, { type: 'concrete' }> {
  return x.type === 'concrete';
}

function setExtend<A>(xs: Set<A>, ys: Set<A>) {
  for (const y of ys) {
    xs.add(y);
  }
  return xs;
}

/**
 * Necessary for fastGlob
 */
function windowsToUnix(x: string) {
  return x.replace(/\\/g, '/');
}

function fmtSource(loc?: TypeScriptSnippet) {
  return loc ? formatLocation(loc.location) : '** should never happen**';
}
