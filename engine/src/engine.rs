use crate::board::Board;
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
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);

        // Generate new move sequence
        // TODO: Get actual current piece position from JavaScript interface
        // For now, using spawn position as default
        let current_x = 4; // Default spawn x position
        let current_y = 0; // Default spawn y position  
        let current_rotation = 0; // Default spawn rotation
        
        if self.debug {
            console_log!("🔄 ENGINE: Generating new sequence with spawn position ({}, {}) rotation {}", 
                         current_x, current_y, current_rotation);
        }
        
        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, strategy, self.arr, self.das, self.debug);
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
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);

        // TODO: Get actual current piece position from JavaScript interface
        // For now, using spawn position as default
        let current_x = 4; // Default spawn x position
        let current_y = 0; // Default spawn y position  
        let current_rotation = 0; // Default spawn rotation

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, strategy, self.arr, self.das, true); // Debug is true for this function
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
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);

        // Generate new move sequence using actual current piece position
        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, strategy, self.arr, self.das, self.debug);
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
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);
        let held_piece_type = PieceType::from_i32(held_piece);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, held_piece_type, can_hold, strategy, self.arr, self.das, self.debug);
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
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, None, true, strategy, self.arr, self.das, true); // Debug is true for this function
        search_result.best_move
    }

    // New: full sequence with hold info
    pub fn get_full_move_sequence_with_position_and_hold(&mut self, board: &[i32], current_piece_idx: i32, current_x: i32, current_y: i32, current_rotation: usize, next_piece_idx: i32, held_piece_idx: i32, can_hold: bool, strategy: Strategy) -> String {
        let board_obj = Board::from_flat_array(board);
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);
        let held_piece_type = PieceType::from_i32(held_piece_idx);

        let search_result = self.search_engine.search(&board_obj, piece_type, current_x, current_y, current_rotation, next_piece_type, held_piece_type, can_hold, strategy, self.arr, self.das, true);
        search_result.best_move
    }
} 