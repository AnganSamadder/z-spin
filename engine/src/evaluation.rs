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
}

impl EvaluationWeights {
    pub fn new(strategy: Strategy) -> Self {
        match strategy {
            Strategy::Balanced => Self {
                aggregate_height: -0.2,
                max_height: -0.5,
                bumpiness: -0.3,
                holes: -10.0,
            },
            Strategy::Aggressive => Self {
                aggregate_height: -0.1,
                max_height: -0.3,
                bumpiness: -0.2,
                holes: -8.0,
            },
            Strategy::Defensive => Self {
                aggregate_height: -0.8,
                max_height: -2.0,
                bumpiness: -0.5,
                holes: -15.0,
            },
            Strategy::TSpan => Self {
                aggregate_height: -0.3,
                max_height: -0.8,
                bumpiness: -0.25,
                holes: -12.0,
            },
        }
    }
}

impl Default for EvaluationWeights {
    fn default() -> Self {
        Self {
            aggregate_height: -0.51,
            max_height: -1.76,
            bumpiness: -0.18,
            holes: -0.36,
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