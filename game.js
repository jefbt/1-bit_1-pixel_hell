class PixelGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set virtual resolution
        this.virtualWidth = 16;
        this.virtualHeight = 9;
        
        // Set actual canvas size
        this.canvas.width = 640;
        this.canvas.height = 360;
        
        // Game state
        this.pixels = [];
        this.score = 0;
        this.gameState = 'start';
        this.difficultyLevel = 0;
        this.timeSinceLastDifficulty = 0;
        this.timeSinceLastSpawn = 0;
        this.baseSpawnTime = 1000; // 1 second
        this.hue = 0;
        
        // Color values
        this.foregroundValue = 1;
        this.backgroundValue = 0;
        
        // Add base speed property
        this.baseSpeed = 0.001;
        
        // Define contrast levels array (white values, black will be 1-white)
        this.contrastLevels = [1, 0.9, 0.75, 0.6, 0.55, 0.54, 0.53, 0.52, 0.51, 0.505];
        this.maxDifficultyLevel = this.contrastLevels.length - 1;
        
        // Bind events
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        
        // Start game loop
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
        
        // Remove the score span since we'll draw it on canvas
        this.scoreAnimations = [];  // Array to hold score popup animations
        
        this.startTime = Date.now();
        this.gameTime = 0;
        
        // Load leaderboard from localStorage
        this.leaderboard = JSON.parse(localStorage.getItem('pixelPopLeaderboard') || '[]');
        
        this.gameOverStartTime = 0;  // Track when game over started
        this.minRestartDelay = 1000; // 1 second minimum delay before restart
        
        this.paused = false;
        
        // Add window focus/blur listeners
        window.addEventListener('blur', () => {
            if (this.gameState === 'playing') {
                this.paused = true;
            }
        });
        
        window.addEventListener('focus', () => {
            if (this.paused) {
                this.paused = false;
                this.lastTime = performance.now(); // Reset last time to prevent huge time jump
                requestAnimationFrame(this.gameLoop.bind(this));
            }
        });
    }
    
    spawnPixel() {
        const x = Math.floor(Math.random() * this.virtualWidth);
        const y = Math.floor(Math.random() * (this.virtualHeight / 2));
        
        // Increase base speed by 5% for each difficulty level
        const currentBaseSpeed = this.baseSpeed * (1 + (this.difficultyLevel * 0.05));
        const speed = currentBaseSpeed + Math.random() * 0.0005; // Add random variation
        
        this.pixels.push({ x, y, speed });
    }
    
    getSpawnTime() {
        return Math.max(400, this.baseSpawnTime - (this.difficultyLevel * 200));
    }
    
    getColors() {
        // Get the white value from our predefined levels
        const foreground = this.contrastLevels[this.difficultyLevel];
        // Black is inverse of white
        const background = 1 - foreground;
        
        return {
            foreground: `hsl(${this.hue}, 100%, ${foreground * 100}%)`,
            background: `hsl(${this.hue}, 100%, ${background * 100}%)`
        };
    }
    
    handleClick(event) {
        // Add pause handling
        if (this.paused) {
            this.paused = false;
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        
        // Check if clicked on reset leaderboard button (only on start or game over screens)
        if (this.gameState === 'start' || this.gameState === 'gameover') {
            const resetBtnX = this.canvas.width - 150;
            const resetBtnY = 10;
            const resetBtnWidth = 140;
            const resetBtnHeight = 30;
            
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            
            if (clickX >= resetBtnX && clickX <= resetBtnX + resetBtnWidth &&
                clickY >= resetBtnY && clickY <= resetBtnY + resetBtnHeight) {
                if (confirm('Do you really want to reset the local leaderboard?')) {
                    this.leaderboard = [];
                    localStorage.setItem('pixelPopLeaderboard', '[]');
                }
                return;
            }
        }

        if (this.gameState === 'start') {
            this.gameState = 'playing';
            this.startTime = Date.now();
            return;
        }

        if (this.gameState === 'gameover') {
            // Check if enough time has passed since game over
            if (Date.now() - this.gameOverStartTime >= this.minRestartDelay) {
                // Reset game
                this.pixels = [];
                this.score = 0;
                this.gameState = 'start';  // Just use gameState
                this.difficultyLevel = 0;
                this.timeSinceLastDifficulty = 0;
                this.timeSinceLastSpawn = 0;
                this.scoreAnimations = [];
                this.scoreAdded = false;
                this.gameTime = 0;
                this.hue = 0;
                
                // Restart the game loop
                this.lastTime = performance.now();
                requestAnimationFrame(this.gameLoop.bind(this));
            }
            return;
        }

        // Rest of the click handling for gameplay
        if (this.gameState === 'playing') {
            const scaleX = this.virtualWidth / rect.width;
            const scaleY = this.virtualHeight / rect.height;
            
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            
            const gameClickX = Math.floor(clickX * scaleX);
            const gameClickY = Math.floor(clickY * scaleY);
            
            for (let i = this.pixels.length - 1; i >= 0; i--) {
                const pixel = this.pixels[i];
                if (Math.abs(pixel.x - gameClickX) < 1 && Math.abs(pixel.y - gameClickY) < 1) {
                    // Calculate score multiplier based on y position
                    const multiplier = (pixel.y / this.virtualHeight) * 2 + 1;
                    const points = Math.floor(100 * multiplier * (this.difficultyLevel + 1));
                    this.score += points;
                    
                    // Add score animation
                    this.scoreAnimations.push({
                        x: pixel.x,
                        y: pixel.y,
                        points: points,
                        age: 0,
                        maxAge: 1000  // Animation duration in ms
                    });
                    
                    this.pixels.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    addScoreToLeaderboard() {
        this.gameTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
        
        this.leaderboard.push({
            score: this.score,
            time: this.gameTime,
            date: new Date().toISOString()
        });
        
        // Sort by score (descending) and keep only top 5
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 5);
        
        // Save to localStorage
        localStorage.setItem('pixelPopLeaderboard', JSON.stringify(this.leaderboard));
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    gameLoop(timestamp) {
        const deltaTime = Math.min(timestamp - this.lastTime, 50);
        this.lastTime = timestamp;
        
        if (this.gameState === 'start') {
            this.drawStartScreen();
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        
        if (this.gameState === 'gameover') {
            if (!this.scoreAdded) {
                this.addScoreToLeaderboard();
                this.scoreAdded = true;
                this.gameOverStartTime = Date.now();
            }
            this.drawGameOver();
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        
        if (this.paused) {
            this.drawPauseScreen();
            return;
        }
        
        // Update score animations
        this.scoreAnimations = this.scoreAnimations.filter(anim => {
            anim.age += deltaTime;
            anim.y -= 0.003 * deltaTime;  // Float upward
            return anim.age < anim.maxAge;
        });
        
        // Update difficulty - using real time (milliseconds)
        this.timeSinceLastDifficulty += deltaTime;
        if (this.timeSinceLastDifficulty >= 10000) { // 10 seconds
            this.difficultyLevel = Math.min(this.maxDifficultyLevel, this.difficultyLevel + 1);
            this.timeSinceLastDifficulty = 0;
        }
        
        // Spawn pixels - using real time
        this.timeSinceLastSpawn += deltaTime;
        if (this.timeSinceLastSpawn >= this.getSpawnTime()) {
            this.spawnPixel();
            this.timeSinceLastSpawn = 0;
        }
        
        // Update pixel positions - using deltaTime for frame independence
        this.pixels.forEach(pixel => {
            pixel.y += pixel.speed * deltaTime;
            if (pixel.y >= this.virtualHeight) {
                this.gameState = 'gameover';  // Change this from gameOver to gameState
            }
        });
        
        // Update hue
        this.hue = (this.hue + 0.1) % 360;
        
        // Draw
        this.draw();
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    drawStartScreen() {
        const colors = this.getColors();
        
        // Clear canvas
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = colors.foreground;
        this.ctx.textAlign = 'center';
        this.ctx.font = '48px Arial';
        this.ctx.fillText('1-BIT, 1-PIXEL, HELL', this.canvas.width / 2, this.canvas.height / 2 - 40);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Click anywhere to play', this.canvas.width / 2, this.canvas.height / 2 + 20);
        
        // Draw reset leaderboard button
        this.drawResetButton();
    }
    
    drawResetButton() {
        const colors = this.getColors();
        const btnX = this.canvas.width - 150;
        const btnY = 10;
        const btnWidth = 140;
        const btnHeight = 30;
        
        // Button background
        this.ctx.fillStyle = colors.foreground;
        this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
        
        // Button text
        this.ctx.fillStyle = colors.background;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Reset Leaderboard', btnX + btnWidth/2, btnY + btnHeight/2 + 5);
    }
    
    draw() {
        const colors = this.getColors();
        
        // Clear canvas with background color
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw pixels
        this.ctx.fillStyle = colors.foreground;
        const pixelWidth = this.canvas.width / this.virtualWidth;
        const pixelHeight = this.canvas.height / this.virtualHeight;
        
        this.pixels.forEach(pixel => {
            this.ctx.fillRect(
                pixel.x * pixelWidth,
                pixel.y * pixelHeight,
                pixelWidth,
                pixelHeight
            );
        });
        
        // Draw score animations
        this.scoreAnimations.forEach(anim => {
            const alpha = 1 - (anim.age / anim.maxAge);
            this.ctx.fillStyle = `hsla(${this.hue}, 100%, ${colors.foreground * 100}%, ${alpha})`;
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `+${anim.points}`,
                anim.x * pixelWidth,
                anim.y * pixelHeight
            );
        });
        
        // Draw current score
        this.ctx.fillStyle = colors.foreground;
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `Score: ${this.score}`,
            10,
            30
        );
    }
    
    drawGameOver() {
        const colors = this.getColors();
        
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Left side - Game Over and current score
        this.ctx.fillStyle = colors.foreground;
        this.ctx.textAlign = 'left';
        
        // Game Over title
        this.ctx.font = '48px Arial';
        this.ctx.fillText('GAME OVER', 40, 80);
        
        // Current game stats
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Your Score:', 40, 140);
        this.ctx.font = '36px Arial';
        this.ctx.fillText(this.score, 40, 180);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Time:', 40, 220);
        this.ctx.font = '36px Arial';
        this.ctx.fillText(this.formatTime(this.gameTime), 40, 260);
        
        // Right side - Leaderboard
        const rightSide = this.canvas.width / 2;
        
        this.ctx.textAlign = 'center';
        this.ctx.font = '32px Arial';
        this.ctx.fillText('TOP SCORES', rightSide + (rightSide/2), 80);
        
        // Leaderboard entries
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'right';
        const columnScore = rightSide + rightSide * 0.8;
        const columnTime = rightSide + rightSide * 0.4;
        
        // Headers
        this.ctx.fillText('SCORE', columnScore, 120);
        this.ctx.fillText('TIME', columnTime, 120);
        
        // Entries - increased vertical spacing for better readability with 5 entries
        this.leaderboard.forEach((entry, index) => {
            const y = 160 + (index * 40); // Increased from 30 to 40 for better spacing
            this.ctx.fillText(entry.score, columnScore, y);
            this.ctx.fillText(this.formatTime(entry.time), columnTime, y);
        });
        
        // Only show restart instruction after delay
        if (Date.now() - this.gameOverStartTime >= this.minRestartDelay) {
            this.ctx.textAlign = 'left';
            this.ctx.font = '24px Arial';
            this.ctx.fillText(
                'Click anywhere to play again',
                40,
                this.canvas.height - 40
            );
        }
    }
    
    drawPauseScreen() {
        // Draw the current game state
        this.draw();
        
        // Add pause overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const colors = this.getColors();
        this.ctx.fillStyle = colors.foreground;
        this.ctx.textAlign = 'center';
        this.ctx.font = '36px Arial';
        this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Click to resume', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
}

// Start the game when the page loads
window.onload = () => new PixelGame(); 