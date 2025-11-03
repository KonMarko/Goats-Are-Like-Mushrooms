import {execSync} from 'child_process';


const cmsApiToken = process.env.CMS_API_TOKEN
const branch = process.env.BRANCH;
const baseBranch = process.env.BASE_BRANCH;
const crowdoutOperation = process.env.CROWDOUT_OPERATION;
const cmsPath = process.env.CMS_PATH
const forbiddenBranches = ['staging', 'production'];
const CROWDOUT_API_PATH = cmsPath + '/api/crowdout/gh/'
const CROWDOUT_API_GET_APP_CONFIG_PATH = CROWDOUT_API_PATH + 'get-app-config';
const CROWDOUT_API_SAVE_FILE_PATH = CROWDOUT_API_PATH + 'save-file'

const saveFile = async (fileData) => {
  console.log('=> Saving file:', fileData.path);

  const response = await fetch(CROWDOUT_API_SAVE_FILE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_token: cmsApiToken,
      'User-Agent': 'GitHubAction',
    },
    body: JSON.stringify(fileData)
  });

  console.log('=> Saving file response:', response);
}

const triggerFallbacks = async () => {
  console.log('=> triggerFallbacks')
  console.log('=> branch', branch)
  console.log('=> baseBranch', baseBranch)
  console.log('=> cmsPath', cmsPath)

  const diffOutput = execSync(`git diff --name-only ${baseBranch}...${branch}`).toString();

  const allChangedJsonFiles = diffOutput
    .split('\n')
    .filter(file => file.endsWith('.json'));

  console.log('=> allChangedJsonFiles', allChangedJsonFiles);

  // Extract appIds from all files in the diff
  const appIds = new Set();
  allChangedJsonFiles.forEach(file => {
    const appIdMatch = file.match(/packages\/([^\/]+)/);
    if (appIdMatch) {
      appIds.add(appIdMatch[1]);
    }
  });

  console.log('=> extracted appIds:', appIds);

  if (appIds.size === 0) {
    console.log('=> no appIds found');
    return;
  }

  console.log('=> unique appIds found:', Array.from(appIds));

  const results = [];

  for (const appId of appIds) {
    console.log(`=> Processing appId: ${appId}`);

    try {
      const response = await fetch(CROWDOUT_API_GET_APP_CONFIG_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_token: cmsApiToken,
          'User-Agent': 'GitHubAction',
        },
        body: JSON.stringify({ appId })
      });

      // Check if the response is not ok (e.g., 400 status)
      if (!response.ok) {
        console.log(`=> Error for appId ${appId}: ${response.status} - ${response.message}`);
        continue; // Skip to the next appId
      }

      const appConfig = await response.json();
      console.log(`=> appConfig for ${appId}:`, appConfig);

      const {translationsPath, sourceLanguage} = appConfig;

      const projectPath = `packages/${appId}/${translationsPath}/${sourceLanguage}/`;
      console.log(`=> projectPath for filtering ${appId}:`, projectPath);

      const changedFiles = allChangedJsonFiles
        .filter(file => file.includes(projectPath));

      console.log(`=> filtered changedFiles for ${appId}:`, changedFiles);

      for (const file of changedFiles) {
        const path = file.replace(/\.json$/, '');
        const namespace = file.split('/').pop().replace(/\.json$/, '');
        const commitMessage = `Update ${sourceLanguage} translations for ${namespace}`;
        const content = execSync(`git show ${branch}:${file}`).toString();

        results.push({
          path,
          namespace,
          commitMessage,
          content,
          appConfig,
          branch,
          language: sourceLanguage,
        });
      }
    } catch (error) {
      console.log(`=> Error processing appId ${appId}:`, error);
    }
  }

  console.log('=> results', results);
  for (const fileData of results) {
    await saveFile(fileData);
  }
};



const main = async () => {
  if (forbiddenBranches.includes(branch) || !branch.trim()) {
    console.log('Branch is not allowed: ' + branch);
    process.exit(1);
  }

  switch (crowdoutOperation) {
    case 'Trigger fallbacks': {
      await triggerFallbacks();
      break;
    }
    default: {
      throw new Error('Unexpected operation: ' + crowdoutOperation);
    }
  }

  console.log('The script finished successfully');
};

try {
  await main();
} catch (error) {
  console.log(error);
  process.exit(1);
}
