<script lang="ts">
import { onMount } from 'svelte';

let canvas: HTMLCanvasElement;
let width: number;
let height: number;
let text = 'Hello Text';
let blockX = 0;
const redBlockSize = 200;
const blueBlockSize = 100;
const blockSpeed = 1;

let cameraX = 0;
let cameraVelocity = 0;
// redBlockX is the world position of the red block
let redBlockX = 0;

// Blue block physics
let blueBlockOffsetY = 0;
let blueVelocityY = 0;
const gravity = 0.8;

let ctx: CanvasRenderingContext2D | null;
let rid: number;
let gameOver = false;
let gameOverOpacity = 0;

let stars: { x: number; y: number; r: number; speed: number; alpha: number }[] = [];

// Mountains
let mountains: { x: number; h: number; w: number }[] = [];

// Rocks
let rocks: { x: number; w: number; h: number }[] = [];

let particles: {
x: number;
y: number;
vx: number;
vy: number;
life: number;
color: string;
size: number;
}[] = [];

const createExplosion = (x: number, y: number) => {
// x, y is center of blue block
for (let i = 0; i < 20; i++) {
// Create grid of chunks
for (let j = 0; j < 5; j++) {
const size = Math.random() * 15 + 10;
particles.push({
// Start relative to where the block IS currently drawn on screen
x: x - blueBlockSize / 2 + Math.random() * blueBlockSize,
y: y - blueBlockSize / 2 + Math.random() * blueBlockSize,
vx: (Math.random() - 0.5) * 15 + cameraVelocity,
vy: (Math.random() - 1.5) * 10,
life: 1.0,
color: 'blue',
size: size
});
}
}
};

const initStars = () => {
stars = [];
for (let i = 0; i < 200; i++) {
stars.push({
x: Math.random() * width,
y: Math.random() * (height - 100), // Above floor
r: Math.random() * 2 + 0.5,
speed: Math.random() * 0.2 + 0.05,
alpha: Math.random() * 0.8 + 0.2
});
}

// Init mountains
mountains = [];
let cx = 0;
while (cx < width * 2) { // Generate enough for scrolling
const w = Math.random() * 200 + 100;
const h = Math.random() * 150 + 50;
mountains.push({ x: cx, w, h });
cx += w * 0.7; // Overlap
}

// Init rocks
rocks = [];
for (let i = 0; i < 10; i++) {
rocks.push({
x: Math.random() * width * 5 + width, // Spread out over 5 screens width
w: Math.random() * 30 + 20,
h: Math.random() * 30 + 20
});
}
};

const update = () => {
rid = requestAnimationFrame(update);
if (!ctx) return;

// Animate camera with physics
cameraX += cameraVelocity;
cameraVelocity *= 0.995; // Even less friction to glide longer
if (cameraVelocity < 0.1) cameraVelocity = 0;

// Blue block physics (gravity)
blueVelocityY += gravity;
blueBlockOffsetY += blueVelocityY;

// Floor collision
if (blueBlockOffsetY > 0) {
blueBlockOffsetY = 0;
blueVelocityY = 0;
}

// Update block position only if game is running
if (!gameOver) {
redBlockX += blockSpeed;

// Calculate screen position
let redBlockScreenX = redBlockX - cameraX;

// Wrap around logic based on screen position
if (redBlockScreenX > width) {
redBlockX -= width + redBlockSize;
} else if (redBlockScreenX < -redBlockSize) {
redBlockX += width + redBlockSize;
}

// Re-calculate after wrapping
redBlockScreenX = redBlockX - cameraX;

// Check collision with center blue block
// Blue block is always centered
const blueBlockScreenX = (width - blueBlockSize) / 2;

// Y-axis collision check
// Red block is on floor: [floorY - redBlockSize, floorY]
// Blue block is at: [floorY - blueBlockSize + blueBlockOffsetY, floorY + blueBlockOffsetY]

const redBlockTop = (height - 100) - redBlockSize; // 100 is floorHeight
const blueBlockBottom = (height - 100) + blueBlockOffsetY; // 100 is floorHeight

// Collision happens if overlapping in X AND Y
const inset = 30; // Forgiving hitbox for circles
const overlapX = redBlockScreenX + redBlockSize - inset > blueBlockScreenX + inset && redBlockScreenX + inset < blueBlockScreenX + blueBlockSize - inset;
const overlapY = blueBlockBottom - inset > redBlockTop + inset;

if (overlapX && overlapY) {
gameOver = true;
// Explode center of blue block
createExplosion(blueBlockScreenX + blueBlockSize / 2, (height - 100) - blueBlockSize / 2 + blueBlockOffsetY);
}

// Check collision with rocks
rocks.forEach(rock => {
const rockScreenX = rock.x - cameraX;

// Wrap rocks
if (rockScreenX < -rock.w) {
rock.x += width * 5; // Move far ahead
}

const rockTop = (height - 100) - rock.h;
const rockOverlapX = rockScreenX + rock.w > blueBlockScreenX && rockScreenX < blueBlockScreenX + blueBlockSize;
const rockOverlapY = blueBlockBottom > rockTop;

if (rockOverlapX && rockOverlapY) {
gameOver = true;
createExplosion(blueBlockScreenX + blueBlockSize / 2, (height - 100) - blueBlockSize / 2 + blueBlockOffsetY);
}
});
}

// Draw Sky
const gradient = ctx.createLinearGradient(0, 0, 0, height);
gradient.addColorStop(0, '#020024');
gradient.addColorStop(1, '#090979');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Draw Stars (Parallax)
ctx.fillStyle = 'white';
stars.forEach((star) => {
let starX = (star.x - cameraX * star.speed) % width;
if (starX < 0) starX += width;

ctx.globalAlpha = star.alpha;
ctx.beginPath();
ctx.arc(starX, star.y, star.r, 0, Math.PI * 2);
ctx.fill();
});
ctx.globalAlpha = 1.0;

const floorHeight = 100;
const floorY = height - floorHeight;

// Draw Mountains (Parallax 0.5 speed)
ctx.fillStyle = '#1B5E20'; // Dark green/grey
const mountainSpeed = 0.5;
const mountainOffset = (cameraX * mountainSpeed) % (width);

// Draw mountains twice to simulate infinite scroll
for (let offset of [-width, 0, width]) {
const startX = -mountainOffset + offset;
if (startX > width || startX + width < 0) continue;

ctx.save();
ctx.translate(startX, 0);

mountains.forEach(m => {
ctx.beginPath();
ctx.moveTo(m.x, floorY);
ctx.lineTo(m.x + m.w / 2, floorY - m.h);
ctx.lineTo(m.x + m.w, floorY);
ctx.fill();
});

ctx.restore();
}

// Draw scrolling grass pattern
const grassWidth = 50;
const startX = -(cameraX % (grassWidth * 2));

for (let i = startX; i < width; i += grassWidth * 2) {
ctx.fillStyle = '#4CAF50'; // Darker green
ctx.fillRect(i, floorY, grassWidth, floorHeight);
ctx.fillStyle = '#81C784'; // Lighter green
ctx.fillRect(i + grassWidth, floorY, grassWidth, floorHeight);
}

// Draw Rocks
ctx.fillStyle = 'gray';
rocks.forEach(rock => {
const rockScreenX = rock.x - cameraX;
if (rockScreenX + rock.w > 0 && rockScreenX < width) {
ctx.fillRect(rockScreenX, floorY - rock.h, rock.w, rock.h);
}
});

// ---------------------------------------------------------
// DRAWING ORDER: Background -> Red -> Blue -> Text
// ---------------------------------------------------------

// 1. Draw Red block (BEHIND blue block)
ctx.fillStyle = 'red';
const redBlockY = floorY - redBlockSize;
ctx.beginPath();
ctx.arc(
redBlockX - cameraX + redBlockSize / 2,
redBlockY + redBlockSize / 2,
redBlockSize / 2,
0,
Math.PI * 2
);
ctx.fill();

// 2. Draw Blue block (IN FRONT of red block)
const blueBlockScreenX = (width - blueBlockSize) / 2;
const blockY = floorY - blueBlockSize + blueBlockOffsetY;

if (!gameOver) {
ctx.fillStyle = 'blue';
ctx.fillRect(blueBlockScreenX, blockY, blueBlockSize, blueBlockSize);
}

// Update and draw particles ALWAYS
for (let i = particles.length - 1; i >= 0; i--) {
const p = particles[i];

// Only update position if game over or if we want them to move during gameplay
// Since explosion only happens on game over, this is fine
p.x += p.vx;
p.y += p.vy;
p.vy += 0.5; // Gravity
p.life -= 0.01;
if (p.life <= 0) {
particles.splice(i, 1);
} else {
ctx.fillStyle = p.color;
ctx.globalAlpha = p.life;
ctx.fillRect(p.x, p.y, p.size, p.size);
}
}
ctx.globalAlpha = 1.0;

// 3. Draw text (fixed at center)
ctx.font = '48px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = 'white';
ctx.fillText(text, width / 2, height / 2);

// Draw Legend (Top Left)
ctx.save();
ctx.font = '16px monospace';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
let legendY = 20;
const legendX = 20;
const lineHeight = 20;

const commands = [
'Commands:',
'jmp         - Jump',
'jkd / fdk   - Small Boost',
'jkdfdk      - Combo Boost',
'abracadabra - Super Boost',
'Backspace   - Clear Text'
];

commands.forEach(cmd => {
ctx.fillText(cmd, legendX, legendY);
legendY += lineHeight;
});
ctx.restore();

if (gameOver) {
if (gameOverOpacity < 1) {
gameOverOpacity += 0.02;
}
const overlayAlpha = 0.7 * gameOverOpacity;
ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
ctx.fillRect(0, 0, width, height);

ctx.save();
ctx.globalAlpha = gameOverOpacity;
ctx.fillStyle = 'white';
ctx.font = '64px sans-serif';
ctx.fillText('Game Over', width / 2, height / 2 - 50);

ctx.font = '32px sans-serif';
ctx.fillText('Press any key to continue', width / 2, height / 2 + 50);
ctx.restore();
}
};

onMount(() => {
resize();
ctx = canvas.getContext('2d');
update();
return () => cancelAnimationFrame(rid);
});

const resize = () => {
width = window.innerWidth;
height = window.innerHeight;
if (canvas) {
canvas.width = width;
canvas.height = height;
}
initStars();
};

const onKeyDown = (e: KeyboardEvent) => {
if (gameOver) {
e.preventDefault();
if (gameOverOpacity >= 1) {
gameOver = false;
gameOverOpacity = 0;
// Reset positions
cameraX = 0;
cameraVelocity = 0;
blueBlockOffsetY = 0;
blueVelocityY = 0;
// Position red block off-screen to the left relative to camera
redBlockX = -redBlockSize;
// Reset rocks and stars
initStars();
particles = [];
return;
}
return;
}

if (e.key === 'Backspace') {
e.preventDefault();
text = '';
} else if (e.key.length === 1) {
text += e.key;
if (text.length > 15) {
text = text.slice(-15);
}

if (text.endsWith('jkdfdk')) {
cameraVelocity += 15; // Combo boost!
} else if (text.endsWith('jkd') || text.endsWith('fdk')) {
cameraVelocity += 5; // Smaller impulse but adds up
} else if (text.endsWith('abracadabra')) {
cameraVelocity += 30;
} else if (text.endsWith('jmp')) {
if (blueBlockOffsetY === 0) { // Only jump if on ground
blueVelocityY = -18;
cameraVelocity += 5;
}
}
}
};
</script>

<svelte:window on:resize={resize} on:keydown={onKeyDown} />

<canvas class="block bg-black" bind:this={canvas}> </canvas>
