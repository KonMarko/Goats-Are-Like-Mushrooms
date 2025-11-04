import {execSync} from 'child_process';


const CMS_API_TOKEN = process.env.CMS_API_TOKEN
const BRANCH = process.env.BRANCH;
const BASE_BRANCH = process.env.BASE_BRANCH;
const CROWDOUT_OPERATION = process.env.CROWDOUT_OPERATION;
const CMS_PATH = process.env.CMS_PATH
const FORBIDDEN_BRANCHES = ['staging', 'production'];
const CROWDOUT_API_PATH = CMS_PATH + '/api/crowdout/gh/'
const CROWDOUT_API_GET_APP_CONFIG_PATH = CROWDOUT_API_PATH + 'get-app-config';
const CROWDOUT_API_SAVE_FILE_PATH = CROWDOUT_API_PATH + 'save-file'
const CREATE_LINKS_FOR_LANGUAGES = ['de-DE', 'fr-FR'];
const AUTHOR_GH = process.env.AUTHOR_GH || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const getGithubPublicEmail = async () => {
  if (!AUTHOR_GH) return '';
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
      headers: {
        'User-Agent': 'GitHubAction',
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
      }
    });
    if (!res.ok) return '';
    const data = await res.json();
    // GitHub only returns this if the user made their email public.
    return (data && data.email) ? data.email : '';
  } catch {
    return '';
  }
};

const findSlackIdByEmail = async (email) => {
  if (!email || !SLACK_BOT_TOKEN) return null;
  try {
    const body = new URLSearchParams({ email });
    const res = await fetch('https://slack.com/api/users.lookupByEmail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const json = await res.json();
    if (json && json.ok && json.user && json.user.id) return json.user.id;
    return null;
  } catch {
    return null;
  }
};

const saveFile = async (fileData) => {
  console.log('=> Saving file:', fileData.path);

  const response = await fetch(CROWDOUT_API_SAVE_FILE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_token: CMS_API_TOKEN,
      'User-Agent': 'GitHubAction',
    },
    body: JSON.stringify(fileData)
  });

  console.log('=> Saving file response:', response);
}

const triggerFallbacks = async () => {
  console.log('=> triggerFallbacks')
  console.log('=> branch', BRANCH)
  console.log('=> baseBranch', BASE_BRANCH)
  console.log('=> cmsPath', CMS_PATH)

  const diffOutput = execSync(`git diff --name-only ${BASE_BRANCH}...${BRANCH}`).toString();

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
          api_token: CMS_API_TOKEN,
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
        const content = execSync(`git show ${BRANCH}:${file}`).toString();

        results.push({
          path,
          namespace,
          commitMessage,
          content,
          appConfig,
          branch: BRANCH,
          language: sourceLanguage,
        });
      }
    } catch (error) {
      console.log(`=> Error processing appId ${appId}:`, error);
    }
  }

  console.log('=> results', results);
  const links = CREATE_LINKS_FOR_LANGUAGES.reduce((acc, lang) => {
    acc[lang] = []
    return acc
  },{})
  for (const fileData of results) {
    // await saveFile(fileData);
    console.log(fileData)
    for(const lang of CREATE_LINKS_FOR_LANGUAGES) {
    const crowdoutLink = `${CMS_PATH}/admin/crowdout/translations/${encodeURIComponent(BRANCH)}/${fileData.appConfig.id}/${lang}/${fileData.namespace}?diff=true`
    links[lang].push(crowdoutLink)
    }
  }

  console.log('=> links', links)

  let message = `Hello :wave:, can I have translations for these please?
    ${Object.entries(links).map(([lang, urls]) => {
      const emoji = `:${lang.split('-')[0]}:`;
      return urls.map(url => `${emoji} ${url}`).join('\n');
    }).join('\n')}`;

  let email = await getGithubPublicEmail();
  const slackUserId = await findSlackIdByEmail(email);

  if(slackUserId) {
    message = `${message}\n\ncc: <@${slackUserId}>`;
  }

  console.log('=> message', message);

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const fs = await import('fs');
    const delim = 'GH_DELIM_' + Math.random().toString(36).slice(2);
    fs.appendFileSync(outputPath, `translation_message<<${delim}\n${message}\n${delim}\n`, 'utf8');
  }
  return message;
};



const main = async () => {
  if (FORBIDDEN_BRANCHES.includes(BRANCH) || !BRANCH.trim()) {
    console.log('Branch is not allowed: ' + BRANCH);
    process.exit(1);
  }

  switch (CROWDOUT_OPERATION) {
    case 'Trigger fallbacks': {
      await triggerFallbacks();
      break;
    }
    default: {
      throw new Error('Unexpected operation: ' + CROWDOUT_OPERATION);
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
