use crate::board::{Board, BOARD_WIDTH, BOARD_HEIGHT};
use crate::pieces::PieceType;
use crate::search::SearchEngine;
use crate::console_log;
use crate::evaluation::Strategy;

pub struct TetrisEngine {
    search_engine: SearchEngine,
    current_move_sequence: Vec<String>,
    sequence_index: usize,
    arr: u32,
    das: u32,
    sdf: u32,
    dcd: u32,
    debug: bool,
    recovery_target: Option<(usize, usize)>,
}

impl TetrisEngine {
    pub fn new() -> Self {
        Self {
            search_engine: SearchEngine::new(),
            current_move_sequence: Vec::new(),
            sequence_index: 0,
            arr: 16,
            das: 133,
            sdf: u32::MAX,
            dcd: 0,
            debug: false,
            recovery_target: None,
        }
    }

    pub fn configure_movement(&mut self, arr: u32, das: u32, sdf: u32, dcd: u32) {
        self.arr = arr;
        self.das = das;
        self.sdf = sdf;
        self.dcd = dcd;
        console_log!("[Config] Movement settings updated: ARR={}, DAS={}, SDF={}, DCD={}", self.arr, self.das, self.sdf, self.dcd);
    }

    pub fn configure_logging(&mut self, debug: bool) {
        self.debug = debug;
    }

    /// Determines the effective strategy to use, handling hole recovery logic.
    /// If NineZero is requested and a fully covered hole exists, switches to NineZeroRecovery.
    fn determine_strategy(&mut self, board: &Board, requested_strategy: Strategy) -> Strategy {
        if requested_strategy != Strategy::NineZero {
            // Reset recovery if user manually switches strategy or another strategy is used
            if self.recovery_target.is_some() {
                self.recovery_target = None;
            }
            return requested_strategy;
        }

        // Check if we are already in recovery mode
        if let Some((x, y)) = self.recovery_target {
             // Check if the target hole is still fully covered
             if board.is_fully_covered(x, y) {
                 if self.debug {
                     // crate::console_log!("⚠️ ENGINE: Recovering from covered hole at ({}, {})", x, y);
                 }
                 return Strategy::NineZeroRecovery;
             } else {
                 if self.debug {
                    crate::console_log!("✅ ENGINE: Hole at ({}, {}) resolved/uncovered! Resuming NineZero.", x, y);
                 }
                 self.recovery_target = None;
             }
        }

        // Not in recovery, check if we should enter it
        // Scan for fully covered holes
        for y in 0..BOARD_HEIGHT {
             for x in 0..BOARD_WIDTH {
                 if board.is_fully_covered(x, y) {
                     if self.debug {
                         crate::console_log!("🚨 ENGINE: Detected covered hole at ({}, {}). Switching to NineZeroRecovery.", x, y);
                     }
                     self.recovery_target = Some((x, y));
                     return Strategy::NineZeroRecovery;
                 }
             }
        }

        Strategy::NineZero
    }

    pub fn get_best_move(&mut self, board: &[i32], current_piece: i32, next_piece: i32, strategy: Strategy) -> String {
        if self.debug {
            console_log!("🎮 ENGINE: get_best_move called - piece: {}, next: {}", current_piece, next_piece);
        }
        
        // If a sequence is in progress, continue it.
        if self.sequence_index < self.current_move_sequence.len() {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            if self.debug {
                console_log!("📋 ENGINE: Continuing sequence - move {}/{}: '{}'", 
                             self.sequence_index, self.current_move_sequence.len(), next_move);
            }
            return next_move;
        }

        // Sequence is finished or not present. Generate a new one.
        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);

        // Generate new move sequence from spawn position
        let current_x = 4; // Default spawn x position
        let current_y = 0; // Default spawn y position  
        let current_rotation = 0; // Default spawn rotation
        
        if self.debug {
            console_log!("🔄 ENGINE: Generating new sequence with spawn position ({}, {}) rotation {}", 
                         current_x, current_y, current_rotation);
        }
        
        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, effective_strategy, self.arr, self.das, self.debug);
        self.current_move_sequence = search_result.best_move.split(',').map(String::from).collect();
        self.sequence_index = 0;
        
        if self.debug {
            console_log!("🎯 ENGINE: Search completed - sequence: '{}'", search_result.best_move);
        }
        
        if !self.current_move_sequence.is_empty() && self.current_move_sequence[0] != "" {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            next_move
        } else {
            // Fallback to hard_drop if the sequence is empty for some reason
            console_log!("⚠️ ENGINE: Empty sequence detected, using hard_drop fallback");
            self.current_move_sequence = vec!["hard_drop".to_string()];
            self.sequence_index = 1;
            "hard_drop".to_string()
        }
    }

    pub fn get_full_move_sequence(&mut self, board: &[i32], current_piece_idx: i32, next_piece_idx: i32, strategy: Strategy) -> String {
        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);

        // Generate new move sequence from spawn position
        let current_x = 4; // Default spawn x position
        let current_y = 0; // Default spawn y position  
        let current_rotation = 0; // Default spawn rotation

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, effective_strategy, self.arr, self.das, true); // Debug is true for this function
        search_result.best_move
    }

    /// New method that accepts current piece position for more accurate pathfinding
    pub fn get_best_move_with_position(&mut self, board: &[i32], current_piece: i32, current_x: i32, current_y: i32, current_rotation: usize, next_piece: i32, strategy: Strategy) -> String {
        // If a sequence is in progress, continue it.
        if self.sequence_index < self.current_move_sequence.len() {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            return next_move;
        }

        // Sequence is finished or not present. Generate a new one.
        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);

        // Generate new move sequence using actual current piece position
        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, effective_strategy, self.arr, self.das, self.debug);
        self.current_move_sequence = search_result.best_move.split(',').map(String::from).collect();
        self.sequence_index = 0;
        
        if !self.current_move_sequence.is_empty() && self.current_move_sequence[0] != "" {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            next_move
        } else {
            // Fallback to hard_drop if the sequence is empty for some reason
            self.current_move_sequence = vec!["hard_drop".to_string()];
            self.sequence_index = 1;
            "hard_drop".to_string()
        }
    }

    // New: accept hold info
    pub fn get_best_move_with_position_and_hold(&mut self, board: &[i32], current_piece: i32, current_x: i32, current_y: i32, current_rotation: usize, next_piece: i32, held_piece: i32, can_hold: bool, strategy: Strategy) -> String {
        if self.sequence_index < self.current_move_sequence.len() {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            return next_move;
        }

        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);
        let held_piece_type = PieceType::from_i32(held_piece);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, held_piece_type, can_hold, effective_strategy, self.arr, self.das, self.debug);
        self.current_move_sequence = search_result.best_move.split(',').map(String::from).collect();
        self.sequence_index = 0;
        if !self.current_move_sequence.is_empty() && self.current_move_sequence[0] != "" {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            next_move
        } else {
            self.current_move_sequence = vec!["hard_drop".to_string()];
            self.sequence_index = 1;
            "hard_drop".to_string()
        }
    }

    /// New method that returns full move sequence with current piece position
    pub fn get_full_move_sequence_with_position(&mut self, board: &[i32], current_piece_idx: i32, current_x: i32, current_y: i32, current_rotation: usize, next_piece_idx: i32, strategy: Strategy) -> String {
        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, effective_strategy, self.arr, self.das, true); // Debug is true for this function
        search_result.best_move
    }

    // New: full sequence with hold info
    pub fn get_full_move_sequence_with_position_and_hold(&mut self, board: &[i32], current_piece_idx: i32, current_x: i32, current_y: i32, current_rotation: usize, next_piece_idx: i32, held_piece_idx: i32, can_hold: bool, strategy: Strategy) -> String {
        let board_obj = Board::from_flat_array(board);
        let effective_strategy = self.determine_strategy(&board_obj, strategy);
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);
        let held_piece_type = PieceType::from_i32(held_piece_idx);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, held_piece_type, can_hold, effective_strategy, self.arr, self.das, true);
        search_result.best_move
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::{Board, BOARD_HEIGHT, BOARD_WIDTH};
    use crate::evaluation::Strategy;

    #[test]
    fn test_hole_recovery_switching() {
        let mut engine = TetrisEngine::new();
        let mut board = Board::new();
        
        // 1. Create a fully covered hole at (0, 0)
        // Walls cover Left, Down.
        // Needs Block Up (0, 1) and Right (1, 0).
        board.set_cell(0, 1, true); // Cover top
        board.set_cell(1, 0, true); // Cover right
        // (0,0) is empty.
        
        assert!(board.is_fully_covered(0, 0), "Hole at (0,0) should be fully covered");
        
        // 2. Check strategy - should switch to NineZeroRecovery
        let strat = engine.determine_strategy(&board, Strategy::NineZero);
        assert_eq!(strat, Strategy::NineZeroRecovery, "Should switch to NineZeroRecovery");
        assert_eq!(engine.recovery_target, Some((0, 0)), "Should target (0,0)");
        
        // 3. Uncover the hole (remove top cover)
        board.set_cell(0, 1, false);
        assert!(!board.is_fully_covered(0, 0), "Hole at (0,0) should not be covered");
        
        // 4. Check strategy - should switch back
        let strat = engine.determine_strategy(&board, Strategy::NineZero);
        assert_eq!(strat, Strategy::NineZero, "Should switch back to NineZero");
        assert_eq!(engine.recovery_target, None, "Recovery target should be cleared");
    }

    #[test]
    fn test_is_fully_covered_center() {
         let mut board = Board::new();
         // Hole at 5,5
         // Surround with blocks
         board.set_cell(5, 6, true); // Up
         board.set_cell(5, 4, true); // Down
         board.set_cell(4, 5, true); // Left
         board.set_cell(6, 5, true); // Right
         
         assert!(board.is_fully_covered(5, 5));
         
         // Remove one
         board.set_cell(5, 6, false);
         assert!(!board.is_fully_covered(5, 5));
    }
} 