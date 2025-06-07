use crate::board::{Board};
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
}

pub struct SearchEngine {}

impl SearchEngine {
    pub fn new() -> Self {
        Self {}
    }

    pub fn search(&mut self, board: &Board, current_piece: PieceType, _next_piece: Option<PieceType>, strategy: Strategy, arr: u32, das: u32, debug: bool) -> SearchResult {
        let weights = EvaluationWeights::new(strategy);
        let (best_move, _placement) = self.find_best_move_for_strategy(board, current_piece, &weights, arr, das, debug);

        SearchResult {
            best_move,
        }
    }

    fn find_best_move_for_strategy(&self, board: &Board, current_piece: PieceType, weights: &EvaluationWeights, arr: u32, das: u32, debug: bool) -> (String, Placement) {
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
            return ("hard_drop".to_string(), Placement::default());
        }

        let (best_placement, _best_eval) = &all_evaluations[0];

        if debug {
            console_log!("🏆 WINNER: x={}, rot={} → SCORE={:.1}", best_placement.x, best_placement.rotation, all_evaluations[0].1.score);
            let mut final_board = board.clone();
            let final_piece = Piece::new(current_piece, best_placement.x, best_placement.y).with_rotation(best_placement.rotation);
            final_board.lock_piece(&final_piece);
            final_board.clear_lines();
            final_board.display_board("🎯 FINAL BOARD RESULT", Some(board));
        }

        // 🎯 SMART DROPPING LOGIC 🎯
        // Check if this placement requires tucking/spinning maneuvers
        let requires_complex_moves = self.requires_tucking_or_spinning(board, current_piece, best_placement);
        
        // Generate move sequence with appropriate soft drop allowance
        let move_sequence = self.generate_move_sequence(board, current_piece, best_placement, arr, das, requires_complex_moves);
        
        let mut final_sequence = move_sequence;
        
        if requires_complex_moves {
            // Complex placement that requires tucking/spinning - soft_drop may be used during pathfinding
            if debug {
                console_log!("🧠 SMART DROP: Complex placement detected - allowing soft_drop in pathfinding");
            }
            // Add hard_drop only if not already present in sequence
            if !final_sequence.iter().any(|m| m == "hard_drop" || m == "soft_drop") {
                final_sequence.push("soft_drop".to_string());
            }
        } else {
            // Simple placement - pathfinding avoided soft_drop, just add hard_drop
            if debug {
                console_log!("🧠 SMART DROP: Simple placement detected - using hard_drop only");
            }
            final_sequence.push("hard_drop".to_string());
        }
        
        let best_move = final_sequence.join(",");

        (best_move, best_placement.clone())
    }

    fn generate_all_placements(&self, board: &Board, piece_type: PieceType) -> Vec<Placement> {
        let mut placements = std::collections::HashSet::new();
        let mut queue = std::collections::VecDeque::new();
        let mut visited = std::collections::HashSet::new();
    
        let start_piece = Piece::spawn(piece_type);
    
        if board.can_place_piece(&start_piece) {
            queue.push_back(start_piece);
            visited.insert((start_piece.x, start_piece.y, start_piece.rotation));
        }
    
        while let Some(piece) = queue.pop_front() {
            // Check if landed
            if !board.can_place_piece(&piece.moved(0, 1)) {
                placements.insert(Placement::new(piece.x, piece.y, piece.rotation));
            }
    
            // Successor states
            let moves = [
                piece.moved(0, 1),   // Soft Drop
                piece.moved(1, 0),   // Right
                piece.moved(-1, 0),  // Left
                piece.rotated(true), // CW
                piece.rotated(false),// CCW
                piece.rotated_180(), // 180
            ];
    
            for next_piece in &moves {
                if visited.insert((next_piece.x, next_piece.y, next_piece.rotation)) {
                    if board.can_place_piece(next_piece) {
                        queue.push_back(*next_piece);
                    }
                }
            }
        }
    
        placements.into_iter().collect()
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
        })
    }

    fn generate_move_sequence(&self, board: &Board, piece_type: PieceType, placement: &Placement, _arr: u32, _das: u32, allow_soft_drops: bool) -> Vec<String> {
        use std::collections::{BinaryHeap, HashMap};
        use std::cmp::Ordering;

        #[derive(Clone, Eq, PartialEq)]
        struct State {
            cost: usize,
            piece: Piece,
            path: Vec<String>,
        }

        impl Ord for State {
            fn cmp(&self, other: &Self) -> Ordering {
                other.cost.cmp(&self.cost)
            }
        }
        
        impl PartialOrd for State {
            fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
                Some(self.cmp(other))
            }
        }

        let start_piece = Piece::spawn(piece_type);
        let mut dists = HashMap::new();
        let mut pq = BinaryHeap::new();

        dists.insert((start_piece.x, start_piece.y, start_piece.rotation), (0, Vec::new()));
        pq.push(State { cost: 0, piece: start_piece, path: Vec::new() });

        while let Some(State { cost, piece, path }) = pq.pop() {
            if cost > dists.get(&(piece.x, piece.y, piece.rotation)).unwrap_or(&(usize::MAX, Vec::new())).0 {
                continue;
            }

            // Different target conditions for simple vs complex placements
            let reached_target = if allow_soft_drops {
                // Complex placement: need exact coordinates
                piece.x == placement.x && piece.y == placement.y && piece.rotation == placement.rotation
            } else {
                // Simple placement: just need correct x and rotation, any y position is fine
                // We'll add hard_drop manually after pathfinding
                piece.x == placement.x && piece.rotation == placement.rotation
            };

            if reached_target {
                return path;
            }
            
            let mut moves: Vec<(Piece, &str, usize)> = Vec::new();
            
            // Basic moves - with adjusted costs to prioritize horizontal movement first
            moves.push((piece.rotated(true), "rotate", 5));          // Low cost - do rotations first
            moves.push((piece.rotated(false), "rotate_ccw", 5));     // Low cost - do rotations first  
            moves.push((piece.rotated_180(), "rotate_180", 5));      // Low cost - do rotations first
            moves.push((piece.moved(-1, 0), "move_left", 8));        // Medium cost - horizontal moves
            moves.push((piece.moved(1, 0), "move_right", 8));        // Medium cost - horizontal moves
            
            // For simple placements, heavily discourage move_down since we'll use hard_drop
            let move_down_cost = if allow_soft_drops { 25 } else { 1000 }; // Extreme penalty for simple placements
            moves.push((piece.moved(0, 1), "move_down", move_down_cost));

            // Soft drop - only allow if complex moves are permitted
            if allow_soft_drops {
                let mut sd_piece = piece.clone();
                while board.can_place_piece(&sd_piece.moved(0, 1)) {
                    sd_piece.y += 1;
                }
                if sd_piece.y > piece.y {
                    moves.push((sd_piece, "soft_drop", 12)); // Medium cost for multi-drop
                }
            }

            // DAS-like moves - prioritize these for efficient horizontal movement
            let mut left_das_piece = piece.clone();
            while board.can_place_piece(&left_das_piece.moved(-1, 0)) {
                left_das_piece.x -= 1;
            }
            if left_das_piece.x != piece.x {
                moves.push((left_das_piece, "move_to_left", 10)); // Lower cost for efficient movement
            }

            let mut right_das_piece = piece.clone();
            while board.can_place_piece(&right_das_piece.moved(1, 0)) {
                right_das_piece.x += 1;
            }
            if right_das_piece.x != piece.x {
                moves.push((right_das_piece, "move_to_right", 10)); // Lower cost for efficient movement
            }

            for (next_piece, action, action_cost) in moves {
                if board.can_place_piece(&next_piece) {
                    let next_key = (next_piece.x, next_piece.y, next_piece.rotation);
                    let new_cost = cost + action_cost;

                    if new_cost < dists.get(&next_key).unwrap_or(&(usize::MAX, Vec::new())).0 {
                        let mut new_path = path.clone();
                        new_path.push(action.to_string());
                        dists.insert(next_key, (new_cost, new_path.clone()));
                        pq.push(State { cost: new_cost, piece: next_piece, path: new_path });
                    }
                }
            }
        }
        
        // Fallback
        dists.get(&(placement.x, placement.y, placement.rotation))
            .map(|(_, path)| path.clone())
            .unwrap_or_else(|| vec![])
    }

    // Helper function to determine if a placement requires tucking/spinning
    fn requires_tucking_or_spinning(&self, board: &Board, piece_type: PieceType, placement: &Placement) -> bool {
        let start_piece = Piece::spawn(piece_type);
        
        // Check if we can reach the target placement with only simple moves
        // Simple sequence: Rotate -> Move horizontally -> Hard drop
        
        // Step 1: Check if we can rotate at the spawn position
        let rotated_piece = start_piece.with_rotation(placement.rotation);
        if !board.can_place_piece(&rotated_piece) {
            // Need to move/drop before rotating - this is a spin/tuck scenario
            return true;
        }
        
        // Step 2: Check if we can move horizontally to the target x position
        let positioned_piece = Piece::new(piece_type, placement.x, rotated_piece.y).with_rotation(placement.rotation);
        if !board.can_place_piece(&positioned_piece) {
            // Can't move to target x position at current height - need tucking
            return true;
        }
        
        // Step 3: Check if we can drop directly to the final position
        let mut drop_test_piece = positioned_piece;
        while board.can_place_piece(&drop_test_piece.moved(0, 1)) {
            drop_test_piece = drop_test_piece.moved(0, 1);
        }
        
        // If the final dropped position matches our target exactly, it's a simple placement
        if drop_test_piece.x == placement.x && drop_test_piece.y == placement.y && drop_test_piece.rotation == placement.rotation {
            return false; // Simple placement - just rotate, move, hard drop
        }
        
        // Additional heuristic: Check if the placement is "tucked" under overhangs
        // Look for filled cells above the placement position
        let target_piece = Piece::new(piece_type, placement.x, placement.y).with_rotation(placement.rotation);
        if let Some(mask) = target_piece.get_mask() {
            for (i, &row_mask) in mask.iter().enumerate() {
                if row_mask == 0 { continue; }
                
                let board_y = placement.y + i as i32;
                if board_y >= 0 && board_y < board.rows.len() as i32 {
                    // Check for filled cells above this piece's blocks
                    for bit_pos in 0..10 {
                        if (row_mask & (1 << bit_pos)) != 0 {
                            // This piece has a block at this position
                            // Check if there are any filled cells above it
                            for check_y in 0..board_y {
                                if check_y >= 0 && check_y < board.rows.len() as i32 {
                                    if board.get_cell(bit_pos, check_y as usize) {
                                        // Found a filled cell above - this likely requires tucking
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        false // Default to simple placement
    }
} 