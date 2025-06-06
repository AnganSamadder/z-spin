#!/bin/bash
set -e

# Build the Rust code to WebAssembly
echo "Building Rust to WebAssembly..."

# Clean previous builds
rm -rf ../tetris/wasm || true

# Build with wasm-pack using the web target and no-typescript feature
# --target web: generates JS that uses ES modules and can be imported directly by browsers
# The --debug flag can be helpful during development for better error messages
wasm-pack build --target web --out-dir ../tetris/wasm --release 

# Add some helpful debug info
echo "Generated files:"
ls -la ../tetris/wasm/

echo "WASM build complete!" 