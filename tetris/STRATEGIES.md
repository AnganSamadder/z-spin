## Strategy Guide

This document describes the current AI strategies available in the Tetris engine, the evaluation weights they use, and how to interpret each weight. It will be updated as we add or refine strategies.

### Where strategies are defined
- Strategy names → `tetris/src/modules/wasm/WasmLoader.ts` (`STRATEGY_MAP`)
- Displayed UI weights → `tetris/src/modules/wasm/WasmEngine.ts` (`getUiEvalWeights`)
- Rust weights and shaping → `engine/src/evaluation.rs` (`Strategy` enum and `EvaluationWeights::new`)

### Weight glossary
- **aggregate_height**: Total column heights sum. More negative means strongly discouraging tall stacks overall.
- **max_height**: Highest column height. More negative means strongly discouraging any single tall column.
- **bumpiness**: Sum of absolute differences between adjacent column heights. More negative favors flatter surfaces.
- **holes**: Empty cells with at least one block above in the same column. More negative strongly discourages creating holes.
- **completed_lines**: Reward for lines cleared by a placement. Positive values encourage line clears.

### Current strategies

#### Balanced
- **Intent**: General-purpose play. Avoids height/holes/bumpiness while valuing line clears.
- **Weights**:
  - aggregate_height: -0.51
  - max_height: -0.18
  - bumpiness: -0.18
  - holes: -0.36
  - completed_lines: +0.76

#### Aggressive
- **Intent**: Tolerates higher stacks and some mess to keep speed/upside; lower line-clear reward than Balanced.
- **Weights**:
  - aggregate_height: -0.30
  - max_height: -0.12
  - bumpiness: -0.12
  - holes: -0.28
  - completed_lines: +0.50

#### Defensive
- **Intent**: Strongly minimize height/holes/bumpiness and highly reward clearing; keeps the board low and safe.
- **Weights**:
  - aggregate_height: -0.80
  - max_height: -0.90
  - bumpiness: -0.50
  - holes: -0.60
  - completed_lines: +1.20

#### 9-0
- **Intent**: Classic right-well Tetris. Build cleanly in the left 9 columns and keep the rightmost column open for I-tetrises. Strongly avoids holes and is willing to tuck to keep the stack clean. Burns are allowed when necessary.
- **Weights**:
  - aggregate_height: -0.55
  - max_height: -0.25
  - bumpiness: -0.15 (with well relief on the 8↔9 step)
  - holes: -0.85
  - completed_lines: +0.90
  - right_well_height_penalty: 0.30
  - right_well_fill_penalty: 0.40
  - tetris_ready_bonus: 0.35
  - bumpiness_well_relief: 0.15

Notes:
- The engine’s search already explores tuck/spin paths. This strategy’s weights encourage using those options to preserve a clean 9-0 stack.
- Hold and 7-bag awareness: the engine considers hold when beneficial. Dedicated long-term bag timing heuristics will be layered in future substrategies.

### How to switch strategies
- Use the “Strategy” buttons in the right-side rectangle (visible when Debug Mode is Off). Strategy changes apply live while the engine is running.

### Maintaining this document
- When adding a new strategy or changing weights:
  - Add the new preset in `WasmLoader.STRATEGY_MAP` and reflect UI weights in `WasmEngine.getUiEvalWeights`.
  - Update this file with the new strategy’s intent and exact weights.


