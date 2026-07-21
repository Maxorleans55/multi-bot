import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';

/**
 * Get Firecrawl base URL from environment, with fallback default.
 */
function getFirecrawlUrl(): string {
  return (process.env.FIRECRAWL_URL || 'https://firecrawl.wahyuhp.my.id').replace(/\/+$/, '');
}

/**
 * Firecrawl scrape API response shape.
 */
interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
      contentType?: string;
      [key: string]: unknown;
    };
  };
  error?: string;
}

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'web_fetch',
    description:
      'Fetch and read the content of any webpage by URL using Firecrawl (headless browser scraper). Extracts clean markdown content, title, and metadata — even from JavaScript-heavy sites. Useful for reading news articles, blog posts, documentation, or any web page content that requires full browser rendering.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The full URL to fetch and read (e.g. "https://example.com/article"). Supports any public webpage including SPAs and JS-heavy sites.',
        },
        maxChars: {
          type: 'number',
          description:
            'Maximum characters of content to return (between 500 and 12000). Default is 5000.',
        },
        formats: {
          type: 'string',
          description:
            'Output format: "markdown" (default, best for AI) or "raw" (raw HTML). Default is "markdown".',
          enum: ['markdown', 'raw'],
        },
      },
      required: ['url'],
    },
  },
};

export const execute: ToolExecuteFunction = async (args, context) => {
  const url = (args.url as string || '').trim();
  const maxChars = Math.min(Math.max((args.maxChars as number) || 5000, 500), 12_000);
  const format = (args.formats as string) || 'markdown';

  if (!url) {
    return { success: false, message: 'URL tidak diberikan.' };
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      message: `URL "${url}" tidak valid. Pastikan URL lengkap dengan protocol (http:// atau https://).`,
    };
  }

  const firecrawlBase = getFirecrawlUrl();
  if (!firecrawlBase) {
    return {
      success: false,
      message:
        'Web fetch tidak dapat digunakan karena FIRECRAWL_URL belum dikonfigurasi. Silakan set FIRECRAWL_URL di file .env.',
    };
  }

  const scrapeUrl = `${firecrawlBase}/v2/scrape`;

  try {
    console.log(`[Tool:WebFetch] 🔥 Fetching via Firecrawl: ${url}`);

    // Dynamic import — axios is an ESM/CJS hybrid
    const { default: axios } = await import('axios');

    const response = await axios.post<FirecrawlScrapeResponse>(
      scrapeUrl,
      {
        url,
        formats: format === 'raw' ? ['html'] : ['markdown'],
      },
      {
        timeout: 30_000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const result = response.data;

    // Firecrawl API-level failure
    if (!result.success || !result.data) {
      const errMsg = result.error || 'Firecrawl API returned unsuccessful response';
      console.error(`[Tool:WebFetch] ❌ Firecrawl API error: ${errMsg}`);
      return {
        success: false,
        message: `Gagal mengambil halaman: ${errMsg}`,
      };
    }

    const { data } = result;
    const markdown = data.markdown || '';
    const html = data.html || '';
    const meta = data.metadata || {};

    // Determine which content to use
    let content: string;
    if (format === 'raw' && html) {
      content = html;
    } else {
      content = markdown;
    }

    // Fallback: if no content extracted, return error
    if (!content) {
      return {
        success: false,
        message: `Halaman ${url} tidak mengandung konten yang bisa diekstrak (mungkin halaman kosong atau memerlukan login).`,
      };
    }

    // Truncate content for AI context
    const contentForAI = content.substring(0, maxChars);
    const truncated = content.length > maxChars;

    const title = meta.title || '';
    const description = meta.description || '';
    const siteName = meta.sourceURL || meta.url || url;
    const language = meta.language || '';

    return {
      success: true,
      message: `Berhasil membaca halaman "${title || url}". ${contentForAI.length} karakter berhasil diekstrak${truncated ? ` (dari total ${content.length})` : ''}.`,
      data: {
        url,
        title,
        description,
        siteName,
        language,
        content: contentForAI,
        truncated,
        contentLength: content.length,
        source: 'Firecrawl',
        statusCode: meta.statusCode,
      },
    };
  } catch (error: any) {
    const status = error.response?.status;
    const code = error.code;

    console.error(`[Tool:WebFetch] ❌ Firecrawl error: ${error.message}`, {
      status,
      code,
    });

    // Connection errors
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
      return {
        success: false,
        message: `Tidak dapat terhubung ke Firecrawl di ${getFirecrawlUrl()}. Pastikan server Firecrawl berjalan dan FIRECRAWL_URL di .env sudah benar.`,
      };
    }

    if (status === 404) {
      return {
        success: false,
        message: `Endpoint Firecrawl tidak ditemukan (404) di ${getFirecrawlUrl()}/v2/scrape. Periksa konfigurasi FIRECRAWL_URL.`,
      };
    }

    if (status === 400) {
      return {
        success: false,
        message: `Permintaan tidak valid (400) — periksa apakah URL yang diberikan benar: ${url}`,
      };
    }

    if (status === 504) {
      return {
        success: false,
        message: `Firecrawl timeout (504) saat memproses ${url}. Halaman mungkin terlalu lambat atau berat. Coba URL lain.`,
      };
    }

    return {
      success: false,
      message: `Gagal mengambil halaman: ${error.message || 'Unknown error'}. Periksa server Firecrawl dan konfigurasi FIRECRAWL_URL.`,
    };
  }
};
