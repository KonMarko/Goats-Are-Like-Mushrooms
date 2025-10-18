import {convertCrowdinBranch, crowdinCommand, getBranches, setupCrowdinAuth,} from '../crowdin/_crowdin-common.mjs';


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

  const language = "en-GB" //for now this stays as const

  const appId = 'cms-suppliers' //TODO: extract appId (package name) from changed en-GB json files for example: packages/web/public/locales/en-GB/acl.json -> web, packages/cms-suppliers/public/static/locales/en-GB/acl.json -> cms-suppliers

  const crowdoutApiGetAppConfigPath = crowdoutApiPath + 'get-app-config'
  const response = await fetch(crowdoutApiGetAppConfigPath, {
    method: 'POST',
    headers: {
      api_token: cmsApiToken,
      'User-Agent': 'GitHubAction',
    },
  });

  const appConfig = await response.json();

  console.log('=> appConfig', appConfig)

  const path = '' //TODO: extract file path from changed en-GB json files for example: packages/web/public/locales/en-GB/acl.json -> packages/web/public/locales/en-GB/acl, packages/cms-suppliers/public/static/locales/en-GB/acl.json -> packages/cms-suppliers/public/static/locales/en-GB/acl
  const namespace = '' //TODO: extract namespace from changed en-GB json files for example: packages/web/public/locales/en-GB/acl.json -> acl, packages/cms-suppliers/public/static/locales/en-GB/acl.json -> acl
  const commitMessage = '' //TODO: construct commitMessage based on the path: packages/web/public/locales/en-GB/acl.json -> "Update en-GB translations for acl", packages/cms-suppliers/public/static/locales/en-GB/acl.json -> "Update en-GB translations for acl"
  const content = '' //TODO: extract changed file content for given branch and file path and stringify it
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
