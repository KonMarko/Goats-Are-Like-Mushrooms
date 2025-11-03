import {convertCrowdinBranch, crowdinCommand, getBranches, setupCrowdinAuth,} from '../crowdin/_crowdin-common.mjs';
import { execSync } from 'child_process';
import fs from 'fs';


const cmsApiToken = process.env.CMS_API_TOKEN
const branch = process.env.BRANCH;
const baseBranch = process.env.BASE_BRANCH;
const crowdoutOperation = process.env.CROWDOUT_OPERATION;
const cmsPath = process.env.CMS_PATH
const crowdoutApiPath = cmsPath + '/api/crowdout/gh/'

const forbiddenBranches = ['staging', 'production'];

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
      const crowdoutApiGetAppConfigPath = crowdoutApiPath + 'get-app-config';
      const response = await fetch(crowdoutApiGetAppConfigPath, {
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

      const projectPath = `packages/${appId}/${appConfig.translationsPath}/${appConfig.sourceLanguage}/`;
      console.log(`=> projectPath for filtering ${appId}:`, projectPath);

      const changedFiles = allChangedJsonFiles
        .filter(file => file.includes(projectPath));

      console.log(`=> filtered changedFiles for ${appId}:`, changedFiles);

      for (const file of changedFiles) {
        const path = file.replace(/\.json$/, '');
        const namespace = file.split('/').pop().replace(/\.json$/, '');
        const commitMessage = `Update ${appConfig.sourceLanguage} translations for ${namespace}`;
        const content = execSync(`git show ${branch}:${file}`).toString();

        results.push({
          path,
          namespace,
          commitMessage,
          content,
          appConfig,
          appId
        });
      }
    } catch (error) {
      console.log(`=> Error processing appId ${appId}:`, error);
    }
  }

  console.log('=> results', results);
};

const saveFile = () => {
  const mockedData = {
    path: "packages/cms-suppliers/public/static/locales/en-GB/aboutYou",
    content: "{\n  \"addItemPlaceholder\": \"Chatty, Friendly, Adventurous\",\n  \"addTag\": \"Add - changed\",\n  \"addTagDescription\": \"Add between 1 and 3 tags\",\n  \"briefDescriptionLabel\": \"A brief description\",\n  \"cancel\": \"Cancel\",\n  \"changesSaved\": \"Changes saved\",\n  \"description\": \"Couples love to get to know you before getting in touch! We know how important a personality match is on both sides to make for the best partnership. That's why we've made space for you to be yourself and to give a face to your business.\",\n  \"descriptionPlaceholder\": \"Describe yourself, and let the couple get to know you. What would you like to know about the couple? They probably want to know the same about you.\",\n  \"introduction\": \"Hi, I'm {{name}} \",\n  \"introPlaceholder\": \"Share your favourite testimonial, quote or a sentence that best describes you.\",\n  \"nameLabel\": \"Name to display\",\n  \"namePlaceholder\": \"What should couples call you?\",\n  \"newKey\": \"New key\",\n  \"pageTitle\": \"About you\",\n  \"personalityTagPlaceholder\": \"Personality\",\n  \"photoUploadError\": \"Uploading photo failed\",\n  \"previewDescription\": \"This is a preview of what couples will see on your profile.\",\n  \"previewTitle\": \"Preview\",\n  \"quickIntroduction\": \"Grab their attention\",\n  \"removePhoto\": \"Remove photo\",\n  \"saveButton\": \"Save\",\n  \"setPhotoZoom\": \"Set photo zoom\",\n  \"tagPlaceholder\": \"Tags\",\n  \"tagsLabel\": \"Describe yourself in 3 words\",\n  \"unsavedChanges\": \"You have unsaved changes\",\n  \"upload\": \"Upload\",\n  \"uploadPhoto\": \"Upload photo\",\n  \"yourNamePlaceholderText\": \"[Your name]\",\n  \"yourPhoto\": \"Your photo\",\n  \"yourTagPlaceholder\": \"Your\",\n  \"aNewWithWrongOrder\": \"A new - with wrong order\"\n}\n",
    commitMessage: "Update en-GB translations for aboutYou",
    branch: "crowdout/fallback-test",
    appConfig: {
      id: "cms-suppliers",
      name: "cms-suppliers",
      translationsPath: "public/static/locales",
      sourceLanguage: "en-GB"
    },
    namespace: "aboutYou",
    language: "en-GB"
  }

  const crowdoutApiSaveFilePath = crowdoutApiPath + 'save-file'

  console.log('=> fetch crowdoutApiSaveFilePath', crowdoutApiSaveFilePath)
  // fetch('')

}

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
