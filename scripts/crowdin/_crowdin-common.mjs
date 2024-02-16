import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiToken = process.env.CROWDIN_API_TOKEN;
const projectId = process.env.CROWDIN_PROJECT_ID;
export const crowdinCommand = __dirname + '/node_modules/.bin/crowdin';

export const getBranches = () => {
  console.log('Getting the branches');
  const branchesOutput = execSync(`${crowdinCommand} list branches --no-progress`).toString();
  console.log(branchesOutput);

  return branchesOutput
    .split('\n')
    .map((line) => /Branch '(.*)'/.exec(line)?.[1])
    .filter(Boolean);
};

// These characters are not allowed in crowdin in the branch name
export const convertCrowdinBranch = (branchName) => (branchName || '').replace(/[/:*?<>|]/g, '_');

export const setupCrowdinAuth = () => {
  const crowdinCredsPath = os.homedir() + '/.crowdin.yml';

  if (!fs.existsSync(crowdinCredsPath)) {
    const ymlContent = [`project_id: '${projectId}'`, `api_token: '${apiToken}'`].join('\n');

    fs.writeFileSync(crowdinCredsPath, ymlContent);
  }
};
