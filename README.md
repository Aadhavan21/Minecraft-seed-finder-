# Minecraft Structure Finder

A client-side **Minecraft Structure Seed Finder** and **Interactive World Map Viewer** powered by a 64-bit **WebAssembly (WASM)** + **Web Worker** parallel search engine. Designed around the open-source [Cubiomes](https://github.com/Cubitect/cubiomes) (MIT License) Java 48-bit Linear Congruential Generator (LCG) and [SeedFinder](https://github.com/zebedelu/SeedFinder) (MIT License) Bedrock 32-bit Mersenne Twister (`MT19937`) structure placement algorithms.

---

## 1. Key Features & Architecture

- **Dual-Edition World Generation Engine**:
  - **Java Edition**: Exact 48-bit LCG (`multiplier = 0x5DEECE66D`, `addend = 0xB`, `mask = (1 << 48) - 1`) compiled to WebAssembly (`engine/wasm/cubiomes_core.wasm`) with 64-bit `BigInt` parity.
  - **Bedrock Edition**: Exact 32-bit Mersenne Twister (`MT19937`, multiplier `1812433253`, twist mask `0x9908B0DF`) for classic regional structures, plus Java-style 48-bit LCG Jigsaw placement for **Trail Ruins** (1.20+) and **Trial Chambers** (1.21+).
- **Two-Stage Seed Search Pipeline**:
  - **Stage A (Fast Regional & RNG Pre-Filter)**: Evaluates selected structures in descending order of grid spacing (rarest structures first) around the origin window. Rejects 99%+ of non-matching candidate seeds in nanoseconds before initializing biome noise.
  - **Stage B (Biome Viability, Spawn Estimation & Distance Verification)**: Evaluates multi-noise climate fields (Continentalness, Temperature, Humidity, Erosion, Weirdness), estimates World Spawn coordinates, verifies biome requirements (including Village biome variants and Deep Dark low-erosion constraints), and verifies that every selected structure lies within the user's maximum horizontal distance from World Spawn (`100` to `1,000` blocks).
- **21 Supported Structures with Voxel Thumbnails**:
  - `Village` (with filterable Plains, Desert, Savanna, Taiga, and Snowy variants), `Desert Pyramid`, `Jungle Temple`, `Swamp Hut`, `Pillager Outpost`, `Woodland Mansion`, `Ancient City`, `Stronghold`, `Trial Chambers`, `Ocean Monument`, `Shipwreck`, `Buried Treasure`, `Ocean Ruins`, `Ruined Portal`, `Nether Fortress`, `Bastion Remnant`, `End City`, `Mineshaft`, `Igloo`, `Trail Ruins`, and `Fossil`.
- **Interactive Top-Down Map**:
  - Renders the seed's biome backdrop, World Spawn beacon, concentric distance rings (`100m`, `250m`, `500m`, `750m`, `1000m`, plus the active search radius), structure icons, coordinates, and hover/tap inspection tooltips with smooth mouse/touch zoom and pan.

---

## 2. File Structure

```text
minecraft-structure-finder/
├── index.html                           # Main application entry point
├── styles.css                           # Responsive dark Minecraft-themed stylesheet
├── app.js                               # UI controller, Web Worker pool manager & telemetry
├── search-worker.js                     # Two-stage Java & Bedrock seed search worker
├── structures.js                        # 21 structure definitions, salts, spacing & separation rules
├── version-data.js                      # Modular Java & Bedrock version metadata (1.16 – 26.x)
├── map.js                               # Interactive top-down canvas map viewer
├── README.md                            # Project documentation & deployment guide
├── LICENSE                              # MIT License
├── assets/
│   └── structures/                      # 21 rendered Minecraft structure PNG thumbnails
├── engine/
│   ├── source/
│   │   └── cubiomes_core.c              # C source for Java 48-bit LCG & Bedrock MT19937 placement
│   └── wasm/
│       ├── cubiomes_core.wasm           # Compiled WebAssembly binary module
│       └── cubiomes_wasm_inline.js      # Base64 inline loader for zero-CORS / file:// execution
└── tests/
    └── verify_engine.js                 # Automated Node.js test suite verifying RNG & structure coords
```

---

## 3. How to Run Locally

Because the WebAssembly binary is also bundled in `engine/wasm/cubiomes_wasm_inline.js`, the application runs out-of-the-box on any local static HTTP server:

### Option A: Python Built-in HTTP Server (Recommended)
```bash
cd minecraft-structure-finder
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option B: Node.js `npx serve`
```bash
cd minecraft-structure-finder
npx serve .
```

### Running the Automated Verification Test Suite
```bash
cd minecraft-structure-finder
node tests/verify_engine.js
```

---

## 4. Deploying to GitHub Pages (100% Free Static Hosting)

This project is completely client-side and requires **no backend server, no API keys, and no external database**.

1. Create a new public or private repository on [GitHub](https://github.com/).
2. Upload or push all files inside `minecraft-structure-finder/` to the root of your repository (`main` branch):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Minecraft Structure Finder"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. In your GitHub repository, navigate to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then click **Save**.
6. Within 60 seconds, your site will be live at `https://<your-username>.github.io/<your-repo>/`.

---

## 5. How to Update Minecraft Version Data & Add New Structures

All version metadata and structure placement rules are decoupled from the UI so future Minecraft releases (such as upcoming `26.x` / `27.x` game drops per [Mojang's year-based versioning system](https://www.minecraft.net/en-us/article/minecraft-new-version-numbering-system)) can be added in minutes:

1. **Adding a New Minecraft Version (`version-data.js`)**:
   - Open `version-data.js` and add a new entry to the top of `VERSION_REGISTRY.java.versions` or `VERSION_REGISTRY.bedrock.versions`.
   - Update `latestStableId` to your new version's `id` and set `isLatest: true`. The UI will automatically select the new version as the default stable release.
   - If an older version differs in structure spacing (like Java 1.16's `32/8` Village grid vs. 1.18+'s `34/8`), add a `placementOverrides` block on that version object.
2. **Adding or Updating a Structure (`structures.js`)**:
   - Open `structures.js` and inspect the `STRUCTURES` array.
   - Each structure defines separate `java` and `bedrock` placement configurations containing:
     - `placementType`: `'random_spread'`, `'nether_complex'`, `'concentric_rings'`, `'buried_treasure_java'`, etc.
     - `rng`: `'java_lcg'` (48-bit Java LCG) or `'bedrock_mt'` (32-bit Mersenne Twister).
     - `salt`: Official vanilla structure salt from [PaperMC Spigot Configuration](https://docs.papermc.io/paper/reference/spigot-configuration/) or vanilla `worldgen/structure_set/*.json` files.
     - `spacing` & `separation`: Region grid size and minimum chunk padding.
     - `spreadType`: `'linear'` (single draw) or `'triangular'` (average of two draws).

---

## 6. Supported Versions & Known Technical Limitations

### Supported Versions
| Edition | Supported Version Groups | Default Latest Stable | Underlying Placement Engine |
| :--- | :--- | :--- | :--- |
| **Java Edition** | `26.3 / 1.21.6+`, `1.21 – 1.21.5`, `1.20 – 1.20.6`, `1.19 – 1.19.4`, `1.18 – 1.18.2`, `1.16 – 1.17.1` | `26.3` (1.21.6+) | 48-bit Java LCG (`0x5DEECE66D`) in WASM |
| **Bedrock Edition** | `26.62 / 1.21.132+`, `1.21.0 – 1.21.80`, `1.20.0 – 1.20.80`, `1.19.0 – 1.19.83`, `1.18.0 – 1.18.30` | `26.62` (1.21.132+) | 32-bit `MT19937` + 48-bit LCG Jigsaw Anchors |

- **Unsupported Legacy Versions**: Versions prior to Java 1.16 (e.g., 1.12.2, 1.14) and Bedrock 1.17 or older are intentionally excluded and labeled unsupported so coordinates are never misattributed across incompatible world generators.

### Known World-Generation Limitations & Honesty Disclosures
1. **3D Terrain Heightmap & Aquifer Gates (`Terrain-Checked`)**:
   - As documented in [Cubiomes](https://github.com/Cubitect/cubiomes), regional chunk candidate coordinates (`getStructurePos`) are 100% deterministic from the seed and structure salt. However, in Minecraft 1.18+, certain structures (such as **End Cities**, **Woodland Mansions**, and **Fossils**) also perform a final in-game 3D block/surface height or underground air-clearance check during chunk population. Evaluating full 3D block density for millions of seeds in a browser is computationally infeasible; therefore, structures that depend on local 3D block height clearance are transparently labeled **`Terrain-Checked`** or **`Unverified Decorator`** rather than falsely guaranteed.
2. **Java Stronghold & End City Minimum Ring Radii**:
   - In **Java Edition**, Strongholds generate in concentric rings around `(0, 0)`, with the inner edge of Ring 1 starting at **1,280 blocks** (`80 chunks`). Similarly, **End Cities** only generate in the outer End islands beyond the **1,008-block** central void ring. Consequently, a Java Stronghold or End City can only fall within `<= 1,000` blocks of World Spawn when World Spawn itself is displaced outward from `(0, 0)` (or at a 1,000-block search radius). The UI automatically displays a geometric warning whenever these options are combined with a sub-1,000-block radius.
3. **Bedrock Shared Temple Salt & Biome Disambiguation**:
   - In **Bedrock Edition**, Desert Pyramids, Jungle Temples, Swamp Huts, and Igloos share region salt `14357617` (`32/8` linear grid). Which temple actually spawns at the candidate chunk is determined entirely by the biome at that coordinate (Desert → Desert Pyramid, Jungle → Jungle Temple, Swamp → Swamp Hut, Snowy Plains → Igloo).
4. **Bedrock Fossils (`Unverified Decorator Candidate`)**:
   - Unlike regional structures, Bedrock Fossils are placed during per-chunk block decoration whose PRNG call order depends on preceding ore and cave feature decorators in that chunk. Results including Bedrock Fossils are explicitly badged as **`Unverified Decorator Candidate`**.
