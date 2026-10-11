import * as path from 'node:path';

/**
 * The version of the language-plugin API implemented by this jsii-rosetta.
 *
 * The API is everything exported from `jsii-rosetta/lib/plugin-api` and
 * `jsii-rosetta/lib/testing/translations-corpus`. A plugin passes the version
 * it was written against to `registerTargetLanguage`, and is accepted only
 * when it is compatible:
 *
 * - while the major version is 0 (experimental), the major and minor versions
 *   must both match, since any minor version may break plugins;
 * - from 1.0, the major versions must match and the plugin's minor version
 *   must not be newer than this one.
 */
export const PLUGIN_API_VERSION = '0.1.0';

/**
 * Whether a plugin written against `version` can be used by this jsii-rosetta.
 */
export function isCompatiblePluginApi(version: string, implemented: string = PLUGIN_API_VERSION): boolean {
  const parse = (v: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined;
  };
  const plugin = parse(version);
  const ours = parse(implemented);
  if (!plugin || !ours || plugin.major !== ours.major) {
    return false;
  }
  return ours.major === 0 ? plugin.minor === ours.minor : plugin.minor <= ours.minor;
}

/**
 * Resolves language-plugin module specifiers to absolute paths, the way the
 * caller would `require` them: relative paths against the working directory,
 * package names from the working directory's `node_modules`.
 *
 * Translation workers load plugins themselves, and a worker would otherwise
 * resolve a specifier from jsii-rosetta's own location instead.
 */
export function resolvePluginModules(specs: readonly string[] = [], fromDir: string = process.cwd()): string[] {
  return specs.map((spec) =>
    spec.startsWith('.') || path.isAbsolute(spec)
      ? require.resolve(path.resolve(fromDir, spec))
      : require.resolve(spec, { paths: [fromDir] }),
  );
}

/**
 * Loads language plugins in this process, and returns their resolved paths
 * for passing on to translation workers.
 *
 * A plugin registers its language when it is loaded, and the language has to
 * be registered both here, where cached translations are checked against the
 * registered languages, and in every worker, where translation happens. One
 * list of modules covers both.
 */
export function loadLanguagePlugins(specs: readonly string[] = [], fromDir: string = process.cwd()): string[] {
  const resolved = resolvePluginModules(specs, fromDir);
  for (const modulePath of resolved) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(modulePath);
  }
  return resolved;
}
