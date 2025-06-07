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

                let board_y = piece.y + i as i32;

                // Check vertical bounds
                if board_y < 0 || board_y >= BOARD_HEIGHT as i32 {
                    return false; // This part of the piece is off the board
                }

                // Check for collisions with existing pieces
                let board_row = self.rows[board_y as usize];
                if board_row & (row_mask as u32) != 0 {
                    return false; // Collision
                }
            }
            true // All parts of the piece are on the board and not colliding
        } else {
            false // Piece is off the sides of the board
        }
    }

    pub fn lock_piece(&mut self, piece: &Piece) -> bool {
        if let Some(mask) = piece.get_mask() {
            for (i, &row_mask) in mask.iter().enumerate() {
                let board_y = piece.y + i as i32;
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
        let mut _cleared_lines = 0;
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
                _cleared_lines += 1;
            }
        }

        self.rows = new_rows;
        
        ClearInfo {}
    }

    pub fn hash(&self) -> u64 {
        let mut hash = 0u64;
        for (i, &row) in self.rows.iter().enumerate() {
            hash = hash.wrapping_mul(31).wrapping_add(row as u64).wrapping_add(i as u64);
        }
        hash
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

        (total_height, max_height, holes, bumpiness)
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