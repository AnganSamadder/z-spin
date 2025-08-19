use crate::board::{Board};
use crate::pieces::{PieceType, Piece, Placement};
use crate::console_log;
use crate::evaluation::{Strategy, EvaluationWeights};
use std::collections::{HashSet, VecDeque};

#[derive(Clone, Debug, Default)]
pub struct SearchResult {
    pub best_move: String,
}

#[derive(Clone, Debug)]
pub struct PlacementEvaluation {
    pub score: f64,
    pub landed_y: i32,
}

pub struct SearchEngine {}

impl SearchEngine {
    pub fn new() -> Self {
        Self {}
    }

    pub fn search(&mut self, board: &Board, current_piece: PieceType, current_x: i32, current_y: i32, current_rotation: usize, _next_piece: Option<PieceType>, held_piece: Option<PieceType>, can_hold: bool, strategy: Strategy, arr: u32, das: u32, debug: bool) -> SearchResult {
        let weights = EvaluationWeights::new(strategy);
        let (seq_curr, _placement_curr, score_curr) = self.find_best_move_for_strategy(board, current_piece, current_x, current_y, current_rotation, &weights, arr, das, debug);

        // Consider hold option if available
        let mut final_sequence = seq_curr.clone();

        if can_hold {
            if let Some(hold_type) = held_piece {
                // Start from spawn state of held piece
                let spawn = Piece::spawn(hold_type);
                let (seq_hold, _placement_hold, mut score_hold) = self.find_best_move_for_strategy(board, hold_type, spawn.x, spawn.y, spawn.rotation, &weights, arr, das, debug);
                // Apply small penalty for using hold to break ties against switching
                score_hold -= 0.5;
                if score_hold > score_curr {
                    final_sequence = if seq_hold.is_empty() { "hold".to_string() } else { format!("hold,{}", seq_hold) };
                }
            } else {
                // No held piece yet: holding swaps current into hold and spawns next
                // Use _next_piece if provided
                if let Some(next_type) = _next_piece {
                    let spawn = Piece::spawn(next_type);
                    let (seq_hold, _placement_hold, mut score_hold) = self.find_best_move_for_strategy(board, next_type, spawn.x, spawn.y, spawn.rotation, &weights, arr, das, debug);
                    score_hold -= 0.5;
                    if score_hold > score_curr {
                        final_sequence = if seq_hold.is_empty() { "hold".to_string() } else { format!("hold,{}", seq_hold) };
                    }
                }
            }
        }

        SearchResult { best_move: final_sequence }
    }

    fn find_best_move_for_strategy(&self, board: &Board, current_piece: PieceType, current_x: i32, current_y: i32, current_rotation: usize, weights: &EvaluationWeights, arr: u32, das: u32, debug: bool) -> (String, Placement, f64) {
        if debug {
            console_log!("🚀🚀🚀 === TETRIS AI ANALYSIS START === 🚀🚀🚀");
            console_log!("🧩 Analyzing piece: {:?} at position ({}, {}) rotation {}", current_piece, current_x, current_y, current_rotation);
            console_log!("⚙️ Movement config: ARR={}, DAS={}", arr, das);
            board.display_board("📋 ORIGINAL BOARD STATE", None);
            
            // 🎯 VISUAL DEBUG: Show current piece position on the board
            let mut start_visual_board = board.clone();
            let current_piece_obj = Piece::new(current_piece, current_x, current_y).with_rotation(current_rotation);
            if let Some(mask) = current_piece_obj.get_mask() {
                for (i, &row_mask) in mask.iter().enumerate() {
                    if row_mask == 0 { continue; }
                    let board_y = current_y + i as i32;
                    if board_y >= 0 && board_y < start_visual_board.rows.len() as i32 {
                        for bit_pos in 0..10 {
                            if (row_mask & (1 << bit_pos)) != 0 {
                                // Mark current piece position with special symbol
                                start_visual_board.rows[board_y as usize] |= 1 << bit_pos;
                            }
                        }
                    }
                }
            }
            start_visual_board.display_board("📍 CURRENT PIECE POSITION (marked with █)", None);
        }

        // Validate current piece position
        let current_piece_obj = Piece::new(current_piece, current_x, current_y).with_rotation(current_rotation);
        if !board.can_place_piece(&current_piece_obj) {
            console_log!("❌ CRITICAL ERROR: Current piece position ({}, {}) rotation {} is INVALID!", current_x, current_y, current_rotation);
            console_log!("🔄 This suggests the JavaScript interface is providing incorrect position data");
            // Continue anyway to see what happens
        } else if debug {
            console_log!("✅ Current piece position validation: PASSED");
        }

        let all_placements = self.generate_all_placements(board, current_piece, current_x, current_y, current_rotation, debug);

        if debug {
            console_log!("📊 Placement generation completed: {} total reachable placements found", all_placements.len());
            if all_placements.is_empty() {
                console_log!("🚨 WARNING: No placements found! This indicates a serious pathfinding issue.");
            }
        }

        let mut all_evaluations: Vec<(Placement, PlacementEvaluation)> = all_placements
            .into_iter()
            .filter_map(|placement| {
                self.evaluate_placement(board, current_piece, &placement, weights)
                    .map(|eval| (placement, eval))
            })
            .collect();

        // Primary sort by score (desc), tie-break by landed_y (desc → lower on the board preferred)
        all_evaluations.sort_by(|a, b| {
            match b.1.score.partial_cmp(&a.1.score).unwrap_or(std::cmp::Ordering::Equal) {
                std::cmp::Ordering::Equal => b.1.landed_y.cmp(&a.1.landed_y),
                other => other,
            }
        });

        if all_evaluations.is_empty() {
            console_log!("🚨 EMERGENCY: No valid placements after evaluation! Returning hard_drop fallback.");
            return ("hard_drop".to_string(), Placement::default(), f64::NEG_INFINITY);
        }

        let (best_placement, best_eval) = &all_evaluations[0];

        if debug {
            console_log!("🏆 WINNER: x={}, y={}, rot={} → SCORE={:.1}", best_placement.x, best_placement.y, best_placement.rotation, all_evaluations[0].1.score);
            console_log!("🎯 Target placement details: From current ({}, {}) rot {} → target ({}, {}) rot {}", 
                         current_x, current_y, current_rotation,
                         best_placement.x, best_placement.y, best_placement.rotation);

            // Visualize the landed (gravity-resolved) final board result
            let mut final_board = board.clone();
            let mut final_piece = Piece::new(current_piece, best_placement.x, best_placement.y).with_rotation(best_placement.rotation);
            while final_board.can_place_piece(&final_piece.moved(0, 1)) {
                final_piece = final_piece.moved(0, 1);
            }
            final_board.lock_piece(&final_piece);
            final_board.clear_lines();
            final_board.display_board("🎯 FINAL BOARD RESULT", Some(board));
            
            // 🎯 VISUAL DEBUG: Show target placement (landed) on clean board
            let mut target_visual_board = board.clone();
            let mut target_piece_obj = Piece::new(current_piece, best_placement.x, best_placement.y).with_rotation(best_placement.rotation);
            while target_visual_board.can_place_piece(&target_piece_obj.moved(0, 1)) {
                target_piece_obj = target_piece_obj.moved(0, 1);
            }
            if let Some(mask) = target_piece_obj.get_mask() {
                for (i, &row_mask) in mask.iter().enumerate() {
                    if row_mask == 0 { continue; }
                    let board_y = target_piece_obj.y + i as i32;
                    if board_y >= 0 && board_y < target_visual_board.rows.len() as i32 {
                        for bit_pos in 0..10 {
                            if (row_mask & (1 << bit_pos)) != 0 {
                                target_visual_board.rows[board_y as usize] |= 1 << bit_pos;
                            }
                        }
                    }
                }
            }
            target_visual_board.display_board("🎯 TARGET PLACEMENT (where AI wants to place)", None);

            // 🔍 EVALUATION BREAKDOWN for top candidates (terms and weighted sum)
            let explain = |placement: &Placement| {
                let mut piece = Piece::new(current_piece, placement.x, placement.y).with_rotation(placement.rotation);
                let mut board_after = board.clone();
                while board_after.can_place_piece(&piece.moved(0, 1)) { piece = piece.moved(0, 1); }
                board_after.lock_piece(&piece);
                let cleared = board_after.clear_lines();
                let (agg_h, max_h, holes, bump) = board_after.get_evaluation_metrics();
                let w = weights;
                let s = agg_h * w.aggregate_height
                      + max_h * w.max_height
                      + holes * w.holes
                      + bump * w.bumpiness
                      + (cleared.cleared_lines as f64) * w.completed_lines;
                (agg_h, max_h, holes, bump, cleared.cleared_lines as f64, s)
            };

            // Log top 2 choices if available
            let top_count = if all_evaluations.len() > 1 { 2 } else { 1 };
            for i in 0..top_count {
                let (p, _ev) = &all_evaluations[i];
                let (agg_h, max_h, holes, bump, lines, s) = explain(p);
                console_log!(
                    "📊 EVAL CHOICE #{}: x={}, y={}, rot={} | aggH={:.1}, maxH={:.1}, bump={:.1}, holes={:.1}, lines_cleared={:.0} | weights: (ah={:.2}, mh={:.2}, bp={:.2}, ho={:.2}, ln={:.2}) | score={:.2}",
                    i+1,
                    p.x, p.y, p.rotation,
                    agg_h, max_h, bump, holes, lines,
                    weights.aggregate_height, weights.max_height, weights.bumpiness, weights.holes, weights.completed_lines,
                    s
                );
            }
        }

        // 🎯 SMART DROPPING LOGIC 🎯
        // Check if this placement requires tucking/spinning maneuvers
        let requires_complex_moves = self.requires_tucking_or_spinning(board, current_piece, current_x, current_y, current_rotation, best_placement);
        
        if debug {
            console_log!("🧠 Movement complexity analysis: {}", if requires_complex_moves { "COMPLEX (tucking/spinning required)" } else { "SIMPLE (basic moves only)" });
        }
        
        // Generate move sequence with appropriate soft drop allowance
        let move_sequence = self.generate_move_sequence(board, current_piece, current_x, current_y, current_rotation, best_placement, arr, das, requires_complex_moves, debug);
        
        if debug {
            console_log!("🛤️ Pathfinding result: {} moves generated", move_sequence.len());
            if move_sequence.is_empty() {
                console_log!("🚨 WARNING: Pathfinding returned empty sequence!");
            } else {
                console_log!("📝 Raw move sequence: [{}]", move_sequence.join(", "));
            }
        }
        
        // 🎯 SMART PATHFINDING POST-PROCESSING: Fix rotation timing issues
        let mut improved_sequence = Vec::new();
        let mut sim_piece = Piece::new(current_piece, current_x, current_y).with_rotation(current_rotation);
        
        for (i, move_action) in move_sequence.iter().enumerate() {
            match move_action.as_str() {
                "soft_drop" => {
                    // Execute soft_drop
                    while board.can_place_piece(&sim_piece.moved(0, 1)) {
                        sim_piece.y += 1;
                    }
                    improved_sequence.push(move_action.clone());
                    
                    // Check if next move is a rotation
                    if i + 1 < move_sequence.len() {
                        let next_move = &move_sequence[i + 1];
                        if next_move == "rotate_ccw" || next_move == "rotate" || next_move == "rotate_180" {
                            // Do not inject move_down; rely on planned soft_drop timing
                            let _no_fix = true;
                        }
                    }
                },
                "rotate_ccw" => {
                    if let Some(rotated) = sim_piece.try_rotate_counter_clockwise(board) {
                        sim_piece = rotated;
                        improved_sequence.push(move_action.clone());
                        // Optional intelligent 1-cell drop between back-to-back rotations
                        if i + 1 < move_sequence.len() {
                            let next_move = &move_sequence[i + 1];
                            if (next_move == "rotate_ccw" || next_move == "rotate" || next_move == "rotate_180")
                                && board.can_place_piece(&sim_piece.moved(0, 1)) {
                                let direct_rot_works = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.try_rotate_180(board),
                                    _ => None,
                                };
                                let after_drop_rot = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.moved(0, 1).try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.moved(0, 1).try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.moved(0, 1).try_rotate_180(board),
                                    _ => None,
                                };
                                if let Some(rot_after) = after_drop_rot {
                                    let _better = match direct_rot_works {
                                        Some(rot_direct) => rot_after.y <= rot_direct.y || (rot_after.y - best_placement.y).abs() < (rot_direct.y - best_placement.y).abs(),
                                        None => true,
                                    };
                                    // Do not auto-inject move_down here; sequence should have planned it
                                }
                            }
                        }
                    } else {
                        // Keep the action to preserve parity with JS executor
                        improved_sequence.push(move_action.clone());
                    }
                },
                "rotate" => {
                    let _initial_pos = (sim_piece.x, sim_piece.y);
                    if let Some(rotated) = sim_piece.try_rotate_clockwise(board) {
                        sim_piece = rotated;
                        improved_sequence.push(move_action.clone());
                        if i + 1 < move_sequence.len() {
                            let next_move = &move_sequence[i + 1];
                            if (next_move == "rotate_ccw" || next_move == "rotate" || next_move == "rotate_180")
                                && board.can_place_piece(&sim_piece.moved(0, 1)) {
                                let direct_rot_works = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.try_rotate_180(board),
                                    _ => None,
                                };
                                let after_drop_rot = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.moved(0, 1).try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.moved(0, 1).try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.moved(0, 1).try_rotate_180(board),
                                    _ => None,
                                };
                                if let Some(_rot_after) = after_drop_rot {
                                    let _better = match direct_rot_works {
                                        Some(rot_direct) => true || (rot_direct.y >= 0),
                                        None => true,
                                    };
                                    // Do not inject move_down
                                }
                            }
                        }
                    } else {
                        improved_sequence.push(move_action.clone());
                    }
                },
                "rotate_180" => {
                    if let Some(rotated) = sim_piece.try_rotate_180(board) {
                        sim_piece = rotated;
                        improved_sequence.push(move_action.clone());
                        if i + 1 < move_sequence.len() {
                            let next_move = &move_sequence[i + 1];
                            if (next_move == "rotate_ccw" || next_move == "rotate" || next_move == "rotate_180")
                                && board.can_place_piece(&sim_piece.moved(0, 1)) {
                                let direct_rot_works = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.try_rotate_180(board),
                                    _ => None,
                                };
                                let after_drop_rot = match next_move.as_str() {
                                    "rotate_ccw" => sim_piece.moved(0, 1).try_rotate_counter_clockwise(board),
                                    "rotate" => sim_piece.moved(0, 1).try_rotate_clockwise(board),
                                    "rotate_180" => sim_piece.moved(0, 1).try_rotate_180(board),
                                    _ => None,
                                };
                                if let Some(_rot_after) = after_drop_rot {
                                    let _better = match direct_rot_works {
                                        Some(_rot_direct) => true,
                                        None => true,
                                    };
                                    // Do not inject move_down
                                }
                            }
                        }
                    } else {
                        console_log!("⚠️ ROTATION FAILED: rotate_180 at ({}, {})", sim_piece.x, sim_piece.y);
                        improved_sequence.push(move_action.clone());
                    }
                },
                "move_to_left" => {
                    while board.can_place_piece(&sim_piece.moved(-1, 0)) {
                        sim_piece.x -= 1;
                    }
                    improved_sequence.push(move_action.clone());
                },
                "move_to_right" => {
                    while board.can_place_piece(&sim_piece.moved(1, 0)) {
                        sim_piece.x += 1;
                    }
                    improved_sequence.push(move_action.clone());
                },
                "move_down" => {
                    if board.can_place_piece(&sim_piece.moved(0, 1)) {
                        sim_piece.y += 1;
                    }
                    improved_sequence.push(move_action.clone());
                },
                _ => {
                    // Other moves - just add them
                    improved_sequence.push(move_action.clone());
                }
            }
        }
        
        let mut final_sequence = improved_sequence;

        // Finishing adjustments: if we're off from the target by a small margin, do tiny falls and a final spin
        let mut fin_iter = 0;
        while fin_iter < 2 {
            fin_iter += 1;
            let mut progressed = false;
            // No move_down injection here; rely on planned path

            // Try a final helpful rotation if rotation doesn't match, or if a rotation brings us closer to target y
            if sim_piece.rotation != best_placement.rotation {
                if let Some(rot) = sim_piece.try_rotate_counter_clockwise(board) {
                    let closer = (rot.y - best_placement.y).abs() <= (sim_piece.y - best_placement.y).abs();
                    if closer || rot.rotation == best_placement.rotation {
                        sim_piece = rot;
                        final_sequence.push("rotate_ccw".to_string());
                        progressed = true;
                    }
                } else if let Some(rot) = sim_piece.try_rotate_clockwise(board) {
                    let closer = (rot.y - best_placement.y).abs() <= (sim_piece.y - best_placement.y).abs();
                    if closer || rot.rotation == best_placement.rotation {
                        sim_piece = rot;
                        final_sequence.push("rotate".to_string());
                        progressed = true;
                    }
                }
            } else {
                // Rotations match, but if a rotation helps reach exact target y, try it
                if let Some(rot) = sim_piece.try_rotate_counter_clockwise(board) {
                    if (rot.y - best_placement.y).abs() < (sim_piece.y - best_placement.y).abs() {
                        sim_piece = rot;
                        final_sequence.push("rotate_ccw".to_string());
                        progressed = true;
                    }
                }
            }

            // Stop if aligned or no progress
            if (sim_piece.x, sim_piece.y, sim_piece.rotation) == (best_placement.x, best_placement.y, best_placement.rotation) || !progressed {
                break;
            }
        }
        
        if requires_complex_moves {
            // Complex placement that requires tucking/spinning - soft_drop may be used during pathfinding
            if debug {
                console_log!("🧠 SMART DROP: Complex placement detected - allowing soft_drop in pathfinding");
            }
            // Ensure we finish the placement; always end with hard_drop regardless of soft drops
        } else {
            // Simple placement - pathfinding avoided soft_drop
            if debug {
                console_log!("🧠 SMART DROP: Simple placement detected");
            }
            // Simple placement logic continues
        }

        // No heuristic finisher here; rely on search graph to discover tuck sequences naturally

        // Always end with hard_drop (unified policy for consistency with human control)
        if !final_sequence.iter().any(|m| m == "hard_drop") {
            final_sequence.push("hard_drop".to_string());
            if debug { console_log!("🎯 FINALIZE: Added hard_drop at end"); }
        }
        
        let best_move = final_sequence.join(",");

        if debug {
            console_log!("🎯 FINAL SEQUENCE: '{}'", best_move);
            console_log!("🚀🚀🚀 === TETRIS AI ANALYSIS END === 🚀🚀🚀");
        }

        (best_move, best_placement.clone(), best_eval.score)
    }

    fn generate_all_placements(&self, board: &Board, piece_type: PieceType, current_x: i32, current_y: i32, current_rotation: usize, debug: bool) -> Vec<Placement> {
        let mut placements = Vec::new();
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        
        if debug { console_log!("✅ Starting from current position: ({}, {}) rotation {}", current_x, current_y, current_rotation); }
        
        // Start from current position
        let start_piece = Piece::new(piece_type, current_x, current_y).with_rotation(current_rotation);
        if board.can_place_piece(&start_piece) {
            queue.push_back(start_piece);
            visited.insert((current_x, current_y, current_rotation));
        }
        
        let mut iterations = 0;
        const MAX_ITERATIONS: usize = 2000;
        
        while let Some(piece) = queue.pop_front() {
            iterations += 1;
            if iterations > MAX_ITERATIONS {
                if debug { console_log!("⚠️ BFS reached max iterations limit"); }
                break;
            }
            
            // 🎯 VALIDATE PLACEMENT: Reject any placement with blocks outside board bounds
            let mut is_valid_placement = true;
            if let Some(mask) = piece.get_mask() {
                for (row_idx, &row_mask) in mask.iter().enumerate() {
                    if row_mask == 0 { continue; }
                    
                    for bit_pos in 0..16 {
                        if (row_mask & (1 << bit_pos)) != 0 {
                            let block_x = bit_pos as i32;
                            let block_y = piece.y + row_idx as i32;
                            
                            // Reject if block is outside board bounds
                            if block_x < 0 || block_x >= 10 || block_y < 0 || block_y >= 40 {
                                is_valid_placement = false;
                                break;
                            }
                        }
                    }
                    if !is_valid_placement { break; }
                }
            }
            
            // Only add to placements if all blocks are within bounds
            if is_valid_placement {
                placements.push(Placement {
                    x: piece.x,
                    y: piece.y,
                    rotation: piece.rotation,
                });
            }

            // Successor states with kick-aware rotations
            let mut moves = vec![
                piece.moved(0, 1),   // Soft Drop
                piece.moved(1, 0),   // Right
                piece.moved(-1, 0),  // Left
            ];
            
            // Add kick-aware rotations
            if let Some(cw_piece) = piece.try_rotate_clockwise(board) {
                moves.push(cw_piece);
            }
            if let Some(ccw_piece) = piece.try_rotate_counter_clockwise(board) {
                moves.push(ccw_piece);
            }
            if let Some(rot180_piece) = piece.try_rotate_180(board) {
                moves.push(rot180_piece);
            }
    
            for next_piece in &moves {
                if visited.insert((next_piece.x, next_piece.y, next_piece.rotation)) {
                    if board.can_place_piece(next_piece) {
                        queue.push_back(*next_piece);
                    }
                }
            }
        }
        
        let final_placements: Vec<Placement> = placements.into_iter().collect();
        if debug {
            console_log!("✅ Placement generation COMPLETE: {} total placements found", final_placements.len());
            console_log!("📈 BFS Statistics: {} iterations", iterations);
        }
        
        if final_placements.is_empty() {
            console_log!("🚨 CRITICAL: No final placements generated! This suggests the piece is completely trapped.");
        } else {
            if debug {
                console_log!("📋 Sample placements found: ");
                for (i, placement) in final_placements.iter().take(5).enumerate() {
                    console_log!("   {}. x={}, y={}, rot={}", i+1, placement.x, placement.y, placement.rotation);
                }
                if final_placements.len() > 5 {
                    console_log!("   ... and {} more placements", final_placements.len() - 5);
                }
            }
        }
    
        final_placements
    }

    fn evaluate_placement(&self, board: &Board, piece_type: PieceType, placement: &Placement, weights: &EvaluationWeights) -> Option<PlacementEvaluation> {
        let mut piece = Piece::new(piece_type, placement.x, placement.y).with_rotation(placement.rotation);
        if !board.can_place_piece(&piece) {
            return None;
        }

        // Always evaluate the landed (gravity-resolved) position to avoid mid-air locks
        while board.can_place_piece(&piece.moved(0, 1)) {
            piece = piece.moved(0, 1);
        }

        let mut predicted_board = board.clone();
        predicted_board.lock_piece(&piece);
        let cleared = predicted_board.clear_lines();
        
        let _heights_after = predicted_board.get_heights();

        // Incorporate line clear reward directly here to ensure evaluation sees it
        let mut eval = predicted_board.evaluate(weights).score;
        if cleared.cleared_lines > 0 {
            eval += (cleared.cleared_lines as f64) * weights.completed_lines;
        }

        Some(PlacementEvaluation {
            score: eval,
            landed_y: piece.y,
        })
    }

    fn generate_move_sequence(&self, board: &Board, piece_type: PieceType, current_x: i32, current_y: i32, current_rotation: usize, placement: &Placement, _arr: u32, _das: u32, allow_soft_drops: bool, debug: bool) -> Vec<String> {
        use std::collections::{BinaryHeap, HashMap};
        use std::cmp::Ordering;

        console_log!("🛤️ PATHFINDING START: From ({}, {}) rot {} → Target ({}, {}) rot {}", 
                     current_x, current_y, current_rotation,
                     placement.x, placement.y, placement.rotation);
        if debug { console_log!("🎛️ Pathfinding mode: {}", if allow_soft_drops { "COMPLEX (soft drops allowed)" } else { "SIMPLE (hard drop only)" }); }

        // For simple placements, target stance only (x, rotation). Final y is handled via hard_drop in JS.
        let actual_target = if allow_soft_drops {
            // Complex placement: use exact target coordinates
            (placement.x, placement.y, placement.rotation)
        } else {
            if debug { console_log!("🎯 SIMPLE TARGET CALCULATION: Target stance x={} rot={}", placement.x, placement.rotation); }
            (placement.x, current_y, placement.rotation)
        };

        if debug { console_log!("🎯 ACTUAL PATHFINDING TARGET: ({}, {}) rot {}", actual_target.0, actual_target.1, actual_target.2); }

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

        // Start from current position instead of spawn position
        let start_piece = Piece::new(piece_type, current_x, current_y).with_rotation(current_rotation);
        
        // Validate current position is legal for pathfinding
        if !board.can_place_piece(&start_piece) {
            console_log!("⚠️ WARNING: Current piece position ({}, {}) rotation {} is invalid for pathfinding! Returning empty sequence.", 
                         current_x, current_y, current_rotation);
            return vec![];
        }
        
        if debug { console_log!("✅ Pathfinding starting point validated: ({}, {}) rotation {}", current_x, current_y, current_rotation); }
        
        let mut dists = HashMap::new();
        let mut pq = BinaryHeap::new();

        dists.insert((start_piece.x, start_piece.y, start_piece.rotation), (0, Vec::new()));
        pq.push(State { cost: 0, piece: start_piece, path: Vec::new() });

        let mut iterations = 0;

        while let Some(State { cost, piece, path }) = pq.pop() {
            iterations += 1;
            
            // Remove excessive pathfinding progress logging
            // if iterations % 500 == 0 && iterations > 0 {
            //     console_log!("🔄 Pathfinding progress: {} iterations, queue size: {}", iterations, pq.len());
            // }
            
            if cost > dists.get(&(piece.x, piece.y, piece.rotation)).unwrap_or(&(usize::MAX, Vec::new())).0 {
                continue;
            }

            // Check if we reached the actual target
            // Prefer simpler paths: if we reach the target, but there exists an equal-cost path with no rotations, prefer it.
            let reached_target = if allow_soft_drops {
                piece.x == actual_target.0 && piece.y == actual_target.1 && piece.rotation == actual_target.2
            } else {
                piece.x == actual_target.0 && piece.rotation == actual_target.2
            };

            if reached_target {
                if debug {
                    console_log!("🎯 PATHFINDING SUCCESS: Target reached in {} iterations", iterations);
                    console_log!("📝 Solution path ({} moves): [{}]", path.len(), path.join(", "));
                    console_log!("💰 Final cost: {}", cost);
                }
                // Simplicity tie-break: try to find an equal-cost or cheaper path with fewer rotations (finesse-first)
                // We only attempt a quick local improvement by penalizing rotations when building successors already.
                
                // DETAILED STEP-BY-STEP SIMULATION LOG
                if debug { console_log!("🔍 🔍 PATHFINDING STEP-BY-STEP SIMULATION:"); }
                let mut sim_piece = start_piece;
                if debug { console_log!("   START: position ({}, {}) rotation {}", sim_piece.x, sim_piece.y, sim_piece.rotation); }
                
                for (step_num, move_action) in path.iter().enumerate() {
                    match move_action.as_str() {
                        "rotate" => {
                            let initial_pos = (sim_piece.x, sim_piece.y);
                            if let Some(rotated) = sim_piece.try_rotate_clockwise_debug(board) {
                                if debug { console_log!("   {}: '{}' → ({},{}) rot {} to ({},{}) rot {} [Δx={}, Δy={}]", 
                                            step_num + 1, move_action, 
                                            initial_pos.0, initial_pos.1, sim_piece.rotation,
                                            rotated.x, rotated.y, rotated.rotation,
                                            rotated.x - initial_pos.0, rotated.y - initial_pos.1); }
                                sim_piece = rotated;
                            } else {
                                if debug { console_log!("   {}: '{}' → FAILED (no valid rotation)", step_num + 1, move_action); }
                            }
                        },
                        "rotate_ccw" => {
                            if let Some(rotated) = sim_piece.try_rotate_counter_clockwise(board) {
                                if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {}", 
                                            step_num + 1, move_action, rotated.x, rotated.y, rotated.rotation); }
                                sim_piece = rotated;
                            } else {
                                if debug { console_log!("   {}: '{}' → FAILED (no valid rotation)", step_num + 1, move_action); }
                            }
                        },
                        "rotate_180" => {
                            if let Some(rotated) = sim_piece.try_rotate_180(board) {
                                if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {}", 
                                            step_num + 1, move_action, rotated.x, rotated.y, rotated.rotation); }
                                sim_piece = rotated;
                            } else {
                                if debug { console_log!("   {}: '{}' → FAILED (no valid rotation)", step_num + 1, move_action); }
                            }
                        },
                        "soft_drop" => {
                            let mut sd_piece = sim_piece.clone();
                            let start_y = sd_piece.y;
                            while board.can_place_piece(&sd_piece.moved(0, 1)) {
                                sd_piece.y += 1;
                            }
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {} (dropped {} cells)", 
                                        step_num + 1, move_action, sd_piece.x, sd_piece.y, sd_piece.rotation, sd_piece.y - start_y); }
                            sim_piece = sd_piece;
                        },
                        "move_left" => {
                            let moved = sim_piece.moved(-1, 0);
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {}", 
                                        step_num + 1, move_action, moved.x, moved.y, moved.rotation); }
                            sim_piece = moved;
                        },
                        "move_right" => {
                            let moved = sim_piece.moved(1, 0);
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {}", 
                                        step_num + 1, move_action, moved.x, moved.y, moved.rotation); }
                            sim_piece = moved;
                        },
                        "move_down" => {
                            let moved = sim_piece.moved(0, 1);
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {}", 
                                        step_num + 1, move_action, moved.x, moved.y, moved.rotation); }
                            sim_piece = moved;
                        },
                        "move_to_left" => {
                            let mut das_piece = sim_piece.clone();
                            let start_x = das_piece.x;
                            while board.can_place_piece(&das_piece.moved(-1, 0)) {
                                das_piece.x -= 1;
                            }
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {} (moved {} cells left)", 
                                        step_num + 1, move_action, das_piece.x, das_piece.y, das_piece.rotation, start_x - das_piece.x); }
                            sim_piece = das_piece;
                        },
                        "move_to_right" => {
                            let mut das_piece = sim_piece.clone();
                            let start_x = das_piece.x;
                            while board.can_place_piece(&das_piece.moved(1, 0)) {
                                das_piece.x += 1;
                            }
                            if debug { console_log!("   {}: '{}' → position ({}, {}) rotation {} (moved {} cells right)", 
                                        step_num + 1, move_action, das_piece.x, das_piece.y, das_piece.rotation, das_piece.x - start_x); }
                            sim_piece = das_piece;
                        },
                        _ => {
                            if debug { console_log!("   {}: '{}' → UNKNOWN MOVE", step_num + 1, move_action); }
                        }
                    }
                }
                
                if allow_soft_drops {
                    if debug { console_log!("   FINAL: position ({}, {}) rotation {} (target was ({}, {}) rotation {})", 
                               sim_piece.x, sim_piece.y, sim_piece.rotation,
                               actual_target.0, actual_target.1, actual_target.2); }
                } else {
                    if debug { console_log!("   FINAL: position ({}, {}) rotation {} (target stance was x={} rotation {})", 
                               sim_piece.x, sim_piece.y, sim_piece.rotation,
                               actual_target.0, actual_target.2); }
                }

                if (allow_soft_drops && sim_piece.x == actual_target.0 && sim_piece.y == actual_target.1 && sim_piece.rotation == actual_target.2)
                    || (!allow_soft_drops && sim_piece.x == actual_target.0 && sim_piece.rotation == actual_target.2) {
                    if debug { console_log!("   ✅ SIMULATION MATCHES TARGET"); }
                } else {
                    if debug { console_log!("   ❌ SIMULATION MISMATCH - this suggests a pathfinding bug!"); }
                }
                
                // 🎯 VISUAL DEBUG: Show simulated final position
                let mut sim_visual_board = board.clone();
                if let Some(mask) = sim_piece.get_mask() {
                    for (i, &row_mask) in mask.iter().enumerate() {
                        if row_mask == 0 { continue; }
                        let board_y = sim_piece.y + i as i32;
                        if board_y >= 0 && board_y < sim_visual_board.rows.len() as i32 {
                            for bit_pos in 0..10 {
                                if (row_mask & (1 << bit_pos)) != 0 {
                                    // Mark simulated final position
                                    sim_visual_board.rows[board_y as usize] |= 1 << bit_pos;
                                }
                            }
                        }
                    }
                }
                if debug { sim_visual_board.display_board("🔍 SIMULATED FINAL POSITION (where pathfinding thinks piece will land)", None); }
                
                return path;
            }
            
            let mut moves: Vec<(Piece, &str, usize)> = Vec::new();
            
            // Kick-aware rotation moves with heuristic costs relative to target
            let target_x = placement.x;
            let target_rot = placement.rotation;
            let rot_cost_for = |from: &Piece, to: &Piece| -> usize {
                let dy = (to.y - from.y).max(0) as isize; // downward kick cells
                let dx = (to.x - from.x).abs() as isize;   // lateral kick cells
                let base = 1isize; // one rotate key
                let dy_penalty = if allow_soft_drops { dy * 3 } else { dy * 50 };
                let dx_penalty = dx * 2; // discourage lateral kicks
                // Alignment heuristics: prefer rotations that match target rotation and reduce x distance
                let align_bonus = if to.rotation == target_rot { -1 } else { 0 };
                let dist_before = (from.x - target_x).abs() as isize;
                let dist_after = (to.x - target_x).abs() as isize;
                let dist_delta_penalty = (dist_after - dist_before).max(0); // penalize moving away from target x
                (base + dy_penalty + dx_penalty + dist_delta_penalty + align_bonus).max(0) as usize
            };
            if let Some(cw_piece) = piece.try_rotate_clockwise(board) {
                let rot_cost = rot_cost_for(&piece, &cw_piece);
                moves.push((cw_piece, "rotate", rot_cost));
            }
            if let Some(ccw_piece) = piece.try_rotate_counter_clockwise(board) {
                let rot_cost = rot_cost_for(&piece, &ccw_piece);
                moves.push((ccw_piece, "rotate_ccw", rot_cost));
            }
            if let Some(rot180_piece) = piece.try_rotate_180(board) {
                let rot_cost = rot_cost_for(&piece, &rot180_piece).saturating_sub(1); // slight bias for 180 first when useful
                moves.push((rot180_piece, "rotate_180", rot_cost));
            }
            
            // Single-step horizontal moves for precise alignment
            let step_left = piece.moved(-1, 0);
            if board.can_place_piece(&step_left) {
                moves.push((step_left, "move_left", 1));
            }
            let step_right = piece.moved(1, 0);
            if board.can_place_piece(&step_right) {
                moves.push((step_right, "move_right", 1));
            }

            // Soft drop / micro-drop - only allow if complex moves are permitted
            if allow_soft_drops {
                // Precise single-step drop to enable interleaved tuck timing
                let one_down = piece.moved(0, 1);
                if board.can_place_piece(&one_down) {
                    moves.push((one_down, "move_down", 1));
                }

                // Full soft drop to floor (discourage before aligned)
                let mut sd_piece = piece.clone();
                while board.can_place_piece(&sd_piece.moved(0, 1)) {
                    sd_piece.y += 1;
                }
                if sd_piece.y > piece.y {
                    let misalign_x = (piece.x - target_x).abs() as usize;
                    let rot_mismatch = if piece.rotation == target_rot { 0 } else { 2 };
                    // Higher cost if not aligned horizontally or rotation not matching
                    let sd_cost = 5 + misalign_x * 2 + rot_mismatch;
                    moves.push((sd_piece, "soft_drop", sd_cost));
                }
            }

            // DAS-like moves - prioritize these for efficient long horizontal movement
            let mut left_das_piece = piece.clone();
            while board.can_place_piece(&left_das_piece.moved(-1, 0)) {
                left_das_piece.x -= 1;
            }
            if left_das_piece.x != piece.x {
                moves.push((left_das_piece, "move_to_left", 1)); // DAS hold counts as one input
            }

            let mut right_das_piece = piece.clone();
            while board.can_place_piece(&right_das_piece.moved(1, 0)) {
                right_das_piece.x += 1;
            }
            if right_das_piece.x != piece.x {
                moves.push((right_das_piece, "move_to_right", 1));
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
        
        // Fallback - check if we can reach target by any path found
        if debug {
            console_log!("🚨 PATHFINDING FAILED: No direct path found after {} iterations", iterations);
            console_log!("🔍 Checking for any partial solutions...");
        }
        
        let fallback_result = dists.get(&(placement.x, placement.y, placement.rotation))
            .map(|(_, path)| path.clone())
            .unwrap_or_else(|| vec![]);
            
        if fallback_result.is_empty() {
            if debug { console_log!("❌ No fallback path available to target position"); }
        } else {
            if debug { console_log!("🔄 Found fallback path ({} moves): [{}]", fallback_result.len(), fallback_result.join(", ")); }
        }
        
        fallback_result
    }

    // Helper function to determine if a placement requires tucking/spinning
    fn requires_tucking_or_spinning(&self, board: &Board, piece_type: PieceType, current_x: i32, current_y: i32, current_rotation: usize, placement: &Placement) -> bool {
        // Start from current position instead of spawn position
        let start_piece = Piece::new(piece_type, current_x, current_y).with_rotation(current_rotation);
        
        // Check if we can reach the target placement with only simple moves
        // Simple sequence: Rotate to target -> Move horizontally -> Hard drop
        
        // Step 1: Check if we can rotate at the current position to target rotation
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