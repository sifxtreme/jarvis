#!/usr/bin/env node
// Jarvis MCP server — local stdio. One instance per person's Claude Code.
//
// Exposes read-only, MASKED finance tools. Per-user scoping (JARVIS_MCP_SCOPE) returns
// alongside the grocery tools next session; for now every instance gets the finance tools.
// Masking + task-shaped tools (no raw SQL/search/mutation) are enforced in jarvis-client.mjs.
//
// Env: JARVIS_TOKEN=<your Google JWT from finances.sifxtre.me>, JARVIS_API_URL (optional).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as J from './jarvis-client.mjs';

const server = new McpServer({ name: 'jarvis', version: '0.1.0' });

// Wrap a handler: run it, return pretty JSON; on error return an MCP tool error (never throw).
const tool = (fn) => async (args) => {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn(args ?? {}), null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
};

server.registerTool('finance_list_transactions', {
  title: 'List transactions',
  description: 'Transactions for a month (masked: id, date, merchant, amount, category). Optional category filter.',
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('YYYY-MM, default current month'),
    category: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().describe('default 50'),
  },
}, tool(J.finance_list_transactions));

server.registerTool('finance_spending_summary', {
  title: 'Spending summary by category',
  description: 'A month total plus per-category totals, highest first.',
  inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('YYYY-MM, default current month') },
}, tool(J.finance_spending_summary));

server.registerTool('finance_search', {
  title: 'Search transactions',
  description: 'Find transactions whose merchant/category matches a term over the last N months (masked). Task-shaped — not raw SQL.',
  inputSchema: {
    query: z.string().min(1).describe('merchant or category text to match'),
    months: z.number().int().min(1).max(24).optional().describe('lookback window, default 6'),
  },
}, tool(J.finance_search));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[jarvis-mcp] ready — finance tools (grocery deferred)');
