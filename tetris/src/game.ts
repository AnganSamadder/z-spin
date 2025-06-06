import * as Phaser from 'phaser';
import { SettingsScene } from './scenes/SettingsScene';
import { GameScene } from './scenes/GameScene';
import { 
    BLOCK_SIZE,
    VISIBLE_BOARD_HEIGHT_BLOCKS,
    UI_SIDE_MARGIN,
    UI_ELEMENTS_TOP_Y,
    NEXT_AREA_WIDTH,
    NEXT_AREA_OFFSET_X,
} from './constants';


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: NEXT_AREA_OFFSET_X + NEXT_AREA_WIDTH + UI_SIDE_MARGIN, 
    height: UI_ELEMENTS_TOP_Y + (VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE) + BLOCK_SIZE, // Canvas height based on visible board
    parent: 'game-container',
    scene: [GameScene, SettingsScene], 
    render: {
        pixelArt: true, 
        antialias: false, 
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

window.onload = () => {
    const game = new Phaser.Game(config);
}; 