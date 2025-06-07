use crate::board::{Board, BOARD_HEIGHT, BOARD_WIDTH};
use crate::pieces::{PieceType, Piece, Placement};
use crate::console_log;
use crate::evaluation::{Strategy, EvaluationWeights};

#[derive(Clone, Debug, Default)]
pub struct SearchResult {
    pub best_move: String,
}

#[derive(Clone, Debug)]
pub struct PlacementEvaluation {
    pub score: f64,
    pub predicted_board: Board,
}

pub struct SearchEngine {}

impl SearchEngine {
    pub fn new() -> Self {
        Self {}
    }

    pub fn search(&mut self, board: &Board, current_piece: PieceType, _next_piece: Option<PieceType>, strategy: Strategy, arr: u32, das: u32, debug: bool) -> SearchResult {
        let weights = EvaluationWeights::new(strategy);
        let best_move = self.find_best_move_for_strategy(board, current_piece, &weights, arr, das, debug);

        SearchResult {
            best_move,
        }
    }

    fn find_best_move_for_strategy(&self, board: &Board, current_piece: PieceType, weights: &EvaluationWeights, arr: u32, das: u32, debug: bool) -> String {
        if debug {
            console_log!("🚀🚀🚀 === TETRIS AI ANALYSIS START === 🚀🚀🚀");
            console_log!("🧩 Analyzing piece: {:?}", current_piece);
            board.display_board("📋 ORIGINAL BOARD STATE", None);
        }

        let all_placements = self.generate_all_placements(board, current_piece);

        let mut all_evaluations: Vec<(Placement, PlacementEvaluation)> = all_placements
            .into_iter()
            .filter_map(|placement| {
                self.evaluate_placement(board, current_piece, &placement, weights)
                    .map(|eval| (placement, eval))
            })
            .collect();

        all_evaluations.sort_by(|a, b| b.1.score.partial_cmp(&a.1.score).unwrap_or(std::cmp::Ordering::Equal));

        if all_evaluations.is_empty() {
            return "hard_drop".to_string();
        }

        let (best_placement, best_eval) = &all_evaluations[0];

        if debug {
            console_log!("🏆 WINNER: x={}, rot={} → SCORE={:.1}", best_placement.x, best_placement.rotation, best_eval.score);
            best_eval.predicted_board.display_board("🎯 FINAL BOARD RESULT", Some(board));
        }

        let move_sequence = self.generate_move_sequence(board, current_piece, best_placement, arr, das);
        let best_move = move_sequence.join(",");

        best_move
    }

    fn generate_all_placements(&self, board: &Board, piece_type: PieceType) -> Vec<Placement> {
        let mut placements = Vec::new();
        let mut visited = std::collections::HashSet::new();
        
        for rotation in 0..4 {
            for x in -2..BOARD_WIDTH as i32 + 2 {
                let piece = Piece::new(piece_type, x, 0).with_rotation(rotation);
                if let Some(landing_y) = self.find_landing_position(board, &piece) {
                    let placement = Placement::new(piece.x, landing_y, rotation);
                    if visited.insert(placement) {
                        placements.push(placement);
                    }
                }
            }
        }
        placements
    }
    
    fn find_landing_position(&self, board: &Board, piece: &Piece) -> Option<i32> {
        let mut test_piece = piece.clone();
        test_piece.y = 0;
        
        if !board.can_place_piece(&test_piece) {
            return None;
        }
        
        while board.can_place_piece(&test_piece.moved(0, 1)) {
            test_piece.y += 1;
            if test_piece.y > BOARD_HEIGHT as i32 { return None; }
        }
        Some(test_piece.y)
    }

    fn evaluate_placement(&self, board: &Board, piece_type: PieceType, placement: &Placement, weights: &EvaluationWeights) -> Option<PlacementEvaluation> {
        let piece = Piece::new(piece_type, placement.x, placement.y).with_rotation(placement.rotation);
        if !board.can_place_piece(&piece) {
            return None;
        }

        let mut predicted_board = board.clone();
        predicted_board.lock_piece(&piece);
        predicted_board.clear_lines();
        
        let _heights_after = predicted_board.get_heights();

        Some(PlacementEvaluation {
            score: predicted_board.evaluate(weights).score,
            predicted_board,
        })
    }

    fn generate_move_sequence(&self, board: &Board, piece_type: PieceType, placement: &Placement, arr: u32, das: u32) -> Vec<String> {
        use std::collections::{BinaryHeap, HashMap};
        use std::cmp::Ordering;

        #[derive(Clone, Eq, PartialEq)]
        struct State { cost: usize, piece: Piece, path: Vec<String> }

        impl Ord for State {
            fn cmp(&self, other: &Self) -> Ordering {
                other.cost.cmp(&self.cost).then_with(|| self.path.len().cmp(&other.path.len()))
            }
        }

        impl PartialOrd for State {
            fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) }
        }

        let start_piece = Piece::spawn(piece_type);
        let start_state = State { cost: 0, piece: start_piece.clone(), path: Vec::new() };
        let mut open_set = BinaryHeap::new();
        open_set.push(start_state);
        let mut visited = HashMap::new();
        visited.insert((start_piece.x, start_piece.rotation), 0);

        while let Some(State { cost, piece, path }) = open_set.pop() {
            if piece.x == placement.x && piece.rotation == placement.rotation {
                let mut final_path = path;
                final_path.push("hard_drop".to_string());
                return final_path;
            }

            if cost > *visited.get(&(piece.x, piece.rotation)).unwrap_or(&usize::MAX) { continue; }

            let mut moves: Vec<(Piece, &str, usize)> = Vec::new();
            moves.push((piece.rotated(true), "rotate", 1));
            moves.push((piece.rotated(false), "rotate_ccw", 1));
            moves.push((piece.moved(-1, 0), "move_left", 1));
            moves.push((piece.moved(1, 0), "move_right", 1));

            if arr == 0 {
                let mut left_piece = piece.clone();
                while board.can_place_piece(&left_piece.moved(-1, 0)) { left_piece = left_piece.moved(-1, 0); }
                if left_piece.x != piece.x { moves.push((left_piece, "move_all_the_way_left", das as usize)); }
                
                let mut right_piece = piece.clone();
                while board.can_place_piece(&right_piece.moved(1, 0)) { right_piece = right_piece.moved(1, 0); }
                if right_piece.x != piece.x { moves.push((right_piece, "move_all_the_way_right", das as usize)); }
            }

            for (next_piece, action, action_cost) in moves {
                if board.can_place_piece(&next_piece) {
                    let new_cost = cost + action_cost;
                    let state_key = (next_piece.x, next_piece.rotation);
                    if new_cost < *visited.get(&state_key).unwrap_or(&usize::MAX) {
                        visited.insert(state_key, new_cost);
                        let mut new_path = path.clone();
                        new_path.push(action.to_string());
                        open_set.push(State { cost: new_cost, piece: next_piece, path: new_path });
                    }
                }
            }
        }
        vec!["hard_drop".to_string()]
    }
} 