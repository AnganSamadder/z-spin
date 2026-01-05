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

#### Cheese
- **Intent**: Aggressive downstacking with strong anti-building and flatness penalties. Clears cheese lines efficiently while heavily penalizing building too high above cheese, wasting non-I pieces on building, and creating uneven surfaces. Maintains very flat, organized board.
- **Weights (UI subset)**:
  - aggregate_height: -0.40
  - max_height: -0.60
  - bumpiness: -0.50
  - holes: -0.80
  - completed_lines: +2.00
- **Rust-only shaping knobs**:
  - new_holes_penalty: 15.0 (moderate penalty to keep board cleaner)
  - weighted_holes: -0.05 (moderate penalty for cleanliness)
  - blocks_above_holes_penalty: -0.25 (reduced penalty on covering holes, height-weighted)
  - holes_cleared_bonus: +10.0 (very strong bonus for clearing holes)
  - non_tetris_clear_penalty_per_line: -1.00 (strongly rewards non-tetris clears)
  - cavity_cells: -0.50 (higher penalty on cavities for cleaner board)
  - cavity_cells_sq: -0.01 (higher quadratic penalty)
  - overhang_cells: -0.20 (higher penalty on overhangs)
  - overhang_cells_sq: -0.005 (higher quadratic penalty)
  - covered_cells: -0.10 (higher penalty on covered cells)
  - covered_cells_sq: -0.005 (higher quadratic scaling)
  - cheese_height_penalty: -10.0 (very heavy penalty for building >3 rows above cheese)
  - non_i_building_penalty: -2.0 (strong penalty for wasting non-I pieces on building)
  - left9_height_range: -0.30 (penalty for height differences across left 9 columns, encourages flat building)

### How to switch strategies
- Use the “Strategy” buttons in the right-side rectangle (visible when Debug Mode is Off). Strategy changes apply live while the engine is running.

### Maintaining this document
- When adding a new strategy or changing weights:
  - Add the new preset in `WasmLoader.STRATEGY_MAP` and reflect UI weights in `WasmEngine.getUiEvalWeights`.
  - Update this file with the new strategy’s intent and exact weights.

### Research notes
- **Cheese strategy**: Inspired by Cold Clear's downstacking techniques from [MinusKelvin/cold-clear](https://github.com/MinusKelvin/cold-clear). Key features include:
  - Cavity cells: Fully enclosed empty spaces (heavily penalized)
  - Overhang cells: Partially enclosed empty spaces (penalized)
  - Covered cells: Blocks above holes (with quadratic scaling)
  - Piece dependency awareness for hole filling
  - **Downstacking approach**: Research shows that effective downstacking requires prioritizing clearing over building clean. The strategy now uses very low penalties on height/bumpiness and strongly rewards any line clears (including singles/doubles) to encourage aggressive hole clearing rather than conservative tower building.
  - **Enhanced hole coverage penalty**: The AI now intelligently avoids placing blocks that would cover holes, with exponentially higher penalties for covering higher holes. This prevents the AI from making holes harder to fill by placing blocks on top of them.
  - **Non-I building penalty**: The AI is heavily penalized for using non-I pieces to build high above cheese instead of using them for clearing. This encourages using T/Z/S pieces for line clears rather than tower building.
  - **Enhanced flatness penalties**: Much stronger bumpiness penalty (-0.50) and new height range penalty (-0.30) encourage the AI to build very flat surfaces across all columns, preventing uneven tower building.


