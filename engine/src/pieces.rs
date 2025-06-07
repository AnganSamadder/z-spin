use once_cell::sync::Lazy;
use std::collections::HashMap;
use crate::board::BOARD_WIDTH;

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

    pub fn rotated(&self, clockwise: bool) -> Self {
        let new_rotation = if clockwise {
            (self.rotation + 1) % 4
        } else {
            (self.rotation + 3) % 4
        };
        Self {
            rotation: new_rotation,
            ..*self
        }
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