use crate::board::{Board};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, Copy, PartialEq)]
pub enum Strategy {
    Balanced,
    Aggressive,
    Defensive,
    TSpan,
}

#[derive(Clone, Debug, Default)]
pub struct Evaluation {
    pub score: f64,
}

#[derive(Clone, Debug)]
pub struct EvaluationWeights {
    pub aggregate_height: f64,
    pub max_height: f64,
    pub bumpiness: f64,
    pub holes: f64,
    pub completed_lines: f64,
}

impl EvaluationWeights {
    pub fn new(strategy: Strategy) -> Self {
        match strategy {
            Strategy::Balanced => Self {
                aggregate_height: -0.51,
                max_height: -0.18,
                bumpiness: -0.18,
                holes: -0.36,
                completed_lines: 0.76,
            },
            Strategy::Aggressive => Self {
                aggregate_height: -0.3,
                max_height: -0.12,
                bumpiness: -0.12,
                holes: -0.28,
                completed_lines: 0.5,
            },
            Strategy::Defensive => Self {
                aggregate_height: -0.8,
                max_height: -0.9,
                bumpiness: -0.5,
                holes: -0.6,
                completed_lines: 1.2,
            },
            Strategy::TSpan => Self {
                aggregate_height: -0.45,
                max_height: -0.6,
                bumpiness: -0.25,
                holes: -0.5,
                completed_lines: 0.9,
            },
        }
    }
}

impl Default for EvaluationWeights {
    fn default() -> Self {
        Self {
            aggregate_height: -0.51,
            max_height: -0.18,
            bumpiness: -0.18,
            holes: -0.36,
            completed_lines: 0.76,
        }
    }
}

impl Board {
    pub fn evaluate(&self, weights: &EvaluationWeights) -> Evaluation {
        let (total_height, max_height, holes, bumpiness) = self.get_evaluation_metrics();
        
        let score =
            total_height * weights.aggregate_height
                + max_height * weights.max_height
                + holes * weights.holes
                + bumpiness * weights.bumpiness;

        Evaluation {
            score,
        }
    }
} 