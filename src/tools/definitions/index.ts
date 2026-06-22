import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';

import {
  definition as downloadSocialDef,
  execute as executeDownloadSocial,
} from './socialDownload.js';

import {
  definition as downloadYoutubeDef,
  execute as executeDownloadYoutube,
} from './downloadYoutube.js';

import {
  definition as pinterestSearchDef,
  execute as executePinterestSearch,
} from './pinterestSearch.js';

import {
  definition as webFetchDef,
  execute as executeWebFetch,
} from './webFetch.js';

import {
  definition as webSearchDef,
  execute as executeWebSearch,
} from './webSearch.js';

export const downloadSocialMedia = downloadSocialDef;
export const downloadYoutube = downloadYoutubeDef;
export const pinterestSearch = pinterestSearchDef;
export const webFetch = webFetchDef;
export const webSearch = webSearchDef;

export {
  executeDownloadSocial,
  executeDownloadYoutube,
  executePinterestSearch,
  executeWebFetch,
  executeWebSearch,
};

/**
 * All tools with their definitions and execute functions, ready for registration.
 */
export const allTools: Array<{
  name: string;
  definition: AIToolDefinition;
  execute: ToolExecuteFunction;
}> = [
  {
    name: 'download_social_media',
    definition: downloadSocialDef,
    execute: executeDownloadSocial,
  },
  {
    name: 'download_youtube',
    definition: downloadYoutubeDef,
    execute: executeDownloadYoutube,
  },
  {
    name: 'pinterest_search',
    definition: pinterestSearchDef,
    execute: executePinterestSearch,
  },
  {
    name: 'web_fetch',
    definition: webFetchDef,
    execute: executeWebFetch,
  },
  {
    name: 'web_search',
    definition: webSearchDef,
    execute: executeWebSearch,
  },
];
