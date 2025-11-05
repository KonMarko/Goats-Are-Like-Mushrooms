import {execSync} from 'child_process';

//envs
const AUTHOR_GH = process.env.AUTHOR_GH;
const BASE_BRANCH = process.env.BASE_BRANCH;
const BRANCH = process.env.BRANCH;
const CMS_API_TOKEN = process.env.CMS_API_TOKEN
const CMS_PATH = process.env.CMS_PATH
const CROWDOUT_OPERATION = process.env.CROWDOUT_OPERATION;
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE;
const REPO_FULL_NAME = process.env.REPO_FULL_NAME;
const SLACK_USER_MAP_JSON = process.env.SLACK_USER_MAP_JSON;

//constants
const CREATE_LINKS_FOR_LANGUAGES = ['de-DE', 'fr-FR'];
const CROWDOUT_API_PATH = CMS_PATH + '/api/crowdout/gh/'
const CROWDOUT_API_GET_APP_CONFIG_PATH = CROWDOUT_API_PATH + 'get-app-config';
const CROWDOUT_API_SAVE_FILE_PATH = CROWDOUT_API_PATH + 'save-file'
const CROWDOUT_TRANSLATIONS_PATH = CMS_PATH + '/admin/crowdout/translations'
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  api_token: CMS_API_TOKEN,
  'User-Agent': 'GitHubAction',
}
const FORBIDDEN_BRANCHES = ['staging', 'production'];

const readSlackMap = () => {
  try {
    const map = JSON.parse(SLACK_USER_MAP_JSON || '{}');
    if (map && typeof map === 'object') return map;
    return {};
  } catch {
    return {};
  }
};

const resolveSlackIdForGithubLogin = () => {
  if (!AUTHOR_GH) return null;
  const map = readSlackMap();
  if (map[AUTHOR_GH]) return map[AUTHOR_GH];
  // case-insensitive fallback
  const lower = AUTHOR_GH.toLowerCase();
  const hit = Object.entries(map).find(([k]) => k.toLowerCase() === lower);
  return hit ? hit[1] : null;
};

const appendPrLink = (message) => {
  if (PR_NUMBER && PR_TITLE && REPO_FULL_NAME) {
    const prLink = `https://github.com/${REPO_FULL_NAME}/pull/${PR_NUMBER}`;
    return `PR: ${message}\n\n<${prLink}|${PR_TITLE}>`;
  }
  return message;
};

const appendCcForAuthor = (message) => {
  const slackId = resolveSlackIdForGithubLogin();
  if (slackId) return `${message}\n\ncc: <@${slackId}>`;
  // fallback (won’t notify in Slack, but still shows who)
  if (AUTHOR_GH) return `${message}\n\ncc: @${AUTHOR_GH}`;
  return message;
};

const saveFile = async (fileData) => {
  const response = await fetch(CROWDOUT_API_SAVE_FILE_PATH, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(fileData)
  });
}

const getChangedJsonFiles = () => {
  // Ensure the remote branches are fetched
  execSync('git fetch --all');
  const diffOutput = execSync(`git diff --name-only origin/${BASE_BRANCH}...origin/${BRANCH}`).toString();

  return diffOutput
    .split('\n')
    .filter(file => file.endsWith('.json'));
};

const extractAppIds = (files) => {
  const appIds = new Set();
  files.forEach(file => {
    const appIdMatch = file.match(/packages\/([^\/]+)/);
    if (appIdMatch) {
      appIds.add(appIdMatch[1]);
    }
  });
  return appIds;
};

const fetchAppConfig = async (appId) => {
  const response = await fetch(CROWDOUT_API_GET_APP_CONFIG_PATH, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({ appId })
  });

  if (!response.ok) {
    console.log(`Error for appId ${appId}: ${response.status} - ${response.message}`);
    return null;
  }

  return await response.json();
};

const processChangedFiles = (allChangedJsonFiles, appId, appConfig) => {
  const results = [];
  const {translationsPath, sourceLanguage} = appConfig;
  const projectPath = `packages/${appId}/${translationsPath}/${sourceLanguage}/`;

  const changedFiles = allChangedJsonFiles.filter(file => file.includes(projectPath));

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

  return results;
};

const saveSourceAndGenerateTranslationLinks = (results) => {
  const links = CREATE_LINKS_FOR_LANGUAGES.reduce((acc, lang) => {
    acc[lang] = [];
    return acc;
  }, {});

  for (const fileData of results) {
    // await saveFile(fileData); //uncomment after testing the messaging part
    for (const lang of CREATE_LINKS_FOR_LANGUAGES) {
      const crowdoutLink = `${CROWDOUT_TRANSLATIONS_PATH}/${encodeURIComponent(BRANCH)}/${fileData.appConfig.id}/${lang}/${fileData.namespace}?diff=true`;
      links[lang].push({link: crowdoutLink, namespace: fileData.namespace, language: lang, appId: fileData.appConfig.id});
    }
  }

  return links;
};

const createTranslationMessage = (links) => {
  const messageBase= `Hello :wave:, can I have translations for these please?
${Object.entries(links).map(([lang, urls]) => {
  const emoji = `:${lang.split('-')[0]}:`;
  return `\n${emoji}:\n${urls.map(url => {
    const {link, namespace, language, appId} = url
    return `• <${link}| ${appId} | ${namespace} | ${language}>`;
  }).join('\n')}`;
}).join('\n')}`;
  const messageWithPrLink = appendPrLink(messageBase);
  return appendCcForAuthor(messageWithPrLink);
};

const setActionOutput = async (message) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const fs = await import('fs');
    const delim = 'GH_DELIM_' + Math.random().toString(36).slice(2);
    fs.appendFileSync(outputPath, `translation_message<<${delim}\n${message}\n${delim}\n`, 'utf8');
  }
};

const triggerFallbacksAndSlackMessage = async () => {
  const allChangedJsonFiles = getChangedJsonFiles();

  const appIds = extractAppIds(allChangedJsonFiles);

  if (appIds.size === 0) {
    console.log('No appIds found');
    return;
  }

  const results = [];

  for (const appId of appIds) {
    try {
      const appConfig = await fetchAppConfig(appId);
      if (!appConfig) continue;

      const fileResults = processChangedFiles(allChangedJsonFiles, appId, appConfig);
      results.push(...fileResults);
    } catch (error) {
      console.log(`Error processing appId ${appId}:`, error);
    }
  }

  const links = saveSourceAndGenerateTranslationLinks(results);
  const message = createTranslationMessage(links);
  await setActionOutput(message);

  return message;
};



const main = async () => {
  if (FORBIDDEN_BRANCHES.includes(BRANCH) || !BRANCH.trim()) {
    process.exit(1);
  }

  switch (CROWDOUT_OPERATION) {
    case 'Trigger fallbacks': {
      await triggerFallbacksAndSlackMessage();
      break;
    }
    default: {
      throw new Error('Unexpected operation: ' + CROWDOUT_OPERATION);
    }
  }
};

try {
  await main();
} catch (error) {
  console.log(error);
  process.exit(1);
}
