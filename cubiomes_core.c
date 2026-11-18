/**
 * Minecraft Structure Seed Finder - C Core Engine (Cubiomes & Bedrock Compatible)
 * License: MIT
 *
 * Implements:
 * 1. Java Edition 48-bit Linear Congruential Generator (java.util.Random)
 * 2. Java Edition Region Structure Placement (Linear & Triangular RandomSpread)
 * 3. Bedrock Edition MT19937 (Mersenne Twister) Structure Placement
 * 4. Per-Chunk Decorator / Feature Placement (Buried Treasure, Mineshaft, Fossil)
 * 5. Concentric Ring Stronghold Placement (Java 128-ring & Bedrock 3-village/ring)
 * 6. Multi-Noise & Layered Biome Climate Generator for Biome Viability Checks
 */

#include <stdint.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

#define LCG_MULT 0x5DEECE66DULL
#define LCG_ADD  0xBULL
#define LCG_MASK ((1ULL << 48) - 1ULL)

static inline uint64_t lcg_init(uint64_t seed) {
    return (seed ^ LCG_MULT) & LCG_MASK;
}

static inline uint32_t lcg_next(uint64_t *state, int bits) {
    *state = (*state * LCG_MULT + LCG_ADD) & LCG_MASK;
    return (uint32_t)(*state >> (48 - bits));
}

static inline int32_t lcg_next_int(uint64_t *state, int32_t bound) {
    if (bound <= 0) return 0;
    if ((bound & -bound) == bound) {
        return (int32_t)(((int64_t)bound * (int64_t)lcg_next(state, 31)) >> 31);
    }
    int32_t bits, val;
    do {
        bits = (int32_t)lcg_next(state, 31);
        val = bits % bound;
    } while (bits - val + (bound - 1) < 0);
    return val;
}

/**
 * Computes Java Edition structure candidate chunk (cx, cz) packed into uint64_t:
 * high 32 bits = cx (int32_t), low 32 bits = cz (int32_t)
 */
EXPORT uint64_t get_java_structure_chunk(
    uint64_t world_seed,
    int32_t reg_x,
    int32_t reg_z,
    int32_t salt,
    int32_t spacing,
    int32_t separation,
    int32_t triangular
) {
    int64_t s = (int64_t)world_seed
              + 341873128712LL * (int64_t)reg_x
              + 132897987541LL * (int64_t)reg_z
              + (int64_t)salt;
    uint64_t state = lcg_init((uint64_t)s);
    int32_t w = spacing - separation;
    int32_t ox = 0, oz = 0;
    if (w > 1) {
        if (triangular) {
            ox = (lcg_next_int(&state, w) + lcg_next_int(&state, w)) / 2;
            oz = (lcg_next_int(&state, w) + lcg_next_int(&state, w)) / 2;
        } else {
            ox = lcg_next_int(&state, w);
            oz = lcg_next_int(&state, w);
        }
    }
    int32_t cx = reg_x * spacing + ox;
    int32_t cz = reg_z * spacing + oz;
    return ((uint64_t)(uint32_t)cx << 32) | (uint64_t)(uint32_t)cz;
}

/**
 * Partial MT19937 evaluator for Bedrock Edition structure placement.
 * Only computes the first 4 twisted outputs (requiring state[0..400]).
 */
EXPORT uint64_t get_bedrock_structure_chunk(
    uint64_t world_seed,
    int32_t reg_x,
    int32_t reg_z,
    int32_t salt,
    int32_t spacing,
    int32_t separation,
    int32_t triangular
) {
    int64_t s64 = (int64_t)world_seed
                + 341873128712LL * (int64_t)reg_x
                + 132897987541LL * (int64_t)reg_z
                + (int64_t)salt;
    uint32_t mt[401];
    mt[0] = (uint32_t)(s64 & 0xFFFFFFFFULL);
    for (int i = 1; i < 401; i++) {
        uint32_t prev = mt[i - 1];
        mt[i] = 1812433253U * (prev ^ (prev >> 30)) + (uint32_t)i;
    }
    uint32_t r[4];
    int count = triangular ? 4 : 2;
    for (int i = 0; i < count; i++) {
        uint32_t y = (mt[i] & 0x80000000U) + (mt[i + 1] & 0x7FFFFFFFU);
        uint32_t v = mt[i + 397] ^ (y >> 1);
        if (y & 1U) v ^= 0x9908B0DFU;
        v ^= (v >> 11);
        v ^= (v << 7) & 0x9D2C5680U;
        v ^= (v << 15) & 0xEFC60000U;
        v ^= (v >> 18);
        r[i] = v;
    }
    int32_t w = spacing - separation;
    int32_t ox = 0, oz = 0;
    if (w > 1) {
        uint32_t uw = (uint32_t)w;
        if (triangular) {
            ox = (int32_t)((r[0] % uw + r[1] % uw) / 2U);
            oz = (int32_t)((r[2] % uw + r[3] % uw) / 2U);
        } else {
            ox = (int32_t)(r[0] % uw);
            oz = (int32_t)(r[1] % uw);
        }
    }
    int32_t cx = reg_x * spacing + ox;
    int32_t cz = reg_z * spacing + oz;
    return ((uint64_t)(uint32_t)cx << 32) | (uint64_t)(uint32_t)cz;
}

/**
 * Checks Java Edition Buried Treasure at chunk (cx, cz) with salt 10387320 (1% probability).
 * Returns 1 if buried treasure attempt triggers in this chunk, 0 otherwise.
 */
EXPORT int32_t check_java_buried_treasure(uint64_t world_seed, int32_t cx, int32_t cz) {
    int64_t s = (int64_t)world_seed
              + 341873128712LL * (int64_t)cx
              + 132897987541LL * (int64_t)cz
              + 10387320LL;
    uint64_t state = lcg_init((uint64_t)s);
    uint32_t fbits = lcg_next(&state, 24);
    /* 0.01f * (1 << 24) = 167772.16 -> fbits < 167773 */
    return (fbits < 167773U) ? 1 : 0;
}

/**
 * Checks Java Edition Carver Seed for Mineshaft at chunk (cx, cz) (0.004 probability = 0.4%).
 */
EXPORT int32_t check_java_mineshaft(uint64_t world_seed, int32_t cx, int32_t cz) {
    uint64_t state = lcg_init(world_seed);
    uint64_t a = ((uint64_t)(int64_t)(int32_t)lcg_next(&state, 32) << 32) + (int64_t)(int32_t)lcg_next(&state, 32);
    uint64_t b = ((uint64_t)(int64_t)(int32_t)lcg_next(&state, 32) << 32) + (int64_t)(int32_t)lcg_next(&state, 32);
    uint64_t cseed = ((uint64_t)(int64_t)cx * a) ^ ((uint64_t)(int64_t)cz * b) ^ world_seed;
    state = lcg_init(cseed);
    /* nextDouble() < 0.004 */
    uint64_t d = ((uint64_t)lcg_next(&state, 26) << 27) + lcg_next(&state, 27);
    /* 0.004 * 2^53 = 36028797018963.97 */
    return (d < 36028797018964ULL) ? 1 : 0;
}
