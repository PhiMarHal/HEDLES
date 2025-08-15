// remixIntegration.js
// Script to integrate Farcade SDK into HEDLES index.html

const fs = require('fs');
const path = require('path');

const config = {
    indexTemplate: 'index.html',
    outputFile: 'index.farcade.html',
};

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content);
        console.log(`Successfully created file: ${filePath}`);
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
    }
}

function injectFarcadeSDK(html) {
    console.log('Injecting Farcade SDK script tag...');
    const farcadeScriptTag = '    <script src="https://cdn.jsdelivr.net/npm/@farcade/game-sdk@latest/dist/index.min.js"></script>';
    // Inject the Farcade SDK script right before the closing </head> tag
    return html.replace(/<\/head>/, `${farcadeScriptTag}\n</head>`);
}

function injectFarcadeGameLogic(html) {
    console.log('Injecting Farcade SDK game logic...');

    let modifiedHtml = html;

    // 1. Inject ready() call in StartScreen.create() after UI elements are set up
    const startScreenCreatePattern = /(\/\/ Keyboard support[\s\S]*?this\.enterKey\.on\('down', \(\) => \{[\s\S]*?\}\);)/;
    modifiedHtml = modifiedHtml.replace(startScreenCreatePattern, (match) => {
        return `${match}

                // Farcade SDK: Signal that the game is fully loaded and ready to play
                if (window.FarcadeSDK) {
                    window.FarcadeSDK.singlePlayer.actions.ready();
                    console.log('Farcade SDK: Game ready signal sent.');
                }`;
    });

    // 2. Inject gameOver() call in GameScreen.endGame() after game over message is created
    const gameOverPattern = /(this\.createGameOverTypewriter\([\s\S]*?\{[\s\S]*?\/\/ After message is complete, show play button[\s\S]*?this\.createGameOverPlayButton\([\s\S]*?\);[\s\S]*?\}[\s\S]*?\);)/;
    modifiedHtml = modifiedHtml.replace(gameOverPattern, (match) => {
        return `${match}

                        // Farcade SDK: Call gameOver with score after UI is set up
                        if (window.FarcadeSDK) {
                            this.time.delayedCall(1000, () => {
                                window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.score });
                                console.log('Farcade SDK: Game over signal sent with score:', this.score);
                            });
                        }`;
    });

    // 3. FALLBACK: If the above pattern doesn't match, try a simpler approach
    if (!modifiedHtml.includes('window.FarcadeSDK.singlePlayer.actions.gameOver')) {
        console.log('Primary gameOver pattern not found, trying fallback pattern...');

        // Look for the createGameOverPlayButton call
        const fallbackPattern = /(this\.createGameOverPlayButton\([\s\S]*?\);)/;
        modifiedHtml = modifiedHtml.replace(fallbackPattern, (match) => {
            return `${match}

                        // Farcade SDK: Call gameOver with score (fallback injection)
                        if (window.FarcadeSDK) {
                            this.time.delayedCall(1000, () => {
                                window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.score });
                                console.log('Farcade SDK: Game over signal sent with score (fallback):', this.score);
                            });
                        }`;
        });
    }

    // 4. Inject event handlers after the Phaser game instance is created
    const phaserGameInstancePattern = /(const game = new Phaser\.Game\(config\);)/;
    modifiedHtml = modifiedHtml.replace(phaserGameInstancePattern, (match) => {
        return `${match}

        // Farcade SDK: Register event handlers for 'play_again' and 'toggle_mute'
        if (window.FarcadeSDK) {
            // Handle play again requests from Farcade
            window.FarcadeSDK.on('play_again', () => {
                console.log('Farcade SDK: Play again requested.');
                const gameScene = game.scene.getScene('GameScreen');
                if (gameScene) {
                    // Stop background music if playing
                    if (gameScene.backgroundMusic && gameScene.backgroundMusic.isPlaying) {
                        gameScene.backgroundMusic.stop();
                    }
                    // Restart the game scene
                    game.scene.start('GameScreen');
                    console.log('Farcade SDK: Game restarted.');
                } else {
                    // Fallback: restart from start screen
                    game.scene.start('StartScreen');
                    console.log('Farcade SDK: Restarted from start screen.');
                }
            });

            // Handle mute/unmute requests from Farcade
            window.FarcadeSDK.on('toggle_mute', (data) => {
                console.log('Farcade SDK: Mute toggle requested, isMuted:', data.isMuted);
                // Use Phaser's global sound manager to mute/unmute all audio
                game.sound.mute = data.isMuted;
                console.log('Farcade SDK: All game audio mute state set to:', data.isMuted);
            });

            console.log('Farcade SDK: Event handlers registered.');
        }`;
    });

    // 5. Hide the original play button in game over screen when Farcade SDK is present
    const gameOverPlayButtonPattern = /(this\.gameOverPlayButton\.on\('pointerdown', \(\) => \{[\s\S]*?\}\);)/;
    modifiedHtml = modifiedHtml.replace(gameOverPlayButtonPattern, (match) => {
        return `${match}

                // Farcade SDK: Hide our play button since Farcade UI takes over
                if (window.FarcadeSDK) {
                    this.gameOverPlayButton.setVisible(false);
                }`;
    });

    return modifiedHtml;
}

async function integrateFarcade() {
    console.log('Starting HEDLES Farcade integration process...');

    let htmlContent = readFile(config.indexTemplate);
    if (!htmlContent) {
        console.error('Could not read HTML template. Aborting.');
        return;
    }

    // Step 1: Inject Farcade SDK script tag
    htmlContent = injectFarcadeSDK(htmlContent);

    // Step 2: Inject Farcade SDK game logic (ready, gameOver, play_again, toggle_mute)
    htmlContent = injectFarcadeGameLogic(htmlContent);

    writeFile(config.outputFile, htmlContent);

    console.log('HEDLES Farcade integration complete! Output file:', config.outputFile);
    console.log('The integrated version will:');
    console.log('- Signal ready when the start screen is interactive');
    console.log('- Submit the score when the game ends');
    console.log('- Handle play again requests by restarting the game');
    console.log('- Handle mute/unmute requests via Phaser sound manager');
    console.log('- Hide the original play button on game over (Farcade UI takes over)');
}

// Execute the integration function
integrateFarcade();