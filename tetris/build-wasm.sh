#!/bin/bash
set -e

# Navigate to the engine directory from tetris
echo "Building Rust to WebAssembly..."

# Clean previous builds
rm -rf ./public/wasm || true

# Create output directory if doesn't exist
mkdir -p ./public/wasm

# Move to the engine directory
cd ../engine

# Build with wasm-pack using the web target
echo "Compiling Rust to WASM..."
wasm_pack_output=$(wasm-pack build --target web --out-dir ../tetris/public/wasm --release 2>&1) || {
  echo "Error building WASM module:"
  echo "$wasm_pack_output"
  exit 1
}

# Add some helpful debug info
echo "Generated files:"
ls -la ../tetris/public/wasm/

echo "Moving files to the correct location..."
# Ensure the static directory exists
mkdir -p ../tetris/public/static

# Copy the WASM and JS files to where they can be served
cp -f ../tetris/public/wasm/* ../tetris/public/static/

echo "WASM build complete and files copied to public/static!" 