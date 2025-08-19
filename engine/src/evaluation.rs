use crate::board::{Board, BOARD_WIDTH, BOARD_HEIGHT, VISIBLE_HEIGHT};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, Copy, PartialEq)]
pub enum Strategy {
    Balanced,
    Aggressive,
    Defensive,
    NineZero,
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
                new_holes_penalty: 0.0,
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
            },
        }
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

        Evaluation {
            score,
        }
    }
} 