import {
  getBranches,
  convertCrowdinBranch,
  setupCrowdinAuth,
  crowdinCommand,
} from './_crowdin-common.mjs';
import { execSync } from 'child_process';

const main = () => {
  setupCrowdinAuth();
  const crowdinBranches = getBranches();
  execSync(`git fetch --all`);
  const gitBranches = execSync('git branch -r')
    .toString()
    .split('\n')
    .map((b) => b.trim().replace('origin/', ''))
    .map(convertCrowdinBranch);
  const gitBranchesSet = new Set(gitBranches);

  const branchesToDelete = crowdinBranches.filter((b) => !gitBranchesSet.has(b));

  console.log('branchesToDelete', branchesToDelete);

  for (const branch of branchesToDelete) {
    console.log(`Deleting ${branch}`);

    // Branch should never be `master`, but filtering it just in case
    if (branch === 'master' || branch === 'l10n_master') continue;

    execSync(`${crowdinCommand} branch delete ${branch}`);
  }

  console.log('The script finished successfully');
};

try {
  main();
} catch (error) {
  console.log(error);
  process.exit(1);
}
