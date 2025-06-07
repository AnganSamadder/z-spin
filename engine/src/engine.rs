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

        // Generate new move sequence
        let search_result = self.search_engine.search(&board_obj, piece_type, next_piece_type, strategy, self.arr, self.das, self.debug);
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

    pub fn get_full_move_sequence(&mut self, board: &[i32], current_piece_idx: i32, next_piece_idx: i32, strategy: Strategy) -> String {
        let board_obj = Board::from_flat_array(board);
        let piece_type = PieceType::from_i32(current_piece_idx).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece_idx);

        let search_result = self.search_engine.search(&board_obj, piece_type, next_piece_type, strategy, self.arr, self.das, true); // Debug is true for this function
        search_result.best_move
    }
} 