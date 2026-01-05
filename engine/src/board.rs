use crate::pieces::Piece;

// Game board dimensions
pub const BOARD_WIDTH: usize = 10;
pub const BOARD_HEIGHT: usize = 40; // Full height including hidden rows
pub const VISIBLE_HEIGHT: usize = 20; // Visible board height
const FULL_ROW: u32 = 0b11_1111_1111; // All 10 bits set

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Board {
    pub rows: [u32; BOARD_HEIGHT],
}

#[derive(Clone, Debug)]
pub struct ClearInfo {
    pub cleared_lines: usize,
}

impl Board {
    pub fn new() -> Self {
        Self {
            rows: [0; BOARD_HEIGHT],
        }
    }

    pub fn from_flat_array(board_data: &[i32]) -> Self {
        let mut board = Self::new();
        let start_y = BOARD_HEIGHT - VISIBLE_HEIGHT; // Place at the bottom

        for (i, &cell) in board_data.iter().enumerate() {
            let x = i % BOARD_WIDTH;
            let y = i / BOARD_WIDTH;
            if y < VISIBLE_HEIGHT {
                board.set_cell(x, start_y + y, cell != 0);
            }
        }
        board
    }

    pub fn is_full_row(&self, row: usize) -> bool {
        (self.rows[row] & FULL_ROW) == FULL_ROW
    }

    pub fn set_cell(&mut self, x: usize, y: usize, filled: bool) {
        if x < BOARD_WIDTH && y < BOARD_HEIGHT {
            if filled {
                self.rows[y] |= 1 << x;
            } else {
                self.rows[y] &= !(1 << x);
            }
        }
    }

    pub fn get_cell(&self, x: usize, y: usize) -> bool {
        if x < BOARD_WIDTH && y < BOARD_HEIGHT {
            (self.rows[y] & (1 << x)) != 0
        } else {
            true // Out of bounds = collision
        }
    }

    pub fn can_place_piece(&self, piece: &Piece) -> bool {
        if let Some(mask) = piece.get_mask() {
            for (i, &row_mask) in mask.iter().enumerate() {
                if row_mask == 0 {
                    continue; // No blocks in this row of the piece's bounding box
                }

                // Align mask row 0 to anchor y-1 (mask indices 0..3 map to y-1, y+0, y+1, y+2)
                let board_y = piece.y + (i as i32 - 1);

                // Check vertical bounds
                if board_y < 0 || board_y >= BOARD_HEIGHT as i32 {
                    return false; // This part of the piece is off the board
                }

                // Check for collisions with existing pieces (only bits 0-9 matter for board state)
                let board_row = self.rows[board_y as usize];
                let board_collision_mask = row_mask & ((1 << BOARD_WIDTH) - 1); // Mask to only consider bits 0-9
                if board_row & (board_collision_mask as u32) != 0 {
                    return false; // Collision with existing blocks
                }
            }
            true // All parts of the piece are on the board and not colliding
        } else {
            false // Piece mask not found
        }
    }

    pub fn lock_piece(&mut self, piece: &Piece) -> bool {
        if let Some(mask) = piece.get_mask() {
            for (i, &row_mask) in mask.iter().enumerate() {
                // Align with mask vertical indexing (see can_place_piece)
                let board_y = piece.y + (i as i32 - 1);
                if board_y >= 0 && board_y < BOARD_HEIGHT as i32 {
                    self.rows[board_y as usize] |= row_mask as u32;
                }
            }
            true
        } else {
            false
        }
    }

    pub fn clear_lines(&mut self) -> ClearInfo {
        let mut cleared_lines = 0;
        let mut new_rows = [0u32; BOARD_HEIGHT];
        let mut write_idx = BOARD_HEIGHT - 1;

        // Compact non-full rows from bottom to top
        for read_idx in (0..BOARD_HEIGHT).rev() {
            if !self.is_full_row(read_idx) {
                new_rows[write_idx] = self.rows[read_idx];
                if write_idx > 0 {
                    write_idx -= 1;
                }
            } else {
                cleared_lines += 1;
            }
        }

        self.rows = new_rows;
        
        ClearInfo { cleared_lines }
    }

    // Get column heights for evaluation
    pub fn get_heights(&self) -> [usize; BOARD_WIDTH] {
        let mut heights = [0; BOARD_WIDTH];
        for x in 0..BOARD_WIDTH {
            for y in 0..BOARD_HEIGHT {
                if self.get_cell(x, y) {
                    heights[x] = BOARD_HEIGHT - y;
                    break;
                }
            }
        }
        heights
    }

    // Get multiple board metrics in one pass for efficiency
    pub fn get_evaluation_metrics(&self) -> (f64, f64, f64, f64) {
        let heights = self.get_heights();
        let mut holes = 0.0;
        let total_height = heights.iter().sum::<usize>() as f64;
        let max_height = *heights.iter().max().unwrap_or(&0) as f64;
        // Right-well helpers
        let _right_well_height = heights[BOARD_WIDTH - 1] as f64; // column 9
        let _left_9_max_height = (*heights[0..BOARD_WIDTH - 1].iter().max().unwrap_or(&0)) as f64;
        let mut _right_well_fill_rows = 0.0; // number of visible cells filled in col 9
        let mut _tetris_ready_rows = 0.0;    // rows where cols 0..8 are full and col 9 is empty

        // More efficient hole counting: an empty cell with a block above it.
        for x in 0..BOARD_WIDTH {
            let height = heights[x];
            if height > 0 {
                for y in (BOARD_HEIGHT - height)..BOARD_HEIGHT {
                    if !self.get_cell(x, y) {
                        holes += 1.0;
                    }
                }
            }
        }

        let mut bumpiness = 0.0;
        for i in 0..BOARD_WIDTH - 1 {
            bumpiness += (heights[i] as f64 - heights[i + 1] as f64).abs();
        }

        // Compute helper features using only visible area
        let start_row = BOARD_HEIGHT - VISIBLE_HEIGHT;
        for y in start_row..BOARD_HEIGHT {
            let filled_left_9 = (0..BOARD_WIDTH - 1).all(|x| self.get_cell(x, y));
            let right_well_filled = self.get_cell(BOARD_WIDTH - 1, y);
            if right_well_filled { _right_well_fill_rows += 1.0; }
            if filled_left_9 && !right_well_filled { _tetris_ready_rows += 1.0; }
        }

        // Attach auxiliary metrics into bumpiness using a compact encoding is not ideal;
        // instead the evaluation function will ask for these via a dedicated API. For now,
        // we return the standard metrics; auxiliary values can be recomputed where needed.
        (total_height, max_height, holes, bumpiness)
    }

    /// Calculate penalty for building too high above cheese lines
    /// Returns penalty based on how many rows are built above the cheese
    pub fn get_cheese_height_penalty(&self) -> f64 {
        let heights = self.get_heights();
        let max_height = *heights.iter().max().unwrap_or(&0);
        
        // Find the highest cheese line (gray blocks)
        // For now, we'll assume cheese is in the bottom 10 rows
        // In a real implementation, you'd track cheese lines more precisely
        let cheese_base_height = 10; // Assume cheese is in bottom 10 rows
        
        if max_height <= cheese_base_height {
            return 0.0; // No penalty if we're not above cheese
        }
        
        let excess_height = max_height - cheese_base_height;
        
        // Heavy penalty for building more than 3 rows above cheese
        if excess_height > 3 {
            // Quadratic penalty for excessive height
            let penalty = (excess_height - 3) as f64;
            return penalty * penalty; // Quadratic scaling
        }
        
        0.0 // No penalty if within 3 rows of cheese
    }

    /// Calculate penalty for using non-I pieces to build high instead of clear
    /// Returns penalty based on how many non-I pieces are used for building above cheese
    pub fn get_non_i_building_penalty(&self) -> f64 {
        let heights = self.get_heights();
        let max_height = *heights.iter().max().unwrap_or(&0);
        
        // Assume cheese is in bottom 10 rows
        let cheese_base_height = 10;
        
        if max_height <= cheese_base_height {
            return 0.0; // No penalty if not above cheese
        }
        
        let excess_height = max_height - cheese_base_height;
        
        // Only apply penalty if building more than 2 rows above cheese
        if excess_height > 2 {
            // Count how many columns are contributing to the high building
            let mut high_columns = 0;
            for &height in &heights {
                if height > cheese_base_height + 2 {
                    high_columns += 1;
                }
            }
            
            // Penalty increases with both excess height and number of high columns
            let penalty = excess_height as f64 * high_columns as f64;
            return penalty;
        }
        
        0.0 // No penalty if within 2 rows of cheese
    }

    /// Calculate penalty for height differences across columns (encourages flat building)
    /// Returns penalty based on the range between highest and lowest columns
    pub fn get_height_range_penalty(&self) -> f64 {
        let heights = self.get_heights();
        
        // Focus on left 9 columns (excluding right well)
        let left_heights = &heights[0..BOARD_WIDTH - 1];
        
        if left_heights.is_empty() {
            return 0.0;
        }
        
        let min_height = *left_heights.iter().min().unwrap_or(&0);
        let max_height = *left_heights.iter().max().unwrap_or(&0);
        let height_range = max_height - min_height;
        
        // Quadratic penalty for height range to strongly discourage uneven building
        (height_range * height_range) as f64
    }

    // Display board for debugging - shows only visible rows (bottom 20)
    pub fn display_board(&self, title: &str, original_board: Option<&Board>) {
        crate::console_log!("📋 {}", title);
        
        // Only show the bottom 20 rows (visible area)
        let start_row = BOARD_HEIGHT - VISIBLE_HEIGHT;
        
        for y in start_row..BOARD_HEIGHT {
            let mut row_str = String::new();
            for x in 0..BOARD_WIDTH {
                let is_new_cell = if let Some(original) = original_board {
                    self.get_cell(x, y) && !original.get_cell(x, y)
                } else {
                    false
                };

                if is_new_cell {
                    row_str.push('▓'); // New piece block
                } else if self.get_cell(x, y) {
                    row_str.push('█'); // Existing block
                } else {
                    row_str.push('·'); // Empty
                }
            }
            let visible_row = y - start_row;
            crate::console_log!("Row {:2}: {}", visible_row, row_str);
        }
        crate::console_log!(""); // Empty line for separation
    }
} 