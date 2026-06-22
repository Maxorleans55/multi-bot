/**
 * ──────────────────────────────────────────────
 *  RAW TOOL CALL FILTER
 * ──────────────────────────────────────────────
 *
 * Shared utility to strip raw tool call artifacts that some AI models
 * emit as visible text instead of using the proper function_call /
 * tool_calls API.
 *
 * This is used across multiple layers of the bot as a safety net to
 * prevent raw XML/JSON from reaching the WhatsApp user.
 */

/**
 * Regex patterns for known tool call artifact formats.
 */
const TOOL_CALL_STRIP_RE = /<tool_calls>[\s\S]*?<\/tool_calls>|\{"name":"\w+","arguments":\{[^}]*\}\}|<invoke\s+name\s*=\s*"(?:web_search|web_fetch|download_social_media|download_youtube|pinterest_search)"[\s\S]*?<\/invoke>|```(?:json)?\s*\{\s*"name":\s*"\w+",\s*"arguments":[\s\S]*?```/gi;

/**
 * Strip raw tool call artifacts from AI response text.
 * Removes XML tool blocks, JSON function call strings, and
 * cleans up leftover whitespace.
 */
export function stripToolCallArtifacts(text: string): string {
  if (!text) return text;
  return text
    .replace(TOOL_CALL_STRIP_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Regex patterns used at the AIService level for streaming content.
 * These are the same patterns but kept as an array for the AIService
 * loop-based approach.
 */
export const TOOL_CALL_PATTERNS: RegExp[] = [
  /<tool_calls>[\s\S]*?<\/tool_calls>/gi,
  /\{"name":"\w+","arguments":\{[^}]*\}\}/gi,
  /```(?:json)?\s*\{\s*"name":\s*"\w+",\s*"arguments":[\s\S]*?```/gi,
  /\{\s*"name"\s*:\s*"(?:web_search|web_fetch|download_social_media|download_youtube|pinterest_search)"[\s\S]*?"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/gi,
  /<invoke\s+name\s*=\s*"(?:web_search|web_fetch|download_social_media|download_youtube|pinterest_search)"[\s\S]*?<\/invoke>/gi,
];
