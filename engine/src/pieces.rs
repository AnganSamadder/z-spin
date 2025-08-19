use once_cell::sync::Lazy;
use std::collections::HashMap;
// use crate::board::BOARD_WIDTH; // unused

// SRS Wall Kick Tables
static KICK_DATA_JLSTZ: Lazy<HashMap<String, Vec<(i32, i32)>>> = Lazy::new(|| {
    let mut kicks = HashMap::new();
    
    // Basic rotations (0->1, 1->2, 2->3, 3->0) - exactly matching TypeScript
    kicks.insert("0->1".to_string(), vec![(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)]);
    kicks.insert("1->0".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("1->2".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("2->1".to_string(), vec![(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)]);
    kicks.insert("2->3".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("3->2".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)]);
    kicks.insert("3->0".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)]);
    kicks.insert("0->3".to_string(), vec![(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)]);
    
    // 180 degree rotations - exactly matching TypeScript
    kicks.insert("0->2".to_string(), vec![(0, 0), (1, 0), (1, 1), (0, 1), (1, -1), (0, -1)]);
    kicks.insert("1->3".to_string(), vec![(0, 0), (0, 1), (-1, 1), (-1, 0), (-1, 2), (0, 2)]);
    kicks.insert("2->0".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, -1), (-1, 1), (0, 1)]);
    kicks.insert("3->1".to_string(), vec![(0, 0), (0, -1), (1, -1), (1, 0), (1, -2), (0, -2)]);
    
    kicks
});

static KICK_DATA_I: Lazy<HashMap<String, Vec<(i32, i32)>>> = Lazy::new(|| {
    let mut kicks = HashMap::new();
    
    // Basic rotations - exactly matching TypeScript
    kicks.insert("0->1".to_string(), vec![(0, 0), (-2, 0), (1, 0), (-2, -1), (1, 2)]);
    kicks.insert("1->0".to_string(), vec![(0, 0), (2, 0), (-1, 0), (2, 1), (-1, -2)]);
    kicks.insert("1->2".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)]);
    kicks.insert("2->1".to_string(), vec![(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)]);
    kicks.insert("2->3".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, -2), (2, -2)]);
    kicks.insert("3->2".to_string(), vec![(0, 0), (2, 0), (-1, 0), (2, 1), (-1, 1)]);
    kicks.insert("3->0".to_string(), vec![(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)]);
    kicks.insert("0->3".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)]);
    
    // 180 degree rotations - exactly matching TypeScript
    kicks.insert("0->2".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, -1), (2, -1)]);
    kicks.insert("1->3".to_string(), vec![(0, 0), (0, 1), (0, -2), (2, 1), (-1, 1)]);
    kicks.insert("2->0".to_string(), vec![(0, 0), (1, 0), (-2, 0), (1, 1), (-2, 1)]);
    kicks.insert("3->1".to_string(), vec![(0, 0), (0, -1), (0, 2), (-2, -1), (1, -1)]);
    
    kicks
});

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PieceType {
    I = 0, O = 1, T = 2, S = 3, Z = 4, J = 5, L = 6,
}

impl PieceType {
    pub fn from_i32(value: i32) -> Option<Self> {
        match value {
            0 => Some(PieceType::I),
            1 => Some(PieceType::O),
            2 => Some(PieceType::T),
            3 => Some(PieceType::S),
            4 => Some(PieceType::Z),
            5 => Some(PieceType::J),
            6 => Some(PieceType::L),
            _ => None,
        }
    }

    pub fn spawn_position(&self) -> (i32, i32) {
        match self {
            PieceType::I => (3, 19), // I piece spawns slightly higher
            _ => (3, 20),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct Piece {
    pub piece_type: PieceType,
    pub x: i32,
    pub y: i32,
    pub rotation: usize,
}

impl Piece {
    pub fn new(piece_type: PieceType, x: i32, y: i32) -> Self {
        Self {
            piece_type,
            x,
            y,
            rotation: 0,
        }
    }

    pub fn spawn(piece_type: PieceType) -> Self {
        let (x, y) = piece_type.spawn_position();
        Self::new(piece_type, x, y)
    }

    pub fn get_mask(&self) -> Option<[u16; 4]> {
        PIECE_MASKS.get(&(self.piece_type, self.rotation, self.x)).copied()
    }

    pub fn with_rotation(&self, rotation: usize) -> Self {
        Self {
            rotation,
            ..*self
        }
    }

    pub fn moved(&self, dx: i32, dy: i32) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
            ..*self
        }
    }

    // New kick-aware rotation methods
    pub fn try_rotate_clockwise(&self, board: &crate::board::Board) -> Option<Self> {
        self.try_rotate_internal(true, board)
    }
    
    pub fn try_rotate_counter_clockwise(&self, board: &crate::board::Board) -> Option<Self> {
        self.try_rotate_internal(false, board)
    }
    
    pub fn try_rotate_180(&self, board: &crate::board::Board) -> Option<Self> {
        let new_rotation = (self.rotation + 2) % 4;
        let kick_key = format!("{}->{}", self.rotation, new_rotation);
        
        let kicks = match self.piece_type {
            PieceType::I => &KICK_DATA_I,
            PieceType::O => return None, // O piece doesn't rotate
            _ => &KICK_DATA_JLSTZ,
        };
        
        if let Some(kick_offsets) = kicks.get(&kick_key) {
            for (_kick_index, &(dx, dy)) in kick_offsets.iter().enumerate() {
                let test_piece = Self {
                    piece_type: self.piece_type,
                    x: self.x + dx,
                    y: self.y - dy, // SRS y-kicks are inverted for board coordinates
                    rotation: new_rotation,
                };
                
                if board.can_place_piece(&test_piece) {
                    // Only log kicks in high-detail debug mode to avoid spam
                    return Some(test_piece);
                }
            }
        }
        
        None
    }
    
    fn try_rotate_internal(&self, clockwise: bool, board: &crate::board::Board) -> Option<Self> {
        // O piece doesn't rotate
        if self.piece_type == PieceType::O {
            return None;
        }
        
        let new_rotation = if clockwise {
            (self.rotation + 1) % 4
        } else {
            (self.rotation + 3) % 4
        };
        
        let kick_key = format!("{}->{}", self.rotation, new_rotation);
        
        let kicks = match self.piece_type {
            PieceType::I => &KICK_DATA_I,
            _ => &KICK_DATA_JLSTZ,
        };
        
        if let Some(kick_offsets) = kicks.get(&kick_key) {
            for (_kick_index, &(dx, dy)) in kick_offsets.iter().enumerate() {
                let test_piece = Self {
                    piece_type: self.piece_type,
                    x: self.x + dx,
                    y: self.y - dy,
                    rotation: new_rotation,
                };
                
                if board.can_place_piece(&test_piece) {
                    return Some(test_piece);
                }
            }
        } else {
            // no kick data for this transition
        }
        
        None
    }

    // Debug version that shows kick details - only for pathfinding simulation
    pub fn try_rotate_clockwise_debug(&self, board: &crate::board::Board) -> Option<Self> {
        if self.piece_type == PieceType::O {
            return None;
        }
        
        let new_rotation = (self.rotation + 1) % 4;
        let kick_key = format!("{}->{}", self.rotation, new_rotation);
        
        let kicks = match self.piece_type {
            PieceType::I => &KICK_DATA_I,
            _ => &KICK_DATA_JLSTZ,
        };
        
        if let Some(kick_offsets) = kicks.get(&kick_key) {
            crate::console_log!("     🔄 Testing {} kicks for {}", kick_offsets.len(), kick_key);
            
            for (kick_index, &(dx, dy)) in kick_offsets.iter().enumerate() {
                let test_piece = Self {
                    piece_type: self.piece_type,
                    x: self.x + dx,
                    y: self.y - dy,
                    rotation: new_rotation,
                };
                
                if board.can_place_piece(&test_piece) {
                    crate::console_log!("       ✅ SUCCESS: Kick {} offset ({},{}) → Final ({}, {})", 
                                       kick_index, dx, dy, test_piece.x, test_piece.y);
                    return Some(test_piece);
                }
            }
            crate::console_log!("     ❌ All {} kicks failed for {}", kick_offsets.len(), kick_key);
        } else {
            crate::console_log!("     ❌ No kick data found for {}", kick_key);
        }
        
        None
    }
}

// Pre-baked tetromino masks [piece][rotation][x] -> column mask
type PieceMasks = HashMap<(PieceType, usize, i32), [u16; 4]>;

static PIECE_MASKS: Lazy<PieceMasks> = Lazy::new(|| {
    let mut masks = HashMap::new();
    let mut total_masks = 0;
    
    // Base shapes for each piece
    let base_shapes = [
        // I piece - 4x4 grid with pivot at (1, 1)
        vec![
            vec![(0, 1), (1, 1), (2, 1), (3, 1)], // Horizontal
            vec![(2, 0), (2, 1), (2, 2), (2, 3)], // Vertical
            vec![(0, 2), (1, 2), (2, 2), (3, 2)], // Horizontal
            vec![(1, 0), (1, 1), (1, 2), (1, 3)], // Vertical
        ],
        // O piece (same for all rotations) - 3x3 grid with pivot at (1, 1)
        vec![
            vec![(1, 1), (2, 1), (1, 2), (2, 2)]; 4
        ],
        // T piece - 3x3 grid with pivot at (1, 1) - FIXED TO MATCH TYPESCRIPT
        vec![
            vec![(1, 0), (0, 1), (1, 1), (2, 1)], // Rotation 0: top center + bottom row
            vec![(1, 0), (1, 1), (1, 2), (2, 1)], // Rotation 1: left column + right center
            vec![(0, 1), (1, 1), (2, 1), (1, 2)], // Rotation 2: top row + bottom center
            vec![(1, 0), (0, 1), (1, 1), (1, 2)], // Rotation 3: right column + left center
        ],
        // S piece - 3x3 grid with pivot at (1, 1)
        vec![
            vec![(1, 0), (2, 0), (0, 1), (1, 1)],
            vec![(1, 0), (1, 1), (2, 1), (2, 2)],
            vec![(1, 1), (2, 1), (0, 2), (1, 2)],
            vec![(0, 0), (0, 1), (1, 1), (1, 2)],
        ],
        // Z piece - 3x3 grid with pivot at (1, 1)
        vec![
            vec![(0, 0), (1, 0), (1, 1), (2, 1)],
            vec![(2, 0), (1, 1), (2, 1), (1, 2)],
            vec![(0, 1), (1, 1), (1, 2), (2, 2)],
            vec![(1, 0), (0, 1), (1, 1), (0, 2)],
        ],
        // J piece - 3x3 grid with pivot at (1, 1)
        vec![
            vec![(0, 0), (0, 1), (1, 1), (2, 1)],
            vec![(1, 0), (2, 0), (1, 1), (1, 2)],
            vec![(0, 1), (1, 1), (2, 1), (2, 2)],
            vec![(1, 0), (1, 1), (1, 2), (0, 2)],
        ],
        // L piece - 3x3 grid with pivot at (1, 1)
        vec![
            vec![(2, 0), (0, 1), (1, 1), (2, 1)],
            vec![(1, 0), (1, 1), (1, 2), (2, 2)],
            vec![(0, 1), (1, 1), (2, 1), (0, 2)],
            vec![(0, 0), (1, 0), (1, 1), (1, 2)],
        ],
    ];

    for (piece_idx, piece_rotations) in base_shapes.iter().enumerate() {
        let piece_type = match piece_idx {
            0 => PieceType::I,
            1 => PieceType::O,
            2 => PieceType::T,
            3 => PieceType::S,
            4 => PieceType::Z,
            5 => PieceType::J,
            6 => PieceType::L,
            _ => continue,
        };

        // Generate masks per piece type

        for (rotation, blocks) in piece_rotations.iter().enumerate() {
            // Generate masks for all possible x positions - EXTENDED RANGE for pieces near board edges
            for x_offset in -10..=20 { // Massively extended range to definitely cover x=8+ positions
                let mut mask = [0u16; 4];
                let mut has_valid_blocks = false;

                // CRITICAL FIX: Convert from grid coordinates to relative coordinates from anchor
                // This matches the TypeScript calculation: boardX = pivotBoardX + (c_shape - pivot.c)
                let pivot_col = match piece_type {
                    PieceType::I => 1, // I piece uses (1,1) pivot in 4x4 grid, but we treat it as (1,1) 
                    _ => 1, // All other pieces use (1,1) pivot in 3x3 grid
                };
                let pivot_row = 1; // All pieces use row 1 as pivot

                // VALIDATE ALL BLOCKS ARE WITHIN BOARD BOUNDS BEFORE CREATING MASK
                let mut all_blocks_valid = true;
                for &(grid_col, _grid_row) in blocks {
                    let rel_x = grid_col as i32 - pivot_col;
                    let board_x = x_offset + rel_x;
                    
                    // If ANY block would be outside board bounds (0-9), skip this position entirely
                    if board_x < 0 || board_x >= 10 {
                        all_blocks_valid = false;
                        break;
                    }
                }
                
                // Only generate mask if ALL blocks are within board bounds
                if !all_blocks_valid {
                    continue;
                }

                for &(grid_col, grid_row) in blocks {
                    // Convert grid coordinates to relative coordinates from piece anchor
                    let rel_x = grid_col as i32 - pivot_col;
                    let rel_y = grid_row as i32 - pivot_row;
                    
                    // Calculate absolute board position for this x_offset
                    let board_x = x_offset + rel_x;
                    
                    // Store relative coordinates in mask - handle negative y-offsets properly
                    // Mask array: [y-1, y+0, y+1, y+2] relative to anchor
                    let mask_y_index = rel_y + 1; // Convert relative y (-1,0,1,2) to array index (0,1,2,3)
                    
                    // Only add blocks that are within the 16-bit mask range and valid mask array bounds
                    if board_x >= 0 && board_x < 16 && mask_y_index >= 0 && mask_y_index < 4 {
                        mask[mask_y_index as usize] |= 1 << board_x;
                        has_valid_blocks = true;
                    }
                }

                // Create mask if it has any valid blocks
                if has_valid_blocks {
                    masks.insert((piece_type, rotation, x_offset), mask);
                    total_masks += 1;
                }
            }
        }
    }
    
    crate::console_log!("🧩 PIECE_MASKS: generated {} masks", total_masks);
    
    masks
});

// Placement position for each piece type and rotation
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Placement {
    pub x: i32,
    pub y: i32,
    pub rotation: usize,
}

impl Placement {
}

impl Default for Placement {
    fn default() -> Self {
        Self { x: 0, y: 0, rotation: 0 }
    }
} 