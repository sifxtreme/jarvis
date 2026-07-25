// Local verification for the Jarvis MCP server. Spawns the real server over stdio via the
// MCP client SDK, checks tool registration + masking, and exercises a live read. Read-only.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = new URL('./server.mjs', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`  ${c ? '✅' : '❌'} ${m}`); };

const transport = new StdioClientTransport({ command: 'node', args: [SERVER], env: { ...process.env } });
const c = new Client({ name: 'test', version: '0' });
await c.connect(transport);
const call = async (name, args = {}) => JSON.parse((await c.callTool({ name, arguments: args })).content[0].text);

console.log('\n== Jarvis MCP — finance tools ==');
const tools = (await c.listTools()).tools.map((t) => t.name).sort();
console.log('  tools:', tools.join(', '));
ok(tools.length === 3, `3 finance tools registered (got ${tools.length})`);
ok(tools.every((t) => t.startsWith('finance_')), 'all tools are finance_*');

const sum = await call('finance_spending_summary');
console.log(`  summary ${sum.month}: total $${sum.total}, ${sum.categories.length} categories`);
ok(sum.total !== undefined && Array.isArray(sum.categories), 'finance_spending_summary returns live data');

const txns = await call('finance_list_transactions', { limit: 20 });
ok(txns.every((t) => 'raw_data' in t === false && 'external_id' in t === false), 'output is MASKED (no raw_data/external_id)');

await c.close();
console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
