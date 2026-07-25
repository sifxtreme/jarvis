# Amazon Transaction Categorization Rules

Based on analysis of 309 Amazon transactions from January-October 2025.

## Category Distribution
| Category | Count | % |
|----------|-------|---|
| Home | 95 | 31% |
| Personal Care | 44 | 14% |
| Hafsa | 30 | 10% |
| Yusuf + Musa | 30 | 10% |
| Gifts | 28 | 9% |
| Sulaiman | 28 | 9% |
| Asif Family | 14 | 5% |
| Asif | 7 | 2% |
| Travel and Trips | 6 | 2% |
| Other | 27 | 9% |

---

## RULESET

### 1. SULAIMAN (Baby/Toddler Items)
**Keywords**: diapers, pampers, huggies, sippy cup, sleep sack, car seat, crocs (toddler), playdoh, flash cards, iron supplement

**Pattern**: Items for a baby/toddler (appears to be ~2-3 years old)
- Diapers → **Sulaiman**
- Baby food/pouches → **Sulaiman** (NOT Yusuf + Musa)
- Sippy cups → **Sulaiman**
- Sleep sacks → **Sulaiman**
- Car seat / car seat protection → **Sulaiman**
- Toddler crocs → **Sulaiman**
- Baby blankets → **Sulaiman**

### 2. YUSUF + MUSA (Older Kids Items)
**Keywords**: school, books, underwear, swim, jujitsu gi, costumes, electronics kit, ramadan books, hoodies, wetsuit

**Pattern**: Items for school-age children
- School books/required reading → **Yusuf + Musa**
- Kids underwear/socks → **Yusuf + Musa**
- Swim clothes/wetsuit/towels → **Yusuf + Musa**
- Kids hoodies/shirts → **Yusuf + Musa**
- Educational books (not baby) → **Yusuf + Musa**
- Sports equipment (jujitsu gi) → **Yusuf + Musa**
- Costumes → **Yusuf + Musa**
- Electronic kits → **Yusuf + Musa**

### 3. HAFSA (Wife's Personal Items)
**Keywords**: planner, dress, shalwar kamiz, sports bra, swimsuit, henna, onyx book, cook book

**Pattern**: Women's personal items
- Dresses/shalwar kamiz → **Hafsa**
- Women's swimwear → **Hafsa**
- Planners → **Hafsa**
- Henna → **Hafsa**
- Women's shoes (personal use) → **Hafsa**
- Women's pants/sweaters → **Hafsa**

### 4. ASIF (Husband's Personal Items)
**Keywords**: legos, mental models, coding interview, shorts

**Pattern**: Men's personal items for self
- Programming/career books → **Asif**
- Legos (adult hobby) → **Asif**
- Men's shoes (labeled "Asif") → **Asif**

### 5. ASIF FAMILY (Shared Family Items)
**Keywords**: thermostats, beard trimmer, homeopathic, magnesium

**Pattern**: Items shared by family or unspecified family member
- Generic "Jacket" without person specified → **Asif Family**
- Health supplements (magnesium) → **Asif Family**
- Beard trimmer → **Asif Family**
- Thermostats → **Asif Family**

### 6. GIFTS
**Keywords**: birthday, eid, present, gift

**Pattern**: Items purchased for others or special occasions
- Birthday items (with name: "Yusuf BDay", "Musa Birthday") → **Gifts**
- Eid gifts → **Gifts**
- Presents (mummy present, zaki present) → **Gifts**
- Items for specific people outside immediate family → **Gifts**

### 7. HOME (Household Items)
**Keywords**: filter, cleaner, detergent, vacuum, soap, sponge, mop, trash, curtain, frame, light, washer, dryer

**Pattern**: Household maintenance and supplies
- Cleaning supplies → **Home**
- Air/water filters → **Home**
- Laundry supplies → **Home**
- Home decor (frames, curtains) → **Home**
- Kitchen items (muffin pans, slicer) → **Home**
- Bathroom items (shower head, rug) → **Home**
- Vacuum/robovac → **Home**

### 8. PERSONAL CARE (Health/Hygiene)
**Keywords**: toothbrush, toothpaste, lotion, sunscreen, razor, electrolyte, LMNT, nuun, stepper, exercise

**Pattern**: Health and hygiene items for family
- Dental care → **Personal Care**
- Skin care (cerave, lotion) → **Personal Care**
- Electrolytes/supplements → **Personal Care**
- Exercise equipment → **Personal Care**
- Razors → **Personal Care**

### 9. GROCERIES
**Keywords**: fresh, cashew butter, fruit snacks, salt

**Pattern**: Food items
- Amazon Fresh orders → **Groceries**
- Food ingredients → **Groceries**

### 10. TRAVEL AND TRIPS
**Keywords**: cooler, camping, sleeping pad

**Pattern**: Items for trips
- Camping gear → **Travel and Trips**
- Coolers → **Travel and Trips**

### 11. CAR MAINTENANCE
**Keywords**: tire, license plate, car buffer

**Pattern**: Vehicle-related items
- Car accessories → **Car Maintenance**

---

## BIG-BOX STORES (Manual Categorization Required)

**Target, Walmart, and similar general merchandise retailers CANNOT be auto-categorized.**

These stores sell everything, and past transactions show wide category distribution:
- Gifts (birthday presents, Eid gifts)
- Groceries (food items, cake)
- Yusuf + Musa (kids clothes, toys, costumes)
- Sulaiman (baby clothes)
- Personal Care (medicine, shampoo)
- Home (household items)
- Hafsa (crafts, personal items)
- Travel and Trips (trip supplies)
- Medical Expenses (medicine)

**Action**: Always ask the user what category a big-box store purchase should be.

---

## CRITICAL CORRECTIONS

### WRONG: Diapers → Yusuf + Musa
### CORRECT: Diapers → Sulaiman

Diapers are ALWAYS for Sulaiman (the baby). Yusuf and Musa are older kids who don't use diapers.

### WRONG: Baby food pouches → Yusuf + Musa
### CORRECT: Baby food pouches → Sulaiman

Baby food is for Sulaiman, not the older kids.

### WRONG: Kids jacket (unspecified) → Yusuf + Musa
### CORRECT: Need to check order details to determine which child

Rain jacket for "Boys Small" could be Yusuf, Musa, or Sulaiman depending on sizing.

---

## DECISION TREE

```
Is it diapers/baby food/sippy cups/car seat?
  → SULAIMAN

Is it school supplies/books for older kids?
  → YUSUF + MUSA

Is it women's clothing/accessories?
  → HAFSA

Is it a gift/present/birthday/eid item?
  → GIFTS

Is it cleaning/home maintenance?
  → HOME

Is it health/hygiene/dental/exercise?
  → PERSONAL CARE

Is it food?
  → GROCERIES

Is it for a trip?
  → TRAVEL AND TRIPS

Is it for the car?
  → CAR MAINTENANCE

Is it a shared family item?
  → ASIF FAMILY
```

---

## AMAZON ORDER LOOKUP GUIDE

When the category is ambiguous, look up the order on Amazon:
```
https://www.amazon.com/gp/css/summary/edit.html?orderID={ORDER_ID}
```

Check the item name and determine:
1. Who is the item for? (Sulaiman, Yusuf, Musa, Hafsa, Asif, family, gift)
2. What is the purpose? (personal, home, gift, travel)
