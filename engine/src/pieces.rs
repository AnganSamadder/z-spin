use once_cell::sync::Lazy;
use std::collections::HashMap;
use crate::board::BOARD_WIDTH;

// SRS Wall Kick Tables
static KICK_DATA_JLSTZ: Lazy<HashMap<String, Vec<(i32, i32)>>> = Lazy::new(|| {
    let mut kicks = HashMap::new();
    
    // Basic rotations (0->1, 1->2, 2->3, 3->0)
    kicks.insert("0->1".to_string(), vec![(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)]);
    kicks.insert("1->0".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("1->2".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("2->1".to_string(), vec![(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)]);
    kicks.insert("2->3".to_string(), vec![(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)]);
    kicks.insert("3->2".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)]);
    kicks.insert("3->0".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)]);
    kicks.insert("0->3".to_string(), vec![(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)]);
    
    // 180 degree rotations
    kicks.insert("0->2".to_string(), vec![(0, 0), (1, 0), (1, 1), (0, 1), (1, -1), (0, -1)]);
    kicks.insert("1->3".to_string(), vec![(0, 0), (0, 1), (-1, 1), (-1, 0), (-1, 2), (0, 2)]);
    kicks.insert("2->0".to_string(), vec![(0, 0), (-1, 0), (-1, -1), (0, -1), (-1, 1), (0, 1)]);
    kicks.insert("3->1".to_string(), vec![(0, 0), (0, -1), (1, -1), (1, 0), (1, -2), (0, -2)]);
    
    kicks
});

static KICK_DATA_I: Lazy<HashMap<String, Vec<(i32, i32)>>> = Lazy::new(|| {
    let mut kicks = HashMap::new();
    
    // Basic rotations
    kicks.insert("0->1".to_string(), vec![(0, 0), (-2, 0), (1, 0), (-2, -1), (1, 2)]);
    kicks.insert("1->0".to_string(), vec![(0, 0), (2, 0), (-1, 0), (2, 1), (-1, -2)]);
    kicks.insert("1->2".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)]);
    kicks.insert("2->1".to_string(), vec![(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)]);
    kicks.insert("2->3".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, -2), (2, -2)]);
    kicks.insert("3->2".to_string(), vec![(0, 0), (2, 0), (-1, 0), (2, 1), (-1, 1)]);
    kicks.insert("3->0".to_string(), vec![(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)]);
    kicks.insert("0->3".to_string(), vec![(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)]);
    
    // 180 degree rotations
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
            for (kick_index, &(dx, dy)) in kick_offsets.iter().enumerate() {
                let test_piece = Self {
                    piece_type: self.piece_type,
                    x: self.x + dx,
                    y: self.y - dy, // SRS y-kicks are inverted for board coordinates
                    rotation: new_rotation,
                };
                
                if board.can_place_piece(&test_piece) {
                    // Log when a kick is used for 180 rotations
                    if kick_index > 0 {
                        crate::console_log!("🔄 180° KICK APPLIED: {:?} {} -> {} at ({},{}) with kick #{} offset ({},{})", 
                            self.piece_type, self.rotation, new_rotation, self.x, self.y, kick_index, dx, dy);
                    }
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
            for (kick_index, &(dx, dy)) in kick_offsets.iter().enumerate() {
                let test_piece = Self {
                    piece_type: self.piece_type,
                    x: self.x + dx,
                    y: self.y - dy, // SRS y-kicks are inverted for board coordinates
                    rotation: new_rotation,
                };
                
                if board.can_place_piece(&test_piece) {
                    // Log when a kick is used (kick_index > 0 means we used a kick, not just basic rotation)
                    if kick_index > 0 {
                        crate::console_log!("🔄 KICK APPLIED: {:?} {} -> {} at ({},{}) with kick #{} offset ({},{})", 
                            self.piece_type, self.rotation, new_rotation, self.x, self.y, kick_index, dx, dy);
                    }
                    return Some(test_piece);
                }
            }
        }
        
        None
    }
}

// Pre-baked tetromino masks [piece][rotation][x] -> column mask
type PieceMasks = HashMap<(PieceType, usize, i32), [u16; 4]>;

static PIECE_MASKS: Lazy<PieceMasks> = Lazy::new(|| {
    let mut masks = HashMap::new();
    
    // Base shapes for each piece
    let base_shapes = [
        // I piece
        vec![
            vec![(0, 1), (1, 1), (2, 1), (3, 1)], // Horizontal
            vec![(2, 0), (2, 1), (2, 2), (2, 3)], // Vertical
            vec![(0, 2), (1, 2), (2, 2), (3, 2)], // Horizontal
            vec![(1, 0), (1, 1), (1, 2), (1, 3)], // Vertical
        ],
        // O piece (same for all rotations)
        vec![
            vec![(1, 1), (2, 1), (1, 2), (2, 2)]; 4
        ],
        // T piece
        vec![
            vec![(1, 0), (0, 1), (1, 1), (2, 1)], // Rotation 0 (Up)
            vec![(1, 0), (1, 1), (1, 2), (2, 1)], // Rotation 1 (Right)
            vec![(0, 1), (1, 1), (2, 1), (1, 2)], // Rotation 2 (Down)
            vec![(1, 0), (0, 1), (1, 1), (1, 2)], // Rotation 3 (Left)
        ],
        // S piece
        vec![
            vec![(1, 0), (2, 0), (0, 1), (1, 1)],
            vec![(1, 0), (1, 1), (2, 1), (2, 2)],
            vec![(1, 1), (2, 1), (0, 2), (1, 2)],
            vec![(0, 0), (0, 1), (1, 1), (1, 2)],
        ],
        // Z piece
        vec![
            vec![(0, 0), (1, 0), (1, 1), (2, 1)],
            vec![(2, 0), (1, 1), (2, 1), (1, 2)],
            vec![(0, 1), (1, 1), (1, 2), (2, 2)],
            vec![(1, 0), (0, 1), (1, 1), (0, 2)],
        ],
        // J piece
        vec![
            vec![(0, 0), (0, 1), (1, 1), (2, 1)],
            vec![(1, 0), (2, 0), (1, 1), (1, 2)],
            vec![(0, 1), (1, 1), (2, 1), (2, 2)],
            vec![(1, 0), (1, 1), (1, 2), (0, 2)],
        ],
        // L piece
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

        for (rotation, blocks) in piece_rotations.iter().enumerate() {
            // Generate masks for all possible x positions
            for x_offset in -3..=10 {
                let mut mask = [0u16; 4];
                let mut is_valid = true;

                // Check if all blocks are within bounds before creating mask
                for &(bx, _by) in blocks {
                    let board_x = x_offset + bx as i32;
                    if board_x < 0 || board_x >= BOARD_WIDTH as i32 {
                        is_valid = false;
                        break;
                    }
                }

                if is_valid {
                    for &(bx, by) in blocks {
                        let board_x = x_offset + bx as i32;
                        mask[by] |= 1 << board_x;
                    }
                    masks.insert((piece_type, rotation, x_offset), mask);
                }
            }
        }
    }
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
    pub fn new(x: i32, y: i32, rotation: usize) -> Self {
        Self { x, y, rotation }
    }
}

impl Default for Placement {
    fn default() -> Self {
        Self { x: 0, y: 0, rotation: 0 }
    }
} 