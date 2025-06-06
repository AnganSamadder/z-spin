import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

// Custom plugin for handling direct WASM imports
const wasmImportResolver = () => {
  return {
    name: 'wasm-import-resolver',
    resolveId(source) {
      // If it's a WASM import path, mark it as external
      if (source.startsWith('/wasm/')) {
        return { id: source, external: true };
      }
      return null;
    }
  };
};

export default {
  input: 'src/game.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    wasmImportResolver(),
    typescript({ 
      tsconfig: './tsconfig.json' 
    }),
    resolve({ 
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ],
  external: [/\/wasm\/.*/],
  onwarn(warning, warn) {
    // Ignore certain warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EMPTY_BUNDLE') return;
    // For unresolved imports to WASM files, don't warn
    if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.startsWith('/wasm/')) return;
    
    // Use default for everything else
    warn(warning);
  }
}; 