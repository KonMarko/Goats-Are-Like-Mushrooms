import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PACKAGES = [
  { name: 'web', localesPath: path.resolve('packages/web/public/locales') },
  {
    name: 'cms-suppliers',
    localesPath: path.resolve('packages/cms-suppliers/public/static/locales'),
  },
];
const SOURCE_LOCALE = 'en-GB';
const IGNORE_LOCALES = ['ach-UG', 'ru-RU'];
const GITHUB_BASE_REF = process.env.GITHUB_BASE_REF || '';

/**
 * Translation validation only runs on PRs targeting master.
 */
const IS_PR_TO_MASTER = GITHUB_BASE_REF === 'master';

/**
 * Get all locale directories except the source locale and ignored locales.
 */
function getTargetLocales(localesPath) {
  return fs
      .readdirSync(localesPath)
      .filter((name) => {
        const fullPath = path.join(localesPath, name);
        return (
            fs.statSync(fullPath).isDirectory() &&
            name !== SOURCE_LOCALE &&
            !IGNORE_LOCALES.includes(name)
        );
      })
      .sort();
}

/**
 * Safely parse a JSON file, logging an error and returning null on failure.
 */
function safeParseJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`Failed to parse JSON file: ${filePath}\n${e.message}`);
    return null;
  }
}

/**
 * Ensure origin/master ref is available for git comparison.
 */
function ensureMasterAvailable() {
  try {
    execSync('git cat-file -e origin/master^{commit}', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync('git fetch origin master --depth=1', { stdio: 'inherit' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get JSON content of a file from origin/master.
 */
const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

function getMasterJson(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  try {
    const content = execFileSync('git', ['show', `origin/master:${relativePath}`], {
      encoding: 'utf-8',
    });
    return JSON.parse(content);
  } catch (e) {
    // git show exits with 128 when the path doesn't exist on the target ref
    if (e.status === 128) return null;
    throw e;
  }
}

/**
 * Get en-GB keys that were added or had their value modified compared to origin/master.
 * If the file is new (not on master), all keys are considered changed.
 */
function getChangedKeys(sourceFilePath) {
  if (!fs.existsSync(sourceFilePath)) return [];

  const currentJson = safeParseJsonFile(sourceFilePath);
  if (!currentJson) return [];
  const masterJson = getMasterJson(sourceFilePath);

  if (!masterJson) {
    return Object.keys(currentJson);
  }

  return Object.keys(currentJson).filter(
      (key) => !(key in masterJson) || masterJson[key] !== currentJson[key],
  );
}

if (!IS_PR_TO_MASTER) {
  console.log('Skipping - not a PR targeting master.');
  process.exit(0);
}

if (!ensureMasterAvailable()) {
  console.error('Could not access origin/master. Cannot compare changed en-GB keys.');
  process.exit(1);
}

let hasErrors = false;

for (const { name, localesPath } of PACKAGES) {
  const sourceLocalePath = path.join(localesPath, SOURCE_LOCALE);

  if (!fs.existsSync(sourceLocalePath)) {
    console.log(`[${name}] No source locale directory - skipping.`);
    continue;
  }

  const sourceFiles = fs.readdirSync(sourceLocalePath).filter((f) => f.endsWith('.json'));
  const targetLocales = getTargetLocales(localesPath);

  if (sourceFiles.length === 0 || targetLocales.length === 0) {
    console.log(`[${name}] No source files or target locales - skipping.`);
    continue;
  }

  console.log(
      `\n[${name}] Validating ${sourceFiles.length} file(s) against ${targetLocales.length} locale(s)`,
  );

  for (const filename of sourceFiles) {
    const sourceFilePath = path.join(sourceLocalePath, filename);
    const changedKeys = getChangedKeys(sourceFilePath);

    if (changedKeys.length === 0) continue;

    console.log(`  ${filename}: ${changedKeys.length} changed key(s)\n`);

    for (const targetLocale of targetLocales) {
      const targetFilePath = path.join(localesPath, targetLocale, filename);
      const targetFilePathStripped = targetFilePath.split('packages/')[1];

      if (!fs.existsSync(targetFilePath)) {
        hasErrors = true;
        console.error(`Missing translation file: packages/${targetFilePathStripped}`);
        continue;
      }

      const targetJson = safeParseJsonFile(targetFilePath);
      if (!targetJson) {
        hasErrors = true;
        console.error(`Failed to read translation file: packages/${targetFilePathStripped}`);
        continue;
      }

      const missingKeys = changedKeys.filter((key) => {
        const value = targetJson[key];
        return value === undefined || value === null || value === '';
      });

      if (missingKeys.length > 0) {
        hasErrors = true;
        console.error(
            `Missing or empty translations in packages/${targetFilePathStripped} for keys: \n- ${missingKeys.join(',\n- ')}\n`,
        );
      }
    }
  }
}

if (hasErrors) {
  console.error('\nTranslation validation failed - see errors above.');
  process.exit(1);
} else {
  console.log('\nAll changed en-GB keys have translations in every target locale.');
  process.exit(0);
}
