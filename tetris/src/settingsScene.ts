import * as Phaser from 'phaser';
import { GameSettings, DEFAULT_SETTINGS } from './types'; // Import from types.ts instead of game.ts

export class SettingsScene extends Phaser.Scene {
    private gameSceneKey: string | null = null;
    private currentSettings!: GameSettings;
    private activeTab: 'Gameplay' | 'Controls' | 'AudioVisual' = 'Gameplay';
    private settingsObjects: Phaser.GameObjects.GameObject[] = []; // To store all settings UI elements for easy show/hide

    constructor() {
        super({ key: 'SettingsScene' });
    }

    init(data: { gameScene: Phaser.Scene }): void {
        this.gameSceneKey = data.gameScene.scene.key;
        this.currentSettings = { ...DEFAULT_SETTINGS, ...this.registry.get('gameSettings') };
    }

    private saveSettings(): void {
        console.log('[SettingsScene] saveSettings CALLED. Registry will be updated with:', JSON.parse(JSON.stringify(this.currentSettings))); // Log a deep copy
        this.registry.set('gameSettings', this.currentSettings);
        // console.log('Settings saved:', this.currentSettings); // Original log, now covered by the one above
    }

    create(): void {
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0.95)');
        const centerX = this.cameras.main.width / 2;
        let currentY = 60; // Starting Y for the main "Settings" title
        const settingSpacing = 60; // Increased spacing for sliders
        const labelXOffset = 220; // X offset for labels from center, to make space for slider

        this.add.text(centerX, currentY, 'Settings', { font: '40px Arial', color: '#ffffff' }).setOrigin(0.5);
        currentY += settingSpacing * 0.8; // Space after main title

        // --- Create Tabs ---
        const tabButtonY = currentY;
        const tabButtonSpacing = 150;
        const gameplayTabButton = this.add.text(centerX - tabButtonSpacing, tabButtonY, 'Gameplay', { font: '24px Arial', color: '#ffffff', backgroundColor: '#333333', padding: {left:10, right:10, top:5, bottom:5}})
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.switchTab('Gameplay'));

        const controlsTabButton = this.add.text(centerX, tabButtonY, 'Controls', { font: '24px Arial', color: '#ffffff', backgroundColor: '#333333', padding: {left:10, right:10, top:5, bottom:5}})
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.switchTab('Controls'));

        const audioVisualTabButton = this.add.text(centerX + tabButtonSpacing, tabButtonY, 'Audio/Visual', { font: '24px Arial', color: '#ffffff', backgroundColor: '#333333', padding: {left:10, right:10, top:5, bottom:5}})
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.switchTab('AudioVisual'));
        
        this.updateTabHighlights(gameplayTabButton, controlsTabButton, audioVisualTabButton);

        currentY += settingSpacing; // Space after tabs

        // --- Create all settings elements (initially some might be hidden) ---
        this.settingsObjects = []; // Clear before recreating

        // --- Gameplay Settings ---
        let gameplayY = currentY;
        const ghostPieceToggle = this.createToggle(
            centerX - labelXOffset + 150, 
            gameplayY, 
            'Ghost Piece:',
            this.currentSettings.ghostPieceEnabled,
            (newValue) => { this.currentSettings.ghostPieceEnabled = newValue; this.saveSettings(); }
        );
        this.settingsObjects.push(...ghostPieceToggle);
        gameplayY += settingSpacing;

        const gravitySlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'Gravity (ms):',
            'gravityValue', 50, 2000, 50,
            false
        );
        this.settingsObjects.push(...gravitySlider);
        gameplayY += settingSpacing;

        const arrSlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'ARR (ms):',
            'arr', 0, 200, 1, 
            false
        );
        this.settingsObjects.push(...arrSlider);
        gameplayY += settingSpacing;

        const dasSlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'DAS (ms):',
            'das', 0, 300, 1, 
            false
        );
        this.settingsObjects.push(...dasSlider);
        gameplayY += settingSpacing;
        
        const dcdSlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'DCD (ms):',
            'dcd', 0, 100, 1, 
            false
        );
        this.settingsObjects.push(...dcdSlider);
        gameplayY += settingSpacing;

        const sdfSlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'SDF (xGrav):',
            'sdf', 1, 50, 1, 
            true, 50 
        );
        this.settingsObjects.push(...sdfSlider);
        gameplayY += settingSpacing;
        
        const nextQueueSlider = this.createSlider(
            centerX - labelXOffset, gameplayY, 'Next Pieces:',
            'nextQueueSize', 0, 6, 1, 
            false
        );
        this.settingsObjects.push(...nextQueueSlider);
        // gameplayY += settingSpacing; // No more gameplay settings after this

        // --- Audio/Visual Settings ---
        let audioVisualY = currentY; // Start from the same Y as gameplay for now, will be hidden/shown
        // const audioVisualTitle = this.add.text(centerX, audioVisualY, 'Volume & Visuals', { font: '28px Arial', color: '#ffffff' }).setOrigin(0.5);
        // this.settingsObjects.push(audioVisualTitle);
        // audioVisualY += settingSpacing * 0.8;

        const masterVolSlider = this.createSlider(centerX - labelXOffset, audioVisualY, 'Master:', 'masterVolume', 0, 100, 1, false);
        this.settingsObjects.push(...masterVolSlider);
        audioVisualY += settingSpacing;
        const sfxVolSlider = this.createSlider(centerX - labelXOffset, audioVisualY, 'SFX:', 'sfxVolume', 0, 100, 1, false);
        this.settingsObjects.push(...sfxVolSlider);
        audioVisualY += settingSpacing;
        const musicVolSlider = this.createSlider(centerX - labelXOffset, audioVisualY, 'Music:', 'musicVolume', 0, 100, 1, false);
        this.settingsObjects.push(...musicVolSlider);
        // audioVisualY += settingSpacing * 1.2;


        // --- Controls Settings (Keybindings) ---
        let controlsY = currentY; // Start from the same Y
        // const keybindsTitle = this.add.text(centerX, controlsY, 'Keybindings', { font: '28px Arial', color: '#ffffff' }).setOrigin(0.5);
        // this.settingsObjects.push(keybindsTitle);
        // controlsY += settingSpacing * 0.8;

        const actionDisplayNames: { [key in keyof GameSettings['keybinds']]: string } = {
            moveLeft: 'Move Left:',
            moveRight: 'Move Right:',
            rotateCW: 'Rotate CW:',
            rotateCCW: 'Rotate CCW:',
            rotate180: 'Rotate 180:',
            softDrop: 'Soft Drop:',
            hardDrop: 'Hard Drop:',
            holdPiece: 'Hold Piece:',
            resetGame: 'Reset Game:'
        };
        
        const keybindActions: (keyof GameSettings['keybinds'] )[] = [
            'moveLeft', 'moveRight',
            'rotateCW', 'rotateCCW', 'rotate180', // rotate180 moved here
            'softDrop', 'hardDrop', 'holdPiece', 'resetGame'
        ];
        
        const keybindLabelX = centerX - 225; // Adjusted from -270 to center the interactive keybind elements
        const initialControlsYSpacing = 30; // Controls settings closer together (reduced from 30)

        for (const action of keybindActions) {
            const keybindEditors = this.createKeybindEditor(keybindLabelX, controlsY, actionDisplayNames[action], action);
            this.settingsObjects.push(...keybindEditors);
            controlsY += initialControlsYSpacing; 
        }
        // controlsY += keybindSpacing; 

        // --- Back Button (position dynamically based on content height or fixed at bottom) ---
        // For simplicity, let's keep it at a fixed position near the bottom.
        // It might overlap if a tab has too much content, but we can adjust later.
        const backButton = this.add.text(centerX, this.cameras.main.height - 40, 'Apply', { font: '32px Arial', color: '#00ff00', backgroundColor: '#222222', padding: {left: 15, right: 15, top: 8, bottom: 8} })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        backButton.on('pointerdown', () => {
            this.saveSettings();
            if (this.gameSceneKey) {
                this.scene.resume(this.gameSceneKey);
            }
            this.scene.stop();
        });

        this.switchTab(this.activeTab); // Initial tab display
    }

    private updateTabHighlights(
        gameplayTabButton: Phaser.GameObjects.Text, 
        controlsTabButton: Phaser.GameObjects.Text, 
        audioVisualTabButton: Phaser.GameObjects.Text
    ): void {
        gameplayTabButton.setBackgroundColor(this.activeTab === 'Gameplay' ? '#555555' : '#333333');
        controlsTabButton.setBackgroundColor(this.activeTab === 'Controls' ? '#555555' : '#333333');
        audioVisualTabButton.setBackgroundColor(this.activeTab === 'AudioVisual' ? '#555555' : '#333333');
    }

    private switchTab(tabName: 'Gameplay' | 'Controls' | 'AudioVisual'): void {
        this.activeTab = tabName;
        console.log(`Switched to tab: ${tabName}`);

        // Update tab button highlights
        const children = this.children.list;
        let gameplayBtn, controlsBtn, audioVisualBtn;
        for (let child of children) {
            if (child instanceof Phaser.GameObjects.Text) {
                if (child.text === 'Gameplay') gameplayBtn = child as Phaser.GameObjects.Text;
                else if (child.text === 'Controls') controlsBtn = child as Phaser.GameObjects.Text;
                else if (child.text === 'Audio/Visual') audioVisualBtn = child as Phaser.GameObjects.Text;
            }
        }
        if (gameplayBtn && controlsBtn && audioVisualBtn) {
            this.updateTabHighlights(gameplayBtn, controlsBtn, audioVisualBtn);
        }

        // Hide all settings game objects first
        this.settingsObjects.forEach(obj => {
            // Cast to a type that has setVisible and setActive, or use instanceof checks
            const specificObj = obj as Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Zone; // Add other relevant types if necessary
            if (specificObj.setVisible && specificObj.setActive) {
                specificObj.setVisible(false);
                specificObj.setActive(false);
            }
        });

        const centerX = this.cameras.main.width / 2;
        let currentY = 160; // Default starting Y position below the tabs
        if (tabName === 'Controls') {
            currentY = 130; // Specific, higher starting Y for Controls tab
        }
        const settingSpacing = 60; // Vertical spacing between settings
        const labelXOffset = 220; // X offset for labels from center for sliders
        const toggleXOffset = 150; // Adjusted X for toggle from center (this is the x param for createToggle)
        const keybindLabelX = centerX - 225; // Adjusted from -270 to center the interactive keybind elements
        const keybindItemSpacing = 20; // Specific Y spacing for keybind items - REDUCED from 30

        // Constants for repositioning logic, mirroring those in createSlider
        const sliderHeight = 10;
        const thumbHeight = 20;
        const sliderWidth = 200;
        const valueTextXOffset = sliderWidth + 30;
        // Constants for keybinds, from createKeybindEditor
        const keyDisplayWidth = 120;
        const buttonWidth = 50;
        const horizontalSpacing = 10;


        const repositionObjects = (objectsToShow: Phaser.GameObjects.GameObject[], isKeybind: boolean = false) => {
            // objectsToShow contains the primary elements (labels or first keybind display) for the current tab
            objectsToShow.forEach(primaryElement => {
                // The primaryElement itself (label or first keybind text) also needs to be visible.
                // It will be handled when its group is processed.

                if (primaryElement.name.endsWith('_label') || primaryElement.name.endsWith('_display1')) {
                    const groupName = primaryElement.name.substring(0, primaryElement.name.lastIndexOf('_'));
                    
                    this.settingsObjects.filter(gObj => gObj.name.startsWith(groupName)).forEach(part => {
                        // Ensure part is treated as a type that has setVisible and setActive
                        const interactivePart = part as Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Zone;
                        interactivePart.setVisible(true);
                        interactivePart.setActive(true);

                        // Set X and Y positions for each part of the group
                        if (part.name.startsWith('toggle_')) {
                            const toggleBaseX = centerX - labelXOffset + toggleXOffset;
                            if (part.name.endsWith('_label')) {
                                (part as Phaser.GameObjects.Text).x = toggleBaseX - 10;
                                (part as Phaser.GameObjects.Text).y = currentY;
                            } else if (part.name.endsWith('_button')) {
                                (part as Phaser.GameObjects.Text).x = toggleBaseX + 10;
                                (part as Phaser.GameObjects.Text).y = currentY;
                            }
                        } else if (part.name.startsWith('slider_')) {
                            const sliderBaseX = centerX - labelXOffset;
                            if (part.name.endsWith('_label')) {
                                (part as Phaser.GameObjects.Text).x = sliderBaseX;
                                (part as Phaser.GameObjects.Text).y = currentY;
                            } else if (part.name.endsWith('_track')) {
                                (part as Phaser.GameObjects.Graphics).x = sliderBaseX + 180;
                                (part as Phaser.GameObjects.Graphics).y = currentY - sliderHeight / 2;
                            } else if (part.name.endsWith('_thumb')) {
                                // X is set by updateThumbAndValue. RepositionObjects only handles Y.
                                (part as Phaser.GameObjects.Graphics).y = currentY - thumbHeight / 2;
                            } else if (part.name.endsWith('_thumbinteractive')) {
                                // X is set by updateThumbAndValue (it follows the thumb). RepositionObjects only handles Y.
                                (part as Phaser.GameObjects.Zone).y = currentY;
                            } else if (part.name.endsWith('_valuedisplay')) {
                                (part as Phaser.GameObjects.Text).x = sliderBaseX + 180 + valueTextXOffset;
                                (part as Phaser.GameObjects.Text).y = currentY;
                            } else if (part.name.endsWith('_trackZone')) {
                                (part as Phaser.GameObjects.Zone).x = sliderBaseX + 180;
                                (part as Phaser.GameObjects.Zone).y = currentY - sliderHeight / 2;
                            }
                        } else if (part.name.startsWith('keybind_')) {
                            const keybindBaseXForParts = keybindLabelX; // This is the 'x' passed to createKeybindEditor
                            (part as Phaser.GameObjects.Text).y = currentY; // All parts of a keybind editor row share the same Y, and are Text objects
                            if (part.name.endsWith('_label')) {
                                (part as Phaser.GameObjects.Text).x = keybindBaseXForParts;
                            } else if (part.name.endsWith('_display1')) {
                                (part as Phaser.GameObjects.Text).x = keybindBaseXForParts + horizontalSpacing + 20;
                            } else if (part.name.endsWith('_button1')) {
                                (part as Phaser.GameObjects.Text).x = keybindBaseXForParts + horizontalSpacing + 20 + keyDisplayWidth + horizontalSpacing;
                            } else if (part.name.endsWith('_display2')) {
                                (part as Phaser.GameObjects.Text).x = keybindBaseXForParts + horizontalSpacing + 20 + keyDisplayWidth + horizontalSpacing + buttonWidth + horizontalSpacing + 20;
                            } else if (part.name.endsWith('_button2')) {
                                (part as Phaser.GameObjects.Text).x = keybindBaseXForParts + horizontalSpacing + 20 + keyDisplayWidth + horizontalSpacing + buttonWidth + horizontalSpacing + 20 + keyDisplayWidth + horizontalSpacing;
                            }
                        }
                    });
                    currentY += isKeybind ? keybindItemSpacing : settingSpacing;
                }
            });
        };

        if (tabName === 'Gameplay') {
            const gameplayObjects = this.settingsObjects.filter(obj => 
                obj.name.startsWith('toggle_ghostpiece') || // Corrected name
                obj.name.startsWith('slider_gravityValue') ||
                obj.name.startsWith('slider_arr') ||
                obj.name.startsWith('slider_das') ||
                obj.name.startsWith('slider_dcd') ||
                obj.name.startsWith('slider_sdf') ||
                obj.name.startsWith('slider_nextQueueSize')
            );
            repositionObjects(gameplayObjects);
        } else if (tabName === 'Controls') {
            const controlsObjects = this.settingsObjects.filter(obj => 
                obj.name.startsWith('keybind_')
            );
            repositionObjects(controlsObjects, true);
        } else if (tabName === 'AudioVisual') {
            const audioVisualObjects = this.settingsObjects.filter(obj =>
                obj.name.startsWith('slider_masterVolume') ||
                obj.name.startsWith('slider_sfxVolume') ||
                obj.name.startsWith('slider_musicVolume')
            );
            repositionObjects(audioVisualObjects);
        }
    }

    private createToggle(x: number, y: number, label: string, initialValue: boolean, callback: (newValue: boolean) => void): Phaser.GameObjects.GameObject[] {
        const labelObj = this.add.text(x - 10, y, label, { font: '22px Arial', color: '#ffffff' }).setOrigin(1, 0.5); // Label to the left of toggle
        const toggleText = initialValue ? 'ON' : 'OFF';
        const color = initialValue ? '#00ff00' : '#ff0000';
        const toggleButton = this.add.text(x + 10, y, toggleText, { font: '22px Arial', color: color, backgroundColor: '#333333', padding: { left:10, right:10, top:3, bottom:3 } })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
        
        const namePrefix = 'toggle_' + label.toLowerCase().replace(/\s+/g, '').replace(':', ''); // e.g., toggle_ghostpiece
        labelObj.setName(namePrefix + '_label');
        toggleButton.setName(namePrefix + '_button');
        
        // Set initial positions (will be updated by switchTab)
        labelObj.x = x - 10; labelObj.y = y;
        toggleButton.x = x + 10; toggleButton.y = y;

        toggleButton.on('pointerdown', () => {
            // Determine the correct property key from the label (more robustly if possible)
            let currentActualValue: boolean | undefined;
            if (label.toLowerCase().includes('ghost piece')) {
                currentActualValue = this.currentSettings.ghostPieceEnabled;
            }
            // Add more direct property checks if new toggles are added.
            
            if (typeof currentActualValue === 'boolean') {
                const newToggleState = !currentActualValue;
                callback(newToggleState); // This will update this.currentSettings via the callback
                toggleButton.setText(newToggleState ? 'ON' : 'OFF');
                toggleButton.setColor(newToggleState ? '#00ff00' : '#ff0000');
            }
        });
        return [labelObj, toggleButton];
    }

    private formatEventCode(code: string): string {
        if (code.startsWith('Key') && code.length === 4) {
            return code.substring(3);
        }
        if (code.startsWith('Digit') && code.length === 6) {
            return code.substring(5);
        }
        // Keep common names as is, or simplify if needed
        // e.g., ArrowUp, ArrowDown, Space, Enter, Escape
        return code;
    }

    private createSlider(
        x: number, y: number, labelText: string, settingKey: keyof GameSettings,
        minValue: number, maxValue: number, step: number,
        isInfinityAllowed: boolean = false, infinityValueRepresentation?: number
    ): Phaser.GameObjects.GameObject[] {
        const labelObj = this.add.text(x, y, labelText, { font: '22px Arial', color: '#ffffff' }).setOrigin(0, 0.5);

        const sliderWidth = 200;
        const sliderHeight = 10;
        const thumbWidth = 10;
        const thumbHeight = 20;
        const valueTextXOffset = sliderWidth + 30;

        const initialValue = this.currentSettings[settingKey] as number;

        const track = this.add.graphics();
        track.fillStyle(0x555555);
        track.fillRect(0, 0, sliderWidth, sliderHeight); // Draw track at its local 0,0

        const thumb = this.add.graphics();
        thumb.fillStyle(0xeeeeee);
        thumb.fillRect(0, 0, thumbWidth, thumbHeight); // Draw thumb at its local 0,0
        const thumbInteractive = this.add.zone(0, 0, thumbWidth, thumbHeight)
            .setOrigin(0, 0.5) 
            .setInteractive({ draggable: true });
        
        // Ensure thumb and its interactive zone are on top for input and visuals
        thumb.setDepth(1);
        thumbInteractive.setDepth(1);
        
        const valueDisplay = this.add.text(x + 180 + valueTextXOffset, y, '', { font: '20px Arial', color: '#ffff00' }).setOrigin(0, 0.5);

        const namePrefix = 'slider_' + String(settingKey);
        labelObj.setName(namePrefix + '_label');
        track.setName(namePrefix + '_track');
        thumb.setName(namePrefix + '_thumb');
        thumbInteractive.setName(namePrefix + '_thumbinteractive');
        valueDisplay.setName(namePrefix + '_valuedisplay');
        // trackZone doesn't need a unique name for filtering if it's implicitly part of the slider group

        // Set initial positions (will be updated by switchTab)
        labelObj.x = x; labelObj.y = y;
        track.x = x + 180; track.y = y - sliderHeight / 2; // Store relative offset for track
        // Thumb and thumbInteractive are positioned by updateThumbAndValue initially, then by dragging/switchTab.
        // updateThumbAndValue takes care of thumb.x based on value. switchTab will handle thumb.y.
        valueDisplay.x = x + 180 + valueTextXOffset; valueDisplay.y = y;
        
        const trackZoneOriginalX = x + 180; // Store original relative X for trackZone
        const trackZoneOriginalY = y - sliderHeight / 2; // Store original relative Y for trackZone

        const updateThumbAndValue = (newValue: number, fromDrag: boolean = false) => {
            let displayValText: string;
            let actualSettingValue: number;

            if (isInfinityAllowed && newValue === infinityValueRepresentation) {
                displayValText = 'INF';
                actualSettingValue = Infinity;
            } else {
                // For volume, convert 0-100 to 0.0-1.0 if needed
                if (settingKey === 'masterVolume' || settingKey === 'sfxVolume' || settingKey === 'musicVolume') {
                    actualSettingValue = newValue / 100;
                    displayValText = `${newValue}%`;
                } else {
                    actualSettingValue = newValue;
                    displayValText = newValue.toString();
                }
            }
            
            valueDisplay.setText(displayValText);
            
            if (!fromDrag) { // Only update thumb position if not called from thumb drag itself
                let percent = 0;
                let valueForPercentCalculation = newValue;

                if (isInfinityAllowed && valueForPercentCalculation === infinityValueRepresentation) {
                    percent = 1; // Position thumb at max for INF
                } else if (settingKey === 'masterVolume' || settingKey === 'sfxVolume' || settingKey === 'musicVolume') {
                    percent = Phaser.Math.Clamp(valueForPercentCalculation / 100, 0, 1);
                } else if (maxValue > minValue) {
                    percent = Phaser.Math.Clamp((valueForPercentCalculation - minValue) / (maxValue - minValue), 0, 1);
                }

                const trackStartXAbsolute = labelObj.x + 180; // Use labelObj.x as the reference, assuming it's set by switchTab
                const thumbX = trackStartXAbsolute + (sliderWidth - thumbWidth) * percent;
                const clampedThumbX = Phaser.Math.Clamp(thumbX, trackStartXAbsolute, trackStartXAbsolute + sliderWidth - thumbWidth);

                thumb.x = clampedThumbX;
                // thumb.y will be set by switchTab or drag relative to the currentY of the slider group
                // thumb.y = y - thumbHeight / 2; // This y is the original y, not currentY from switchTab
                thumbInteractive.x = clampedThumbX; 
                // thumbInteractive.y = y; 
            }
            
            // Update the actual setting in currentSettings
            (this.currentSettings[settingKey] as any) = actualSettingValue;
            console.log(`[SettingsScene_Slider] Updated currentSettings.${String(settingKey)} = ${this.currentSettings[settingKey]}. Display: ${displayValText}`); // ADDED LOG
            if(!fromDrag) this.saveSettings(); // Save settings, unless it's a continuous drag
        };
        
        // Initialize thumb and value
        let initialSliderDisplayValue = initialValue;
         if (settingKey === 'masterVolume' || settingKey === 'sfxVolume' || settingKey === 'musicVolume') {
            initialSliderDisplayValue = Math.round(initialValue * 100); // Display as 0-100
        } else if (isInfinityAllowed && initialValue === Infinity && infinityValueRepresentation !== undefined) {
            initialSliderDisplayValue = infinityValueRepresentation;
        }
        updateThumbAndValue(initialSliderDisplayValue);


        thumbInteractive.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            let newThumbX = dragX; 
            const trackStartX = labelObj.x + 180; // Use label's current x + offset
            const trackEndX = trackStartX + sliderWidth - thumbWidth;

            newThumbX = Phaser.Math.Clamp(newThumbX, trackStartX, trackEndX);
            thumb.x = newThumbX;
            thumbInteractive.x = newThumbX; // Keep the interactive zone aligned with the visual thumb after clamping
            
            let percent = 0;
            if (sliderWidth - thumbWidth > 0) { // Avoid division by zero if slider is too small
                percent = (newThumbX - trackStartX) / (sliderWidth - thumbWidth);
            }
            percent = Phaser.Math.Clamp(percent, 0, 1);

            let newValue = minValue + (maxValue - minValue) * percent;
            
            // Snap to step
            newValue = Math.round(newValue / step) * step;
            newValue = Phaser.Math.Clamp(newValue, minValue, maxValue);

            updateThumbAndValue(newValue, true); // Pass true for fromDrag
        });

        thumbInteractive.on('dragend', () => {
            this.saveSettings(); // Save settings once drag is complete
        });


        // Allow clicking on the track to set value
        const trackZone = this.add.zone(trackZoneOriginalX, trackZoneOriginalY, sliderWidth, sliderHeight)
            .setOrigin(0,0)
            .setInteractive();
        trackZone.setName(namePrefix + '_trackZone'); // Assign name to trackZone

        trackZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const trackStartX = labelObj.x + 180; // Use label's current x + offset
            const clickX = pointer.x;
            
            let percent = (clickX - trackStartX) / sliderWidth;
            percent = Phaser.Math.Clamp(percent, 0, 1);

            let newValue = minValue + (maxValue - minValue) * percent;
            newValue = Math.round(newValue / step) * step;
            newValue = Phaser.Math.Clamp(newValue, minValue, maxValue);
            
            // Update thumb position based on this new value
            const newThumbX = trackStartX + (sliderWidth - thumbWidth) * ((newValue - minValue) / (maxValue - minValue));
            thumb.x = Phaser.Math.Clamp(newThumbX, trackStartX, trackStartX + sliderWidth - thumbWidth);

            updateThumbAndValue(newValue);
            this.saveSettings();
        });
        return [labelObj, track, thumb, thumbInteractive, valueDisplay, trackZone]; // trackZone also needs to be managed
    }


    private createKeybindEditor(x: number, y: number, label: string, actionKey: keyof GameSettings['keybinds']): Phaser.GameObjects.GameObject[] {
        const labelObj = this.add.text(x, y, label, { font: '20px Arial', color: '#ffffff' }).setOrigin(1, 0.5);

        const currentActionBinds = this.currentSettings.keybinds[actionKey] || [];
        const keybindsText = [
            this.formatEventCode(currentActionBinds[0] || '-'),
            this.formatEventCode(currentActionBinds[1] || '-')
        ];

        const keyDisplayWidth = 120;
        const buttonWidth = 50;
        const horizontalSpacing = 10;

        const keyDisplay1 = this.add.text(x + horizontalSpacing + 20, y, keybindsText[0], { font: '18px Arial', color: '#FFFF00', backgroundColor: '#222222', padding: {left:5, right:5}, fixedWidth: keyDisplayWidth, align: 'center' }).setOrigin(0, 0.5);
        const setButton1 = this.add.text(keyDisplay1.x + keyDisplayWidth + horizontalSpacing, y, 'Set', { font: '18px Arial', color: '#00FFFF', backgroundColor: '#333333', padding: {left:3, right:3}, fixedWidth: buttonWidth, align: 'center' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        const keyDisplay2 = this.add.text(setButton1.x + buttonWidth + horizontalSpacing + 20, y, keybindsText[1], { font: '18px Arial', color: '#FFFF00', backgroundColor: '#222222', padding: {left:5, right:5}, fixedWidth: keyDisplayWidth, align: 'center' }).setOrigin(0, 0.5);
        const setButton2 = this.add.text(keyDisplay2.x + keyDisplayWidth + horizontalSpacing, y, 'Set', { font: '18px Arial', color: '#00FFFF', backgroundColor: '#333333', padding: {left:3, right:3}, fixedWidth: buttonWidth, align: 'center' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        const namePrefix = 'keybind_' + String(actionKey);
        labelObj.setName(namePrefix + '_label');
        keyDisplay1.setName(namePrefix + '_display1');
        setButton1.setName(namePrefix + '_button1');
        keyDisplay2.setName(namePrefix + '_display2');
        setButton2.setName(namePrefix + '_button2');

        // Set initial positions (will be updated by switchTab)
        labelObj.x = x; labelObj.y = y;
        const display1X = x + horizontalSpacing + 20;
        keyDisplay1.x = display1X; keyDisplay1.y = y;
        setButton1.x = display1X + keyDisplayWidth + horizontalSpacing; setButton1.y = y;
        const display2X = setButton1.x + buttonWidth + horizontalSpacing + 20;
        keyDisplay2.x = display2X; keyDisplay2.y = y;
        setButton2.x = display2X + keyDisplayWidth + horizontalSpacing; setButton2.y = y;

        setButton1.on('pointerdown', () => {
            this.captureKeyForAction(actionKey, 0, keyDisplay1, keyDisplay2);
        });
        setButton2.on('pointerdown', () => {
            this.captureKeyForAction(actionKey, 1, keyDisplay2, keyDisplay1);
        });
        return [labelObj, keyDisplay1, setButton1, keyDisplay2, setButton2];
    }

    private captureKeyForAction(actionKey: keyof GameSettings['keybinds'], keyIndex: number, activeDisplay: Phaser.GameObjects.Text, otherDisplay: Phaser.GameObjects.Text): void {
        activeDisplay.setText('Press key...').setColor('#ff9900');
        
        if (this.input.keyboard) { // Check if keyboard manager is available
        this.input.keyboard.once('keydown', (event: KeyboardEvent) => {
                event.preventDefault(); // Prevent default browser action for this key press
                event.stopPropagation(); // Stop the event from bubbling up to other game listeners

                let newKeyString: string; // Changed from newKey to newKeyString to avoid conflict with event.newKey if it existed
            if (event.key === 'Escape') {
                    newKeyString = '-';
                } else {
                    newKeyString = this.formatEventCode(event.code);
                }

                // Ensure the structure for keybinds[actionKey] exists
            if (!this.currentSettings.keybinds[actionKey] || !Array.isArray(this.currentSettings.keybinds[actionKey])) {
                this.currentSettings.keybinds[actionKey] = ['-', '-'];
            }
            while(this.currentSettings.keybinds[actionKey].length < 2) {
                this.currentSettings.keybinds[actionKey].push('-');
            }

                // Override logic: Clear old conflicting bindings
                if (newKeyString !== '-') {
                    for (const existingAction in this.currentSettings.keybinds) {
                        const action = existingAction as keyof GameSettings['keybinds'];
                        const bindsForAction = this.currentSettings.keybinds[action];
                        if (Array.isArray(bindsForAction)) {
                            for (let i = 0; i < bindsForAction.length; i++) {
                                // If the new key is already bound to another action, or another slot of the current action
                                if (bindsForAction[i] === newKeyString && (action !== actionKey || i !== keyIndex)) {
                                    bindsForAction[i] = '-'; // Unbind the old one
                                    // Update the display for the cleared keybind
                                    const UInamePrefix = 'keybind_' + String(action);
                                    const displayToUpdate = this.settingsObjects.find(obj => obj.name === UInamePrefix + '_display' + (i + 1)) as Phaser.GameObjects.Text | undefined;
                                    if (displayToUpdate) {
                                        displayToUpdate.setText('-');
                                    }
                                }
                            }
                        }
                    }
            }
            
                this.currentSettings.keybinds[actionKey][keyIndex] = newKeyString;

                activeDisplay.setText(newKeyString).setColor('#FFFF00');
            this.saveSettings();
        });
        } else {
            console.warn('[SettingsScene] Keyboard input not available for captureKeyForAction');
            // Optionally revert the activeDisplay text if key capture can't proceed
            const currentKeybindArray = this.currentSettings.keybinds[actionKey];
            const keyValue = (Array.isArray(currentKeybindArray) && currentKeybindArray[keyIndex]) ? currentKeybindArray[keyIndex] : '-';
            activeDisplay.setText(keyValue).setColor('#FFFF00');
        }
    }
} 