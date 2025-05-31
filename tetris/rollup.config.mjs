import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/game.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'iife', // Immediately Invoked Function Expression - suitable for <script> tags
    sourcemap: true,
    name: 'MyGame' // Global variable name for your game
  },
  plugins: [
    resolve(), // Helps Rollup find external modules
    commonjs(), // Converts CommonJS modules to ES6, so they can be included in a Rollup bundle
    typescript({ tsconfig: './tsconfig.json' }) // Integrates TypeScript with Rollup
  ]
}; 