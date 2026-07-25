import fs from 'fs';

const API_BASE_URL = 'https://sifxtre.me/api';
const API_KEY = process.env.JARVIS_TOKEN; // Google-issued JWT, sent as Bearer (from finances.sifxtre.me)

// Pre-defined item mappings from Amazon order lookups
// Format: { orderId: { merchantName, category } }
const ORDER_MAPPINGS = {
  // May 2026 overrides (flour mis-cat'd as Home by keyword heuristic)
  '112-2947955-5491466': { merchantName: 'Amazon - Bob\'s Red Mill Artisan Bread Flour', category: 'Groceries' },

  // December transactions (older)
  '113-7933032-2884254': { merchantName: 'Amazon - Diapers (Pampers Size 5)', category: 'Sulaiman' },
  '111-5535456-1201835': { merchantName: 'Amazon - Baby Food Pouches', category: 'Sulaiman' },
  '114-2146985-1034631': { merchantName: 'Amazon - Islamic Book (Surah al-Kahf)', category: 'Home' },
  '111-7148893-5786642': { merchantName: 'Amazon - Chocolate Gift', category: 'Gifts' },
  '113-6398656-0079415': { merchantName: 'Amazon - Ice Packs', category: 'Home' },
  '111-3080379-3183415': { merchantName: 'Amazon - Rock Polisher Kit', category: 'Yusuf + Musa' },
  '114-4796152-3173822': { merchantName: 'Amazon - Labels & Markers', category: 'Yusuf + Musa' },
  '113-3966074-9381859': { merchantName: 'Amazon - North Face Rain Jacket', category: 'Yusuf + Musa' },
  '113-5791510-0440219': { merchantName: 'Amazon - Nut Milk Bag Kit', category: 'Home' },

  // December transactions (Dec 7-14, 2025)
  '113-6984627-1639422': { merchantName: 'Amazon - Badminton Rackets Set', category: 'Yusuf + Musa' },
  '113-0454653-3910632': { merchantName: 'Amazon - Diamond Crystal Kosher Salt', category: 'Groceries' },
  '111-4930831-9002610': { merchantName: 'Amazon - Levi\'s Men\'s Jeans', category: 'Asif' },
  'D01-8046203-4749010': { merchantName: 'Prime Video - Ad Free Subscription', category: 'Subscriptions' },
  '114-4129163-8356253': { merchantName: 'Amazon - Standing Desk (HUANUO)', category: 'Asif Career' },
  '111-8423588-0801048': { merchantName: 'Amazon - 7 Habits Book', category: 'Asif' },
  '111-9211683-3198606': { merchantName: 'Amazon - Exercise Ball (Trideer)', category: 'Personal Care' },
  '114-7484002-2565803': { merchantName: 'Amazon - Walking Pad Treadmill', category: 'Asif Career' },
  '113-0881968-7685054': { merchantName: 'Amazon - Stainless Steel Spoons', category: 'Home' },

  // December transactions (Dec 13-16, 2025)
  '111-9292093-1257809': { merchantName: 'Amazon - LEGO NINJAGO Arin\'s Battle Mech', category: 'Yusuf + Musa' },
  '113-7845626-5141851': { merchantName: 'Amazon - Yimobra Bathroom Runner Rug', category: 'Home' },
  '114-1027126-9720261': { merchantName: 'Amazon - adidas Adilette Shower Slides', category: 'Home' },
  '111-2818190-4215429': { merchantName: 'Amazon - CLOROX Toilet Bowl Cleaner', category: 'Home' },
  '111-7018248-6229060': { merchantName: 'Amazon - Stardrops Pink Stuff Toilet Cleaner', category: 'Home' },
  '114-0917959-1157048': { merchantName: 'Amazon - ULTRA 1PLUS Windshield Washer Fluid', category: 'Home' },
  '114-2167928-1286659': { merchantName: 'Amazon - Pampers Training Pants', category: 'Sulaiman' },
  '114-7944758-0013836': { merchantName: 'Amazon - 3D Pedometer for Walking', category: 'Hafsa' },
  '114-7870673-6240237': { merchantName: 'Amazon - Pirate Gold Coins Party Supplies', category: 'Yusuf + Musa' },

  // December transactions (Dec 16-26, 2025)
  '113-9761861-0320268': { merchantName: 'Amazon - LEGO City Red Double-Decker Bus', category: 'Yusuf + Musa' },
  '114-2015488-6797011': { merchantName: 'Amazon - Nature Made Vitamin C 500mg', category: 'Personal Care' },
  '111-9136664-7792215': { merchantName: 'Amazon - Nintendo Switch 2 + Mario Kart Bundle', category: 'Yusuf + Musa' },
  '113-3503353-0260214': { merchantName: 'Amazon - Mrs. Meyers Dish Soap Refill', category: 'Home' },
  '111-4997614-6147455': { merchantName: 'Amazon - Drive Medical Folding Walker', category: 'Home' },
  '114-7667707-8869050': { merchantName: 'Amazon - ClearLax Laxative', category: 'Personal Care' },

  // January 2026 transactions
  '113-9949981-8578646': { merchantName: 'Amazon - Our Legends', category: 'Muslim Businesses' },
  '114-5030260-5925818': { merchantName: 'Amazon - Aegend Kids Swim Goggles', category: 'Yusuf + Musa' },
  '112-1377844-7295413': { merchantName: 'Amazon - Affresh Washing Machine Cleaner', category: 'Home' },
  '111-8090504-8402664': { merchantName: 'Amazon - Mrs. Meyer\'s Hand Soap Refill', category: 'Home' },
  '113-8241732-9049023': { merchantName: 'Amazon - OLANLY Bathroom Rugs 59x24 (Refund)', category: 'Home' },
  '111-7450162-7475406': { merchantName: 'Amazon - HOMURE Cookie Scoop Set', category: 'Home' },
  '111-1906253-3021802': { merchantName: 'Amazon - Mrs. Meyer\'s Laundry Detergent', category: 'Home' },
  'D01-4828862-3433861': { merchantName: 'Amazon - Ad Free for Prime Video', category: 'Subscriptions' },
  '114-2073082-1461002': { merchantName: 'Amazon - Nature Made Chewable Vitamin C', category: 'Personal Care' },
  '113-2811104-4045824': { merchantName: 'Amazon - Mrs. Meyer\'s Laundry Detergent', category: 'Home' },
  '113-7842481-0201837': { merchantName: 'Amazon - Z ZHICHI Pull Up Bar Dip Station', category: 'Home' },
  '114-8298807-8209810': { merchantName: 'Amazon - Livho Blue Light Glasses', category: 'Home' },
  '114-8960269-3729868': { merchantName: 'Amazon - Bostitch 3-Hole Punch', category: 'Home' },
  '113-2960597-8184209': { merchantName: 'Amazon - Embryolisse Moisturizer', category: 'Personal Care' },
  '113-9558210-1945807': { merchantName: 'Amazon - Avery Heavy-Duty View 3 Ring Binder (Refund)', category: 'Home' },
  '113-2297814-2476211': { merchantName: 'Amazon - Colorxy Kids Rain Boots', category: 'Sulaiman' },
  '111-0591616-1828224': { merchantName: 'Amazon - Bed Skirt', category: 'Hafsa' },
  '114-9957509-6861068': { merchantName: 'Amazon - USB C to Micro USB Adapter', category: 'Asif Career' },
  '113-8425098-2902612': { merchantName: 'Amazon - Hanes Toddler Boxer Brief Underwear', category: 'Sulaiman' },

  // January 2026 (late)
  '114-2142907-9279469': { merchantName: 'Amazon - Crest + Scope Whitening Toothpaste', category: 'Personal Care' },
  '111-2370604-7770625': { merchantName: 'Amazon - Muhammad: A Remarkable Human', category: null }, // Needs review
  '114-9020746-5920230': { merchantName: 'Amazon - PINSPARK Womens Sweatpants', category: 'Hafsa' },
  '111-9219892-3388216': { merchantName: 'Amazon - Stainless Steel Bento Lunch Box', category: 'Home' },
  '114-2576808-5313060': { merchantName: 'Amazon - 8 Pack Wooden Forks', category: 'Home' },

  // January 2026 (late - runbook Feb 2)
  '113-3697043-8021001': { merchantName: 'Amazon - Yimobra Bathroom Runner Rug 60x24 Inch', category: 'Home' },
  '111-0886808-3865034': { merchantName: 'Amazon - Pokémon 100 Pokemon Card Lot', category: 'Gifts' },
  '111-6201858-6633815': { merchantName: 'Amazon - Kitsch Nylon Hair Ties', category: 'Hafsa' },

  // April 2026 (late month, second batch)
  '112-0168141-7640247': { merchantName: 'Amazon - RESTMO Garden Hose Nozzle', category: 'Home' },
  '112-1840370-5275418': { merchantName: 'Amazon - Sea Salt Fine Ground 16oz', category: 'Groceries' },
  '112-2149166-1745004': { merchantName: 'Amazon - Uncle Harry\'s Peppermint Toothpaste', category: 'Personal Care' },
  '112-1929505-2728245': { merchantName: 'Amazon - Eczema Honey Face & Body Lotion Stick', category: 'Personal Care' },
  '114-4339784-5275428': { merchantName: 'Amazon - Lianjindun Toilet Safety Rails', category: 'Home' },
  '114-6032545-1561052': { merchantName: 'Amazon - Buself Shoe Covers Disposable', category: 'Home' },
  '114-2391030-0240245': { merchantName: 'Amazon - Sharpie Permanent Markers 12pk', category: 'Yusuf + Musa' },
  '114-1907148-8137844': { merchantName: 'Amazon - Sticky Notes 24 Pads 3x3', category: 'Yusuf + Musa' },
  '113-2085680-1773043': { merchantName: 'Amazon - TADO Muslin Baby Sleep Sack 2-4T', category: 'Sulaiman' },
  '113-0902648-1061036': { merchantName: 'Amazon - Scotch Box Lock Packing Tape (Move)', category: 'Asif Family' },
  '112-3521569-2389845': { merchantName: 'Amazon - Mrs. Meyer\'s Dish Soap Refill', category: 'Home' },
  '111-4382130-9532207': { merchantName: 'Amazon - Scotch Box Lock Packing Tape (Move)', category: 'Asif Family' },

  // April 2026 (first batch)
  '112-9942150-8864249': { merchantName: 'Amazon - ARZOPA 16.1" 144Hz Portable Gaming Monitor', category: 'Asif Career' },
  '111-8348458-6103415': { merchantName: 'Amazon - Pan Hanger (Frigidaire Replacement Part)', category: 'Home' },
  '114-8555948-2639416': { merchantName: 'Amazon - Sun Bum SPF 50 Sunscreen Spray', category: 'Personal Care' },
  '113-9903422-6996216': { merchantName: 'Amazon - TINKRSTUFF Slime Mix Ins (Fruit Slices)', category: 'Yusuf + Musa' },
  '113-6074433-9470651': { merchantName: 'Amazon - Slime Activator 1QT', category: 'Yusuf + Musa' },
  '113-8997436-3206607': { merchantName: 'Amazon - Argo Corn Starch 16oz', category: 'Yusuf + Musa' },
  '114-4308552-1750625': { merchantName: 'Amazon - Iswee Brown Crescent Bag (Hafsa)', category: 'Hafsa' },
  '111-1020229-5788208': { merchantName: 'Amazon - Grimms\' Fairy Tales (Refund)', category: 'Yusuf + Musa' },
  '114-8797458-8473832': { merchantName: 'Amazon - Oral B Toothbrush Heads (Refund)', category: 'Personal Care' },
};

// Update a transaction via API
async function updateTransaction(id, data) {
  const response = await fetch(`${API_BASE_URL}/financial_transactions/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update failed for ${id}: ${response.status} - ${text}`);
  }

  return response.json();
}

// Fetch a single transaction
async function fetchTransaction(id) {
  const response = await fetch(`${API_BASE_URL}/financial_transactions?year=2025&month=12&show_hidden=false`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data = await response.json();
  return data.results.find(t => t.id === id);
}

async function main() {
  // Load matches from the matching script
  const matches = JSON.parse(fs.readFileSync('./amazon_matches.json', 'utf8'));

  // Auto-fallback: lookup-orders.mjs already writes a per-order
  // suggestedMerchantName/suggestedCategory into order_details.json. Index it
  // by orderId so we DON'T need ORDER_MAPPINGS hand-pasted every month. The
  // static ORDER_MAPPINGS still wins when present (lets you override a bad
  // auto-suggestion), but anything it's missing falls through to the lookup.
  let detailsById = {};
  if (fs.existsSync('./order_details.json')) {
    for (const d of JSON.parse(fs.readFileSync('./order_details.json', 'utf8'))) {
      if (d.orderId && d.suggestedCategory && d.suggestedMerchantName) {
        detailsById[d.orderId] = {
          merchantName: d.suggestedMerchantName,
          category: d.suggestedCategory,
        };
      }
    }
    console.log(`Loaded ${Object.keys(detailsById).length} auto-suggestions from order_details.json`);
  }

  console.log(`Found ${matches.length} matches to update\n`);

  let updated = 0;
  let skipped = 0;

  for (const match of matches) {
    const mapping = ORDER_MAPPINGS[match.amazonOrderId] || detailsById[match.amazonOrderId];

    if (!mapping || mapping.category === null) {
      console.log(`⏭️  Skipping ID ${match.financeId} ($${match.financeAmount}) - needs manual lookup`);
      console.log(`   Order: ${match.amazonOrderId}`);
      skipped++;
      continue;
    }

    console.log(`\n📝 Updating ID ${match.financeId}:`);
    console.log(`   Amount: $${Math.abs(match.financeAmount).toFixed(2)}`);
    console.log(`   New merchant: ${mapping.merchantName}`);
    console.log(`   New category: ${mapping.category}`);

    try {
      const signedAmount = match.type === 'refund'
        ? -Math.abs(match.financeAmount)
        : Math.abs(match.financeAmount);
      await updateTransaction(match.financeId, {
        merchant_name: mapping.merchantName,
        category: mapping.category,
        amount: signedAmount,
        transacted_at: match.financeDate.split('T')[0],
        source: 'amex',
        hidden: false
      });
      console.log(`   ✅ Updated successfully`);
      updated++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (needs lookup): ${skipped}`);
}

main().catch(console.error);
