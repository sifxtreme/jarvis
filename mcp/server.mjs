#!/usr/bin/env node
// Jarvis MCP server — local stdio. One instance per person's Claude Code.
//
// SCOPE is set per user via env JARVIS_MCP_SCOPE:
//   grocery (default, least-privilege)  -> Hafsa: grocery read + append-only annotate
//   full                                 -> Asif: finance read + all grocery tools
//
// The server registers ONLY the tools its scope allows — scope is enforced by tool
// availability, not by trusting the model. See docs/DIRECTION.md.
//
// Env: JARVIS_MCP_SCOPE=grocery|full, JARVIS_API_KEY=<rotated key>, JARVIS_API_URL (optional).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as J from './jarvis-client.mjs';

const SCOPE = (process.env.JARVIS_MCP_SCOPE || 'grocery').toLowerCase();
if (!['grocery', 'full'].includes(SCOPE)) {
  console.error(`[jarvis-mcp] invalid JARVIS_MCP_SCOPE="${SCOPE}" (use grocery|full)`);
  process.exit(1);
}

const server = new McpServer({ name: 'jarvis', version: '0.1.0' });

// Wrap a handler: run it, return pretty JSON; on error return an MCP tool error (never throw).
const tool = (fn) => async (args) => {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn(args ?? {}), null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
};

// ---- GROCERY tools (available in BOTH scopes) --------------------------------
server.registerTool('grocery_spend_by_store', {
  title: 'Grocery spend by store',
  description: 'Total grocery spend grouped by store (Costco, Sprouts, …) over the last N months.',
  inputSchema: { months: z.number().int().min(1).max(36).optional().describe('lookback window, default 6') },
}, tool(J.grocery_spend_by_store));

server.registerTool('grocery_list', {
  title: 'List grocery purchases',
  description: 'Recent grocery purchases (id, date, store, amount, and any items already recorded).',
  inputSchema: {
    months: z.number().int().min(1).max(36).optional().describe('lookback window, default 6'),
    limit: z.number().int().min(1).max(100).optional().describe('max rows, default 40'),
  },
}, tool(J.grocery_list));

server.registerTool('grocery_candidates', {
  title: 'Grocery purchases needing item notes',
  description: 'Grocery purchases that have NO item annotation yet — the worklist for adding what was bought.',
  inputSchema: { months: z.number().int().min(1).max(36).optional().describe('lookback window, default 6') },
}, tool(J.grocery_candidates));

server.registerTool('grocery_budget_status', {
  title: 'Grocery budget status (this month)',
  description: 'This month grocery spend vs the Groceries budget: spent, budget, remaining, % used.',
  inputSchema: {},
}, tool(J.grocery_budget_status));

server.registerTool('grocery_annotate', {
  title: 'Add item notes to a grocery purchase',
  description: 'APPEND what was bought to a grocery purchase (e.g. "eggs, milk, bread"). Append-only; refuses any non-grocery transaction. Does not change the amount.',
  inputSchema: {
    transaction_id: z.number().int().describe('the purchase id from grocery_list / grocery_candidates'),
    items: z.string().min(1).describe('comma-separated items bought'),
  },
  annotations: { destructiveHint: false, idempotentHint: true },
}, tool(J.grocery_annotate));

// ---- FINANCE tools (full scope only — Asif) ----------------------------------
if (SCOPE === 'full') {
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
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[jarvis-mcp] ready — scope=${SCOPE}, tools=${SCOPE === 'full' ? 'finance+grocery' : 'grocery'}`);
