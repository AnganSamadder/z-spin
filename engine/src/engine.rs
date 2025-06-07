use crate::board::Board;
use crate::pieces::PieceType;
use crate::search::SearchEngine;
use crate::console_log;
use crate::evaluation::Strategy;

pub struct TetrisEngine {
    search_engine: SearchEngine,
    current_move_sequence: Vec<String>,
    sequence_index: usize,
    expected_board: Option<Board>,
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
            expected_board: None,
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
        let board_obj = Board::from_flat_array(board);

        // Continue existing sequence if we have one and the board hasn't changed unexpectedly
        if !self.current_move_sequence.is_empty() && self.sequence_index < self.current_move_sequence.len() {
             if let Some(expected_board) = &self.expected_board {
                if expected_board.hash() == board_obj.hash() {
                    let next_move = self.current_move_sequence[self.sequence_index].clone();
                    self.sequence_index += 1;
                    return next_move;
                } else {
                    if self.debug {
                        console_log!("Board state changed unexpectedly. Was:");
                        expected_board.display_board("Expected", None);
                        console_log!("Is now:");
                        board_obj.display_board("Actual", None);
                    }
                }
            }
        }
        
        let piece_type = PieceType::from_i32(current_piece).unwrap_or(PieceType::I);
        let next_piece_type = PieceType::from_i32(next_piece);

        // Generate new move sequence
        let search_result = self.search_engine.search(&board_obj, piece_type, next_piece_type, strategy, self.arr, self.das, self.debug);
        self.current_move_sequence = search_result.best_move.split(',').map(String::from).collect();
        self.sequence_index = 0;

        let final_board = self.calculate_final_board(&board_obj, piece_type, &self.current_move_sequence);
        self.expected_board = Some(final_board);
        
        if !self.current_move_sequence.is_empty() {
            let next_move = self.current_move_sequence[self.sequence_index].clone();
            self.sequence_index += 1;
            next_move
        } else {
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

    fn calculate_final_board(&self, board: &Board, _piece_type: PieceType, _sequence: &Vec<String>) -> Board {
        board.clone()
    }
} 