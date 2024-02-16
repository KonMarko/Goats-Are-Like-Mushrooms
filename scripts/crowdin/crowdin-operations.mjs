import { execSync } from 'child_process';
import {
  convertCrowdinBranch,
  crowdinCommand,
  getBranches,
  setupCrowdinAuth,
} from './_crowdin-common.mjs';

// This script is run from a GitHub action, although you can also run it
// locally if you have the credentials and script set up.

// In most cases the option `--no-progress` is used, because when displaying
// the progress the CI output doesn't look good

const baseCrowdinBranch = process.env.CROWDIN_BRANCH;
const crowdinOperation = process.env.CROWDIN_OPERATION;

const forbiddenBranches = ['master', 'production'];

// These characters are not allowed in crowdin in the branch name
const crowdinBranch = convertCrowdinBranch(baseCrowdinBranch);

const uploadSources = () => {
  const branches = getBranches();

  if (!branches.includes(crowdinBranch)) {
    console.log('Creating the crowdin branch: ' + crowdinBranch);
    execSync(`${crowdinCommand} branch add "${crowdinBranch}"`, { stdio: 'inherit' });
  }

  execSync(
    [
      `${crowdinCommand} push`,
      `-b "${crowdinBranch}"`,
    ].join(' '),
    { stdio: 'inherit' },
  );

};

const deleteBranch = () => {
  const branches = getBranches();

  if (!branches.includes(crowdinBranch)) {
    throw new Error('The branch does not exist in Crowdin: ' + crowdinBranch);
  }

  execSync(`${crowdinCommand} branch delete "${crowdinBranch}" --no-progress`, {
    stdio: 'inherit',
  });
};

const downloadTranslations = () => {
  const branches = getBranches();

  if (!branches.includes(crowdinBranch)) {
    throw new Error('The branch does not exist in Crowdin: ' + crowdinBranch);
  }

  execSync(
    [
      `${crowdinCommand} download`,
      `-b "${crowdinBranch}"`,
    ].join(' '),
    { stdio: 'inherit' },
  );


  execSync('git config --local user.email "actions@github.com"', { stdio: 'inherit' });
  execSync('git config --local user.name "Github Actions"', { stdio: 'inherit' });

  execSync('git add -A .', { stdio: 'inherit' });
  execSync('git commit -m "Add Crowdin translations"', { stdio: 'inherit' });
  execSync(`git push origin "${baseCrowdinBranch}"`, { stdio: 'inherit' });
};

const main = () => {
  if (forbiddenBranches.includes(crowdinBranch) || !crowdinBranch.trim()) {
    console.log('Branch is not allowed: ' + crowdinBranch);
    process.exit(1);
  }

  setupCrowdinAuth();

  switch (crowdinOperation) {
    case 'Upload source texts': {
      uploadSources();
      break;
    }
    case 'Delete Crowdin branch': {
      deleteBranch();
      break;
    }
    case 'Pull and commit translations': {
      downloadTranslations();
      break;
    }
    default: {
      throw new Error('Unexpected operation: ' + crowdinOperation);
    }
  }

  console.log('The script finished successfully');
};

try {
  main();
} catch (error) {
  console.log(error);
  process.exit(1);
}
