# Minecraft Java 1.21+ 64-Bit Seed Finder & Interactive Map

## What Changed in v2
1. **True 64-Bit Signed Java Seeds:** Generates full 19-digit signed 64-bit integers (`BigInt.asIntN(64, ...)`, positive and negative) matching Minecraft Java Edition's internal `long` seed format.
2. **Authentic Java LCG Region Placement Math (`seed_engine.js`):** Implements `java.util.Random` 48-bit Linear Congruential Generator (`25214903917n` multiplier, `341873128712n` & `132897987541n` region multipliers) with exact structure `spacing`, `separation`, and `salt` values for Villages, Ruined Portals, Pillager Outposts, Temples, Woodland Mansions, Ocean Monuments, Ancient Cities, and Trial Chambers.
3. **Interactive Map Switcher for All 10 Seeds:** Use the **Inspect Seed** dropdown or the **#1 – #10** quick-selector buttons above the radar map (or click any seed card) to view the exact block and chunk coordinates for each individual seed.

## How to Run
Open `index.html` directly in any modern browser (no server required).
