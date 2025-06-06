/* tslint:disable */
/* eslint-disable */
export function start(): void;
export class WasmTetrisEngine {
  free(): void;
  constructor();
  get_best_move(_board: Int32Array, _current_piece: number, _next_piece: number): string;
  move_left(): boolean;
  move_right(): boolean;
  move_down(): boolean;
  rotate(): boolean;
  spawn_tetromino(type_key: number): boolean;
  get_game_state_json(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmtetrisengine_free: (a: number, b: number) => void;
  readonly wasmtetrisengine_new: () => number;
  readonly wasmtetrisengine_get_best_move: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wasmtetrisengine_move_left: (a: number) => number;
  readonly wasmtetrisengine_move_right: (a: number) => number;
  readonly wasmtetrisengine_move_down: (a: number) => number;
  readonly wasmtetrisengine_rotate: (a: number) => number;
  readonly wasmtetrisengine_spawn_tetromino: (a: number, b: number) => number;
  readonly wasmtetrisengine_get_game_state_json: (a: number) => [number, number];
  readonly start: () => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
