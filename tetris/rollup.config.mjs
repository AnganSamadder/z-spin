import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/game.ts',
  output: {
    dir: 'dist',
    format: 'es', // ES modules format to support dynamic imports
    sourcemap: true,
    entryFileNames: 'bundle.js',
    chunkFileNames: '[name]-[hash].js'
  },
  plugins: [
    resolve({ browser: true }), // Helps Rollup find external modules, with browser specific resolution
    commonjs(), // Converts CommonJS modules to ES6, so they can be included in a Rollup bundle
    typescript({ tsconfig: './tsconfig.json' }) // Integrates TypeScript with Rollup
  ]
}; 