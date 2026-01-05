use crate::board::{Board, BOARD_WIDTH, BOARD_HEIGHT, VISIBLE_HEIGHT};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, Copy, PartialEq)]
pub enum Strategy {
    Balanced,
    Aggressive,
    Defensive,
    NineZero,
    Cheese,
}

#[derive(Clone, Debug, Default)]
pub struct Evaluation {
    pub score: f64,
}

#[derive(Clone, Debug)]
pub struct EvaluationWeights {
    pub aggregate_height: f64,
    pub max_height: f64,
    pub bumpiness: f64,
    pub holes: f64,
    pub completed_lines: f64,
    // Additional knobs (default to 0 for legacy strategies)
    pub right_well_height_penalty: f64, // penalize blocks occupying column 9 (right well)
    pub right_well_fill_penalty: f64,   // flat penalty if any fill in column 9 remains after placement
    pub tetris_ready_bonus: f64,        // bonus per contiguous row that is filled in cols 0..8 and empty in col 9
    pub bumpiness_well_relief: f64,     // compensates bumpiness penalty for the (8,9) edge to allow a deep right well
    pub well_depth_without_i_penalty: f64, // penalty per level of well depth if I is not imminently available
    pub tetris_clear_bonus: f64,        // extra bonus applied when exactly 4 lines are cleared
    pub non_tetris_clear_penalty_per_line: f64, // penalty per line for non-tetris clears (1-3)
    pub bumpiness_left9: f64,           // bumpiness across columns 0..8 only (ignore right well step)
    pub left9_height_range: f64,        // range (max-min) of heights across columns 0..8
    pub new_holes_penalty: f64,         // heavy penalty per new hole created by the placement
    // Downstack/cheese-focused knobs
    pub weighted_holes: f64,            // penalize holes by amount of blocks above them (sum over blocks-above for each hole)
    pub blocks_above_holes_penalty: f64, // penalize blocks that sit above any hole in same column
    pub holes_cleared_bonus: f64,       // reward for reducing holes count with a placement
    // Advanced downstacking and board shaping features
    pub cavity_cells: f64,              // fully enclosed empty spaces (heavily penalized)
    pub cavity_cells_sq: f64,           // quadratic penalty for cavities
    pub overhang_cells: f64,            // partially enclosed empty spaces
    pub overhang_cells_sq: f64,         // quadratic penalty for overhangs
    pub covered_cells: f64,             // blocks above holes (linear)
    pub covered_cells_sq: f64,          // blocks above holes (quadratic scaling)
    // Cheese-specific height control
    pub cheese_height_penalty: f64,     // heavy penalty for building more than 3 rows above cheese
    pub non_i_building_penalty: f64,    // penalty for using non-I pieces to build high instead of clear
    
    // === NEW: Advanced board evaluation features ===
    // Row transitions (horizontal gaps penalty)
    pub row_transitions: f64,           // penalizes horizontal gaps within rows
    
    // Jeopardy and height zone penalties
    pub jeopardy: f64,                  // penalty for each row above 10 (danger zone)
    pub top_half_penalty: f64,          // extra penalty for height > 10
    pub top_quarter_penalty: f64,       // extra penalty for height > 15
    
    // Differentiated clear rewards (per clear type)
    pub clear1: f64,                    // single line clear (typically negative - punish)
    pub clear2: f64,                    // double line clear
    pub clear3: f64,                    // triple line clear
    pub clear4: f64,                    // Tetris (reward heavily)
    pub tspin1: f64,                    // T-spin single
    pub tspin2: f64,                    // T-spin double
    pub tspin3: f64,                    // T-spin triple
    pub mini_tspin1: f64,               // Mini T-spin single
    pub mini_tspin2: f64,               // Mini T-spin double
    
    // Per-column well preferences
    pub well_column: usize,             // preferred well column (0-9, default 9)
    pub well_depth_bonus: f64,          // bonus per level of well depth
    pub max_well_depth: usize,          // max well depth to reward (default 4)
}

impl EvaluationWeights {
    pub fn new(strategy: Strategy) -> Self {
        match strategy {
            Strategy::Balanced => Self {
                aggregate_height: -0.51,
                max_height: -0.18,
                bumpiness: -0.18,
                holes: -0.36,
                completed_lines: 0.76,
                right_well_height_penalty: 0.0,
                right_well_fill_penalty: 0.0,
                tetris_ready_bonus: 0.0,
                bumpiness_well_relief: 0.0,
                well_depth_without_i_penalty: 0.0,
                tetris_clear_bonus: 0.0,
                non_tetris_clear_penalty_per_line: 0.0,
                bumpiness_left9: 0.0,
                left9_height_range: 0.0,
                new_holes_penalty: 0.0,
                weighted_holes: 0.0,
                blocks_above_holes_penalty: 0.0,
                holes_cleared_bonus: 0.0,
                cavity_cells: -0.5,              // Mild cavity penalty
                cavity_cells_sq: 0.0,
                overhang_cells: -0.2,            // Mild overhang penalty
                overhang_cells_sq: 0.0,
                covered_cells: 0.0,
                covered_cells_sq: 0.0,
                cheese_height_penalty: 0.0,
                non_i_building_penalty: 0.0,
                // Advanced weight features
                row_transitions: -0.5,           // Mild penalty for fragmented rows
                jeopardy: 0.0,
                top_half_penalty: 0.0,
                top_quarter_penalty: 0.0,
                clear1: -1.0,                    // Slight punishment for singles
                clear2: 0.0,
                clear3: 0.0,
                clear4: 2.0,                     // Slight reward for Tetrises
                tspin1: 0.5,
                tspin2: 2.0,
                tspin3: 3.0,
                mini_tspin1: 0.0,
                mini_tspin2: 0.0,
                well_column: 9,                  // Right well default
                well_depth_bonus: 0.0,
                max_well_depth: 4,
            },
            Strategy::Aggressive => Self {
                aggregate_height: -0.3,
                max_height: -0.12,
                bumpiness: -0.12,
                holes: -0.28,
                completed_lines: 0.5,
                right_well_height_penalty: 0.0,
                right_well_fill_penalty: 0.0,
                tetris_ready_bonus: 0.0,
                bumpiness_well_relief: 0.0,
                well_depth_without_i_penalty: 0.0,
                tetris_clear_bonus: 0.0,
                non_tetris_clear_penalty_per_line: 0.0,
                bumpiness_left9: 0.0,
                left9_height_range: 0.0,
                new_holes_penalty: 0.0,
                weighted_holes: 0.0,
                blocks_above_holes_penalty: 0.0,
                holes_cleared_bonus: 0.0,
                cavity_cells: -0.3,              // Light cavity penalty for aggression
                cavity_cells_sq: 0.0,
                overhang_cells: -0.1,
                overhang_cells_sq: 0.0,
                covered_cells: 0.0,
                covered_cells_sq: 0.0,
                cheese_height_penalty: 0.0,
                non_i_building_penalty: 0.0,
                // Advanced weight features - aggressive favors attack over safety
                row_transitions: -0.3,
                jeopardy: 0.0,                   // No jeopardy - aggressive takes risks
                top_half_penalty: 0.0,
                top_quarter_penalty: 0.0,
                clear1: 0.0,                     // Don't punish singles when attacking
                clear2: 1.0,
                clear3: 2.0,
                clear4: 4.0,                     // Reward Tetrises for attack
                tspin1: 1.5,                     // Reward T-spins for attack
                tspin2: 4.0,
                tspin3: 6.0,
                mini_tspin1: 0.5,
                mini_tspin2: 1.0,
                well_column: 9,
                well_depth_bonus: 0.0,
                max_well_depth: 4,
            },
            Strategy::Defensive => Self {
                aggregate_height: -0.8,
                max_height: -0.9,
                bumpiness: -0.5,
                holes: -0.6,
                completed_lines: 1.2,
                right_well_height_penalty: 0.0,
                right_well_fill_penalty: 0.0,
                tetris_ready_bonus: 0.0,
                bumpiness_well_relief: 0.0,
                well_depth_without_i_penalty: 0.0,
                tetris_clear_bonus: 0.0,
                non_tetris_clear_penalty_per_line: 0.0,
                bumpiness_left9: 0.0,
                left9_height_range: 0.0,
                new_holes_penalty: 5.0,
                weighted_holes: 0.0,
                blocks_above_holes_penalty: 0.0,
                holes_cleared_bonus: 0.0,
                cavity_cells: -2.0,              // Strong cavity penalty
                cavity_cells_sq: -0.1,
                overhang_cells: -1.0,
                overhang_cells_sq: -0.05,
                covered_cells: -0.5,
                covered_cells_sq: -0.02,
                cheese_height_penalty: 0.0,
                non_i_building_penalty: 0.0,
                // Advanced weight features - defensive prioritizes survival
                row_transitions: -0.8,           // Strong penalty for fragmented rows
                jeopardy: -0.5,                  // Penalize each row above 10
                top_half_penalty: -5.0,          // Strong penalty for height > 10
                top_quarter_penalty: -15.0,      // Very strong penalty for height > 15
                clear1: -2.0,                    // Punish singles (inefficient)
                clear2: 0.0,
                clear3: 1.0,
                clear4: 5.0,                     // Reward Tetrises
                tspin1: 1.0,
                tspin2: 3.0,
                tspin3: 5.0,
                mini_tspin1: 0.0,
                mini_tspin2: 0.0,
                well_column: 9,
                well_depth_bonus: 0.5,           // Slight well depth bonus
                max_well_depth: 4,
            },
            Strategy::NineZero => Self {
                // Core weights: play clean, reward clears, very anti-holes
                aggregate_height: -0.62,
                max_height: -0.35,
                bumpiness: -0.05, // rely primarily on left9 bumpiness
                holes: -1.20,
                completed_lines: 0.5,
                // 9-0 specific knobs
                right_well_height_penalty: 1.20,
                right_well_fill_penalty: 2.00,
                tetris_ready_bonus: 1.00,
                // Offset bumpiness penalty at the 8↔9 step so a deep well isn't punished
                bumpiness_well_relief: 0.60,
                // Discourage aggressive well-deepening if an I is not soon available
                well_depth_without_i_penalty: 0.50,
                // Strongly prefer Tetrises; discourage non-Tetris clears
                tetris_clear_bonus: 40.0,
                non_tetris_clear_penalty_per_line: 10.0,
                // Flatter left 9 columns
                bumpiness_left9: -0.60,
                left9_height_range: -0.20,
                // New holes are extremely undesirable in 9-0
                new_holes_penalty: 50.0,
                weighted_holes: 0.0,
                blocks_above_holes_penalty: 0.0,
                holes_cleared_bonus: 0.0,
                cavity_cells: -1.0,              // Moderate cavity penalty
                cavity_cells_sq: -0.05,
                overhang_cells: -0.5,
                overhang_cells_sq: -0.02,
                covered_cells: -0.3,
                covered_cells_sq: -0.01,
                cheese_height_penalty: 0.0,
                non_i_building_penalty: 0.0,
                // Advanced weight features - NineZero is Tetris-focused
                row_transitions: -0.5,           // Mild penalty for fragmented rows
                jeopardy: 0.0,                   // No jeopardy - 9-0 intentionally builds
                top_half_penalty: 0.0,
                top_quarter_penalty: -10.0,      // Penalty only in danger zone
                clear1: -10.0,                   // Heavily punish singles (breaks efficiency)
                clear2: -5.0,                    // Punish doubles
                clear3: -2.0,                    // Slight punishment for triples
                clear4: 40.0,                    // Heavily reward Tetrises
                tspin1: 1.0,
                tspin2: 3.0,
                tspin3: 5.0,
                mini_tspin1: -1.0,               // Punish mini T-spins (wasteful)
                mini_tspin2: 0.0,
                well_column: 9,                  // Right well for 9-0
                well_depth_bonus: 2.0,           // Strong well depth bonus
                max_well_depth: 4,
            },
            Strategy::Cheese => Self {
                // Balanced downstacking: clear cheese while maintaining cleaner board
                aggregate_height: -0.40,    // Much stronger penalty on height to prevent building up
                max_height: -0.60,          // Very strong penalty on max height
                bumpiness: -1.00,           // Strong penalty on bumpiness to force flat stacking
                holes: -0.80,               // Much higher penalty on holes for cleaner board
                completed_lines: 2.00,      // Very strongly reward any line clears
                right_well_height_penalty: 0.0,
                right_well_fill_penalty: 0.0,
                tetris_ready_bonus: 0.0,
                bumpiness_well_relief: 0.0,
                well_depth_without_i_penalty: 0.0,
                tetris_clear_bonus: 0.0,
                // Aggressively reward any line clears while downstacking
                non_tetris_clear_penalty_per_line: -1.00, // Strongly reward non-tetris clears
                bumpiness_left9: 0.0,
                // Low penalty for new holes (prioritize clearing over avoiding)
                new_holes_penalty: 15.0,   // Higher penalty for new holes to keep cleaner
                // Moderate downstack shaping
                weighted_holes: -0.05,      // Higher penalty on weighted holes for cleanliness
                blocks_above_holes_penalty: -0.25, // Reduced penalty on covering holes (height-weighted)
                holes_cleared_bonus: 15.00, // Very strong bonus for clearing holes
                // Strong downstack penalties for cheese clearing
                cavity_cells: -0.5,         // Drastically reduced to encourage layering/flattening
                cavity_cells_sq: -0.01,     // Minimal quadratic
                overhang_cells: -0.2,       // Low penalty
                overhang_cells_sq: -0.01,   // Minimal quadratic
                covered_cells: -0.1,        // Very low penalty
                covered_cells_sq: -0.00,    // Negligible
                // Heavy penalty for building too high above cheese
                cheese_height_penalty: -10.0, // Penalize building >3 rows above cheese
                // Penalty for using non-I pieces to build high instead of clear
                non_i_building_penalty: -2.0, // Strong penalty for wasting non-I pieces on building
                // Additional flatness incentives
                left9_height_range: -0.30,   // Penalize height range in left 9 columns for flatter building
                // Advanced weight features - Cheese needs strong downstack pressure
                row_transitions: -0.4,       // Reduced from -0.8 to reduce edge-stacking bias
                jeopardy: -1.0,              // Strong penalty per row above 10
                top_half_penalty: -8.0,      // Heavy penalty for height > 10
                top_quarter_penalty: -20.0,  // Very heavy penalty for height > 15 (danger zone)
                clear1: 4.0,                 // Reward singles
                clear2: 6.0,                 // Reward doubles
                clear3: 8.0,                 // Reward triples
                clear4: 12.0,                // Reward Tetrises
                tspin1: 2.0,                 // Reward T-spin singles
                tspin2: 4.0,                 // Reward T-spin doubles
                tspin3: 6.0,                 // Reward T-spin triples
                mini_tspin1: 0.5,
                mini_tspin2: 1.0,
                well_column: 9,
                well_depth_bonus: 0.0,       // No well bonus for cheese clearing
                max_well_depth: 2,           // Shallow well max
            },
        }
    }
}

impl Board {
    /// Evaluates cavities and overhangs in the playfield.
    /// Cavities are fully enclosed empty spaces, while overhangs are partially enclosed.
    /// Returns (cavity_cells, overhang_cells)
    fn get_cavities_and_overhangs(&self) -> (f64, f64) {
        let mut cavities = 0.0;
        let mut overhangs = 0.0;
        let heights = self.get_heights();
        let max_height = *heights.iter().max().unwrap_or(&0);

        for y in 0..max_height {
            for x in 0..BOARD_WIDTH {
                if self.get_cell(x, y) || y >= heights[x] {
                    continue;
                }

                // Check if this is an overhang (partially enclosed)
                let mut is_overhang = false;
                
                // Check left side overhang
                if x > 1 {
                    if heights[x - 1] <= y.saturating_sub(1) && heights[x - 2] <= y {
                        overhangs += 1.0;
                        is_overhang = true;
                    }
                }

                // Check right side overhang
                if !is_overhang && x < BOARD_WIDTH - 2 {
                    if heights[x + 1] <= y.saturating_sub(1) && heights[x + 2] <= y {
                        overhangs += 1.0;
                        is_overhang = true;
                    }
                }

                // If not an overhang, it's a cavity
                if !is_overhang {
                    cavities += 1.0;
                }
            }
        }

        (cavities, overhangs)
    }

    /// Evaluates how many blocks are covering existing holes in the stack.
    /// Returns (covered_cells, covered_cells_sq)
    fn get_covered_cells(&self) -> (f64, f64) {
        let mut covered = 0.0;
        let mut covered_sq = 0.0;
        let heights = self.get_heights();

        for x in 0..BOARD_WIDTH {
            for y in (0..heights[x].saturating_sub(2)).rev() {
                if !self.get_cell(x, y) {
                    let cells = 6.min(heights[x] - y - 1);
                    covered += cells as f64;
                    covered_sq += (cells * cells) as f64;
                }
            }
        }

        (covered, covered_sq)
    }
}

impl Default for EvaluationWeights {
    fn default() -> Self {
        Self {
            aggregate_height: -0.51,
            max_height: -0.18,
            bumpiness: -0.18,
            holes: -0.36,
            completed_lines: 0.76,
            right_well_height_penalty: 0.0,
            right_well_fill_penalty: 0.0,
            tetris_ready_bonus: 0.0,
            bumpiness_well_relief: 0.0,
            well_depth_without_i_penalty: 0.0,
            tetris_clear_bonus: 0.0,
            non_tetris_clear_penalty_per_line: 0.0,
            bumpiness_left9: 0.0,
            left9_height_range: 0.0,
            new_holes_penalty: 0.0,
            weighted_holes: 0.0,
            blocks_above_holes_penalty: 0.0,
            holes_cleared_bonus: 0.0,
            cavity_cells: 0.0,
            cavity_cells_sq: 0.0,
            overhang_cells: 0.0,
            overhang_cells_sq: 0.0,
            covered_cells: 0.0,
            covered_cells_sq: 0.0,
            cheese_height_penalty: 0.0,
            non_i_building_penalty: 0.0,
            // Advanced weight features - all disabled by default
            row_transitions: 0.0,
            jeopardy: 0.0,
            top_half_penalty: 0.0,
            top_quarter_penalty: 0.0,
            clear1: 0.0,
            clear2: 0.0,
            clear3: 0.0,
            clear4: 0.0,
            tspin1: 0.0,
            tspin2: 0.0,
            tspin3: 0.0,
            mini_tspin1: 0.0,
            mini_tspin2: 0.0,
            well_column: 9,
            well_depth_bonus: 0.0,
            max_well_depth: 4,
        }
    }
}

impl Board {
    pub fn evaluate(&self, weights: &EvaluationWeights) -> Evaluation {
        let (total_height, max_height, holes, bumpiness) = self.get_evaluation_metrics();

        // Base score from classic features
        let mut score =
            total_height * weights.aggregate_height
                + max_height * weights.max_height
                + holes * weights.holes
                + bumpiness * weights.bumpiness;

        // Cheese/downstack specific metrics if enabled
        if weights.weighted_holes != 0.0 || weights.blocks_above_holes_penalty != 0.0 {
            let mut weighted_holes_sum = 0.0;
            let mut hole_coverage_penalty = 0.0;
            
            for x in 0..BOARD_WIDTH {
                // Find all holes in this column and their heights
                let mut holes_in_column = Vec::new();
                let mut blocks_above = 0usize;
                
                for y in 0..BOARD_HEIGHT {
                    let filled = self.get_cell(x, y);
                    if filled {
                        blocks_above += 1;
                    } else if blocks_above > 0 {
                        // This is a hole: record its position and weight
                        holes_in_column.push((y, blocks_above));
                        weighted_holes_sum += blocks_above as f64;
                    }
                }
                
                // Calculate hole coverage penalty with height weighting
                for (hole_y, _blocks_above_hole) in holes_in_column {
                    // Higher holes (lower y values) get exponentially more weight
                    // Convert y to height from bottom (higher = more important)
                    let height_from_bottom = BOARD_HEIGHT - hole_y;
                    let height_weight = (height_from_bottom as f64).powf(1.5); // Exponential weighting
                    
                    // Count blocks that would cover this hole if placed above it
                    let mut covering_blocks = 0usize;
                    for y in 0..hole_y {
                        if self.get_cell(x, y) {
                            covering_blocks += 1;
                        }
                    }
                    
                    // Penalty increases with both height and number of covering blocks
                    hole_coverage_penalty += height_weight * covering_blocks as f64;
                }
            }
            
            score += weighted_holes_sum * weights.weighted_holes;
            score += hole_coverage_penalty * weights.blocks_above_holes_penalty;
        }

        // Advanced downstacking evaluation metrics
        if weights.cavity_cells != 0.0 || weights.overhang_cells != 0.0 || weights.covered_cells != 0.0 {
            let (cavity_cells, overhang_cells) = self.get_cavities_and_overhangs();
            let (covered_cells, covered_cells_sq) = self.get_covered_cells();
            
            score += cavity_cells * weights.cavity_cells;
            score += (cavity_cells * cavity_cells) * weights.cavity_cells_sq;
            score += overhang_cells * weights.overhang_cells;
            score += (overhang_cells * overhang_cells) * weights.overhang_cells_sq;
            score += covered_cells * weights.covered_cells;
            score += covered_cells_sq * weights.covered_cells_sq;
        }

        // Cheese height penalty: heavily penalize building too high above cheese
        if weights.cheese_height_penalty != 0.0 {
            let cheese_penalty = self.get_cheese_height_penalty();
            score += cheese_penalty * weights.cheese_height_penalty;
        }

        // Non-I building penalty: penalize using non-I pieces to build high instead of clear
        if weights.non_i_building_penalty != 0.0 {
            let non_i_penalty = self.get_non_i_building_penalty();
            score += non_i_penalty * weights.non_i_building_penalty;
        }

        // Height range penalty: encourage flatter building across columns
        if weights.left9_height_range != 0.0 {
            let height_range_penalty = self.get_height_range_penalty();
            score += height_range_penalty * weights.left9_height_range;
        }

        // 9-0 specific shaping if knobs are non-zero
        if weights.right_well_height_penalty != 0.0
            || weights.right_well_fill_penalty != 0.0
            || weights.tetris_ready_bonus != 0.0
            || weights.bumpiness_well_relief != 0.0
            || weights.well_depth_without_i_penalty != 0.0
            || weights.bumpiness_left9 != 0.0
            || weights.left9_height_range != 0.0
        {
            // Recompute local helpers cheaply
            let heights = self.get_heights();
            let right_col = BOARD_WIDTH - 1;
            let right_h = heights[right_col] as f64;
            let start_row = BOARD_HEIGHT - VISIBLE_HEIGHT;
            let mut right_fill_rows = 0.0;
            let mut tetris_ready_rows = 0.0;
            for y in start_row..BOARD_HEIGHT {
                let left_full = (0..right_col).all(|x| self.get_cell(x, y));
                let right_full = self.get_cell(right_col, y);
                if right_full { right_fill_rows += 1.0; }
                if left_full && !right_full { tetris_ready_rows += 1.0; }
            }

            // Penalize any height/blocks in the right well (prefer an open well)
            score += -weights.right_well_height_penalty * right_h;
            score += -weights.right_well_fill_penalty * right_fill_rows;

            // Reward rows that are Tetris-ready (0..8 full, 9 empty)
            score += weights.tetris_ready_bonus * tetris_ready_rows;

            // Reduce bumpiness impact of the 8↔9 edge to allow deep well
            if weights.bumpiness_well_relief > 0.0 {
                let step = (heights[right_col - 1] as f64 - heights[right_col] as f64).abs();
                score += weights.bumpiness_well_relief * step; // offset the global bumpiness penalty
            }

            // Penalize deepening the well when an I is not imminent (search layer decides imminence; here only shape by depth)
            if weights.well_depth_without_i_penalty > 0.0 {
                score += -weights.well_depth_without_i_penalty * right_h.max(0.0);
            }

            // Flatter left 9 columns: bumpiness and height range (ignore right well)
            if weights.bumpiness_left9 != 0.0 || weights.left9_height_range != 0.0 {
                let left_heights = &heights[0..right_col]; // 0..=8
                let mut bump_l9 = 0.0;
                for i in 0..left_heights.len().saturating_sub(1) {
                    bump_l9 += (left_heights[i] as f64 - left_heights[i + 1] as f64).abs();
                }
                let min_h = *left_heights.iter().min().unwrap_or(&0) as f64;
                let max_h_l9 = *left_heights.iter().max().unwrap_or(&0) as f64;
                let range_l9 = (max_h_l9 - min_h).max(0.0);
            score += bump_l9 * weights.bumpiness_left9;
                score += range_l9 * weights.left9_height_range;
            }
        }

        // ==== Advanced evaluation feature calculations =====
        
        // Row transitions: count horizontal gaps in each row
        if weights.row_transitions != 0.0 {
            let heights = self.get_heights();
            let max_height = *heights.iter().max().unwrap_or(&0);
            let mut transitions = 0.0;
            for y in 0..max_height {
                let mut prev_filled = true; // Left wall is solid
                for x in 0..BOARD_WIDTH {
                    let filled = self.get_cell(x, y);
                    if filled != prev_filled {
                        transitions += 1.0;
                    }
                    prev_filled = filled;
                }
                // Right wall is solid
                if !prev_filled {
                    transitions += 1.0;
                }
            }
            score += transitions * weights.row_transitions;
        }

        // Jeopardy and height zone penalties
        if weights.jeopardy != 0.0 || weights.top_half_penalty != 0.0 || weights.top_quarter_penalty != 0.0 {
            let heights = self.get_heights();
            let max_height = *heights.iter().max().unwrap_or(&0) as f64;
            
            // Jeopardy: penalty per row above 10
            let rows_above_10 = (max_height - 10.0).max(0.0);
            score += rows_above_10 * weights.jeopardy;
            
            // Top half penalty: extra penalty for height > 10
            score += rows_above_10 * weights.top_half_penalty;
            
            // Top quarter penalty: extra penalty for height > 15
            let rows_above_15 = (max_height - 15.0).max(0.0);
            score += rows_above_15 * weights.top_quarter_penalty;
        }

        // Configurable well depth bonus
        if weights.well_depth_bonus != 0.0 {
            let heights = self.get_heights();
            let well_col = weights.well_column.min(BOARD_WIDTH - 1);
            let well_height = heights[well_col];
            
            // Find well depth by checking adjacent columns
            let mut well_depth = 0usize;
            // Use 100 (or BOARD_HEIGHT) for wall height
            let left_height = if well_col > 0 { heights[well_col - 1] } else { 100 };
            let right_height = if well_col < BOARD_WIDTH - 1 { heights[well_col + 1] } else { 100 };
            let adjacent_min = left_height.min(right_height);
            
            if well_height < adjacent_min {
                well_depth = (adjacent_min - well_height).min(weights.max_well_depth);
            }
            
            score += well_depth as f64 * weights.well_depth_bonus;
        }

        Evaluation {
            score,
        }
    }
}