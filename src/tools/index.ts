/**
 * AI Tooling System
 *
 * A centralized system for defining, registering, and executing AI-callable tools
 * using OpenAI/OpenRouter-compatible function calling.
 *
 * Usage:
 *   import toolRegistry, { registerAllTools } from './tools/index.js';
 *   registerAllTools();
 *   // Now toolRegistry.getApiDefinitions() returns all tool definitions
 *   // toolRegistry.executeToolCalls() processes AI function calls
 */

export { default as toolRegistry, ToolRegistry } from './toolRegistry.js';
export { allTools } from './definitions/index.js';

import toolRegistry from './toolRegistry.js';
import { allTools } from './definitions/index.js';

/**
 * Register all built-in tools into the registry.
 * Call this once during bot startup.
 */
export function registerAllTools(): void {
  toolRegistry.registerAll(allTools);
  console.log(`[Tools] ✅ ${allTools.length} tools registered successfully`);
}
