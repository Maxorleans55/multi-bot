import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';

/**
 * Get Firecrawl base URL from environment, with fallback default.
 */
function getFirecrawlUrl(): string {
  return (process.env.FIRECRAWL_URL || 'https://firecrawl.wahyuhp.my.id').replace(/\/+$/, '');
}

/**
 * Firecrawl search API response shape.
 */
interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data: {
    web: FirecrawlSearchResult[];
  };
  id?: string;
  error?: string;
}

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web for current information using Firecrawl. Returns search result snippets (title, URL, description) from the web. Useful for finding latest news, prices, facts, or any up-to-date information. If you need full article content, use web_fetch after getting the URL.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A concise search query in Indonesian or English (e.g. "harga emas hari ini" or "penyebab pemadaman listrik Jawa"). Do not add a year unless the user explicitly asks about that year.',
        },
        maxResults: {
          type: 'number',
          description:
            'Maximum number of search results to return (between 3 and 15). Default is 8.',
        },
      },
      required: ['query'],
    },
  },
};

export const execute: ToolExecuteFunction = async (args, context) => {
  const query = (args.query as string || '').trim();
  const maxResults = Math.min(Math.max((args.maxResults as number) || 8, 3), 15);

  if (!query) {
    return { success: false, message: 'Search query not provided.' };
  }

  const firecrawlBase = getFirecrawlUrl();
  if (!firecrawlBase) {
    return {
      success: false,
      message:
        'Web search cannot be used because FIRECRAWL_URL is not configured. Please set FIRECRAWL_URL in the .env file.',
    };
  }

  const searchUrl = `${firecrawlBase}/v2/search`;

  try {
    console.log(`[Tool:WebSearch] 🔍 Searching via Firecrawl: ${query}`);

    const { default: axios } = await import('axios');

    const response = await axios.post<FirecrawlSearchResponse>(
      searchUrl,
      { query, limit: maxResults },
      {
        timeout: 30_000,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const result = response.data;

    if (!result.success || !result.data) {
      const errMsg = result.error || 'Firecrawl search returned unsuccessful response';
      console.error(`[Tool:WebSearch] ❌ Firecrawl search error: ${errMsg}`);
      return {
        success: false,
        message: `Gagal melakukan pencarian: ${errMsg}`,
      };
    }

    const results = result.data.web.slice(0, maxResults);

    if (results.length === 0) {
      return {
        success: false,
        message: `Search for "${query}" returned no results.`,
        data: { query, results: [] },
      };
    }

    // Format results
    const formatted = results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ''}`,
      )
      .join('\n\n');

    return {
      success: true,
      message: `Search results for "${query}":\n\n${formatted}`,
      data: {
        query,
        source: 'Firecrawl',
        results,
        totalResults: results.length,
      },
    };
  } catch (error: any) {
    const status = error.response?.status;
    const code = error.code;

    console.error(`[Tool:WebSearch] ❌ Firecrawl search error: ${error.message}`, {
      status,
      code,
    });

    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
      return {
        success: false,
        message: `Tidak dapat terhubung ke Firecrawl di ${getFirecrawlUrl()}. Pastikan server Firecrawl berjalan dan FIRECRAWL_URL di .env sudah benar.`,
      };
    }

    if (status === 404) {
      return {
        success: false,
        message: `Firecrawl search endpoint not found (404) at ${getFirecrawlUrl()}/v2/search. Check FIRECRAWL_URL configuration.`,
      };
    }

    if (status === 504) {
      return {
        success: false,
        message: `Firecrawl search timeout (504) while searching for "${query}". The server may be busy, please try again later.`,
      };
    }

    return {
      success: false,
      message: `Search failed: ${error.message || 'Unknown error'}. Check the Firecrawl server and FIRECRAWL_URL configuration.`,
    };
  }
};
