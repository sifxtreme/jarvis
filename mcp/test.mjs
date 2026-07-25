// Local verification for the Jarvis MCP server. Spawns the real server over stdio via the
// MCP client SDK, checks scope-gated tool registration, exercises a live read, and confirms
// the append-only grocery guard refuses a non-grocery row. Read-only except NO writes here.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = new URL('./server.mjs', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`  ${c ? '✅' : '❌'} ${m}`); };

async function connect(scope) {
  const transport = new StdioClientTransport({
    command: 'node', args: [SERVER], env: { ...process.env, JARVIS_MCP_SCOPE: scope },
  });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  return client;
}
const call = async (c, name, args = {}) => JSON.parse((await c.callTool({ name, arguments: args })).content[0].text);

console.log('\n== scope: grocery (Hafsa) ==');
{
  const c = await connect('grocery');
  const tools = (await c.listTools()).tools.map((t) => t.name).sort();
  console.log('  tools:', tools.join(', '));
  ok(tools.length === 5, `5 grocery tools registered (got ${tools.length})`);
  ok(!tools.some((t) => t.startsWith('finance_')), 'NO finance tools exposed in grocery scope');
  ok(tools.includes('grocery_annotate'), 'grocery_annotate present (append-only write)');

  const budget = await call(c, 'grocery_budget_status');
  console.log('  budget:', JSON.stringify(budget));
  ok(budget.category === 'Groceries' && typeof budget.spent === 'number', 'grocery_budget_status returns live data');

  const stores = await call(c, 'grocery_spend_by_store', { months: 3 });
  ok(Array.isArray(stores.stores) && stores.stores.length > 0, `grocery_spend_by_store: ${stores.stores.length} stores, $${stores.total}`);

  const cand = await call(c, 'grocery_candidates', { months: 2 });
  ok(Array.isArray(cand), `grocery_candidates: ${cand.length} rows needing item notes`);
  await c.close();
}

console.log('\n== scope: full (Asif) ==');
let nonGroceryId = null;
{
  const c = await connect('full');
  const tools = (await c.listTools()).tools.map((t) => t.name).sort();
  console.log('  tools:', tools.join(', '));
  ok(tools.length === 8, `8 tools registered (5 grocery + 3 finance) (got ${tools.length})`);
  ok(tools.includes('finance_spending_summary'), 'finance tools exposed in full scope');

  const sum = await call(c, 'finance_spending_summary');
  console.log(`  summary ${sum.month}: total $${sum.total}, ${sum.categories.length} categories`);
  ok(sum.total !== undefined && Array.isArray(sum.categories), 'finance_spending_summary returns live data');

  const txns = await call(c, 'finance_list_transactions', { limit: 20 });
  ok(txns.every((t) => 'raw_data' in t === false && 'plaid_id' in t === false), 'output is MASKED (no raw_data/plaid_id)');
  const ng = txns.find((t) => t.category && t.category !== 'Groceries');
  nonGroceryId = ng?.id;
  await c.close();
}

console.log('\n== annotate guard (server-defined grocery) ==');
{
  const c = await connect('grocery');
  if (nonGroceryId) {
    const res = await c.callTool({ name: 'grocery_annotate', arguments: { transaction_id: nonGroceryId, items: 'test' } });
    const refused = res.isError && /not a grocery/.test(res.content[0].text);
    ok(refused, `annotate REFUSES non-grocery #${nonGroceryId}: "${res.content[0].text}"`);
  } else {
    ok(false, 'could not find a non-grocery txn to test the guard');
  }
  await c.close();
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
