extern crate console_error_panic_hook;
use wasm_bindgen::prelude::*;

mod board;
mod pieces;
mod search;
mod evaluation;
mod engine;

use engine::TetrisEngine;
use crate::evaluation::Strategy;

// Console.log for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Make log function available to modules
pub(crate) fn console_log_fn(msg: &str) {
    log(msg);
}

// Simple macro for console.log that uses our wrapper function
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => (crate::console_log_fn(&format_args!($($t)*).to_string()))
}

// === WASM INTERFACE ===

#[wasm_bindgen]
pub struct WasmTetrisEngine {
    engine: TetrisEngine,
}

#[wasm_bindgen]
impl WasmTetrisEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log!("Advanced Tetris AI Engine initialized");
        Self {
            engine: TetrisEngine::new(),
        }
    }

    #[wasm_bindgen(js_name = configureMovement)]
    pub fn configure_movement(&mut self, arr: u32, das: u32, sdf: u32, dcd: u32) {
        self.engine.configure_movement(arr, das, sdf, dcd);
    }

    #[wasm_bindgen(js_name = configureLogging)]
    pub fn configure_logging(&mut self, debug: bool) {
        self.engine.configure_logging(debug);
    }

    pub fn get_best_move(&mut self, board: Vec<i32>, current_piece: i32, next_piece: i32, strategy: Strategy) -> String {
        self.engine.get_best_move(&board, current_piece, next_piece, strategy)
    }

    pub fn get_full_move_sequence(&mut self, board: Vec<i32>, current_piece: i32, next_piece: i32, strategy: Strategy) -> String {
        self.engine.get_full_move_sequence(&board, current_piece, next_piece, strategy)
    }

    // Legacy methods for compatibility
    pub fn move_left(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_left() called");
        false
    }

    pub fn move_right(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_right() called");
        false
    }

    pub fn move_down(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_down() called");
        false
    }

    pub fn rotate(&mut self) -> bool {
        console_log!("WasmTetrisEngine::rotate() called");
        false
    }

    pub fn spawn_tetromino(&mut self, type_key: i32) -> bool {
        console_log!("WasmTetrisEngine::spawn_tetromino({}) called", type_key);
        false
    }

    pub fn get_game_state_json(&self) -> String {
        "{}".to_string()
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    console_log!("🚀🚀🚀 WASM LOADED: {} - SMART FLAT BUILDER (GEOMETRY-AWARE) 🚀🚀🚀", "2024-06-06 18:05");
} 