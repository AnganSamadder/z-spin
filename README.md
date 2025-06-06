# Z-Spin Tetris

A Tetris game built with Phaser 3, TypeScript, and Rust WebAssembly.

## Prerequisites

- Node.js (v14+)
- Rust (latest stable)
- wasm-pack (`cargo install wasm-pack`)

## Project Structure

- `engine/` - Rust code for the WASM engine
- `tetris/` - TypeScript/Phaser game code

## Setup and Run

1. Install dependencies:

```bash
cd tetris
npm install
```

2. Build the WASM module:

```bash
cd engine
./build.sh
```

Or use the npm script:

```bash
cd tetris
npm run build:wasm
```

3. Build the game:

```bash
cd tetris
npm run build
```

4. Start the server:

```bash
cd tetris
npm start
```

5. Open your browser at `http://localhost:3000`

## Development

For development with hot reloading:

```bash
cd tetris
npm run dev
```

## Features

- Standard Tetris gameplay in JavaScript
- Optional WASM engine (toggle with the "Play WASM Engine" button)
- Customizable controls and settings

## License

MIT
