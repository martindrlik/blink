<script lang="ts">
    import { onMount, tick } from 'svelte';

    let names: string[] = [];
    let characterProps: { 
        skinTone: string, 
        shirtColor: string, 
        pantsColor: string, 
        hairColor: string, 
        hairStyle: number,
        height: number,
    }[] = [];
    let newName = '';
    let gameState: 'input' | 'playing' = 'input';
    
    // Game State
    let spokenPlayers: Set<string> = new Set();
    let isExploding = false;
    let isRockApproaching = false;
    let rockScale = 0.1;
    let fadeAlpha = 0;
    let explosionStartTime = 0;
    let currentSpeakerName: string | null = null;
    
    // Alien Ship State
    let alienShip = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        nextSpawnTime: 0
    };

    // Canvas vars
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let animationFrameId: number;
    let width: number;
    let height: number;

    const GRAVITY = 0.5;
    const SPEED = 0.8; // Much slower speed
    const JUMP_FORCE = 8; // Default jump force
    const PIXEL_SCALE = 4; // Big pixels!

    // Particles
    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
        size: number;
    }
    let particles: Particle[] = [];

    const skinTones = ['#f8d9ce', '#f0c0b0', '#e0ac9a', '#c68674', '#8d5524', '#523424'];
    const shirtColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#334155', '#475569', '#94a3b8'];
    const pantsColors = ['#1e293b', '#334155', '#475569', '#422006', '#292524', '#262626', '#1e1b4b', '#1e3a8a'];
    const hairColors = ['#09090b', '#27272a', '#3f3f46', '#451a03', '#713f12', '#a16207', '#d97706', '#fcd34d', '#fef3c7', '#e5e7eb', '#9ca3af'];

    function getRandomProp(arr: any[]) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function addPlayer() {
        if (newName && newName.trim()) {
            const trimmed = newName.trim();
            if (names.includes(trimmed)) {
                alert('Name already exists!');
                return;
            }
            names = [...names, trimmed];
            characterProps = [...characterProps, {
                skinTone: getRandomProp(skinTones),
                shirtColor: getRandomProp(shirtColors),
                pantsColor: getRandomProp(pantsColors),
                hairColor: getRandomProp(hairColors),
                hairStyle: Math.floor(Math.random() * 4),
                height: 0.9 + Math.random() * 0.2
            }];
            newName = '';
        }
    }

    function removePlayer(index: number) {
        names = names.filter((_, i) => i !== index);
        characterProps = characterProps.filter((_, i) => i !== index);
    }

    class GamePlayer {
        x: number;
        y: number;
        vx: number;
        vy: number;
        name: string;
        color: string;
        width: number = 10;
        height: number = 16;
        isGrounded: boolean = false;
        facingRight: boolean = true;
        frame: number = 0;
        currentPlatform: Platform | null = null;
        targetX: number | null = null; // Target position to walk to
        isCheering: boolean = false; // New state
        rotation: number = 0;
        rotSpeed: number = 0;
        isDead: boolean = false;
        targetVictimName: string | null = null;
        stabbingFrame: number = 0;
        deathTime: number = 0;

        constructor(name: string, color: string, x: number, y: number) {
            this.name = name;
            this.color = color;
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            // Random offset for animation so they don't all move in sync
            this.frame = Math.random() * 100;
        }

        update(platforms: Platform[], gameWidth: number, gameHeight: number, isSomeoneSpeaking: boolean, currentSpeakerName: string | null = null, isRockApproaching: boolean = false) {
            // 1. Handle Dead Body Physics
            if (this.isDead) {
                this.vy += GRAVITY;
                this.y += this.vy;
                this.vx *= 0.95; // Lower friction for sliding (was 0.8)
                this.x += this.vx;
                
                // Rotation (Fall over)
                const targetRot = this.facingRight ? Math.PI / 2 : -Math.PI / 2;
                // Lerp rotation
                this.rotation = this.rotation * 0.9 + targetRot * 0.1;

                // Floor/Platform collision for corpse (simplified)
                let grounded = false;
                for (const platform of platforms) {
                    if (this.y + this.height > platform.y && 
                        this.y + this.height < platform.y + platform.height + 10 &&
                        this.x + this.width > platform.x && 
                        this.x < platform.x + platform.width &&
                        this.vy >= 0) {
                        
                        this.y = platform.y - this.height + 4; // Sink slightly into platform (dead)
                        this.vy = 0;
                        grounded = true;
                    }
                }
                if (!grounded && this.y + this.height > gameHeight - 20) {
                     this.y = gameHeight - 20 - this.height + 4; // Sink slightly into floor
                     this.vy = 0;
                }
                
                // Bounds
                if (this.x < 0) this.x = 0;
                if (this.x > gameWidth - this.width) this.x = gameWidth - this.width;
                
                // Resurrection Check (3-5 seconds)
                if (Date.now() - this.deathTime > 4000) {
                     this.isDead = false;
                     // When lying down (rotated 90deg), the visual center is same as standing center.
                     // But visually, the "feet" of the corpse are sideways.
                     // The logical X,Y is the top-left of the bounding box.
                     
                     // If we rotate around center:
                     // Standing: Feet at center.y + height/2
                     // Lying: Feet at center.x +/- height/2 (visually)
                     
                     // We want to stand up at the position of the corpse's "feet" or center?
                     // Probably center is best to avoid clipping into walls.
                     // But the user says "spot of his corpse".
                     
                     // Let's adjust Y slightly more to be safe
                     this.y -= 4; // Un-sink from ground
                     
                     // If we were facing right, our feet were to the left visually (rotated +90deg clockwise)
                     // Wait: +90deg (PI/2) rotates Clockwise. Top (Head) -> Right. Bottom (Feet) -> Left.
                     // So feet were at center.x - height/2.
                     // If we stand up at center.x, we shift right by height/2.
                     
                     // If facing Left (-90deg), Feet -> Right.
                     // So feet were at center.x + height/2.
                     
                     // Let's try to shift X to match where the feet were?
                     // No, "stand up on the spot" usually means center of mass stays put.
                     // But maybe they slid? 
                     
                     // Let's just ensure we reset rotation cleanly and maybe a bit of upward velocity is enough.
                     // The issue might be the visual offset during the frame of transition.
                     
                     this.rotation = 0;
                     this.vy = -5; // Jump up
                     this.vx = 0;
                     
                     // Force update of grounded state next frame
                     this.isGrounded = false;
                }
                
                return; // Stop processing normal logic for dead player
            }

            // 2. Handle Stabbing Cooldown
            if (this.stabbingFrame > 0) {
                this.stabbingFrame--;
                this.vy += GRAVITY;
                this.y += this.vy;
                // No movement while stabbing
                this.vx = 0;
                // Collision check to stay on ground
                 for (const platform of platforms) {
                    if (this.y + this.height > platform.y && 
                        this.y + this.height < platform.y + platform.height + 10 &&
                        this.x + this.width > platform.x && 
                        this.x < platform.x + platform.width &&
                        this.vy >= 0) {
                        this.y = platform.y - this.height;
                        this.vy = 0;
                    }
                }
                return;
            }

            // 3. Handle Pursuit (Killer Mode)
            if (this.targetVictimName) {
                const victim = players.find(p => p.name === this.targetVictimName);
                if (victim && !victim.isDead) {
                    // Update targetX to follow victim
                    this.targetX = victim.x;
                    
                    // Check if close enough to kill
                    const dist = Math.abs(this.x - victim.x);
                    const yDist = Math.abs(this.y - victim.y);
                    
                    if (dist < 8 && yDist < 10) {
                        // KILL!
                        this.stabbingFrame = 20; // Freeze for animation
                        this.targetX = null;     // Stop moving
                        this.targetVictimName = null; // Done
                        
                        // Kill victim
                        victim.isDead = true;
                        victim.deathTime = Date.now();
                        victim.vx = (this.facingRight ? 1 : -1) * 5; // Reduced Knockback (was 8)
                        victim.vy = -4; // Reduced launch (was -5)
                        
                        // BLOOD EXPLOSION
                        for(let i=0; i<20; i++) {
                            particles.push({
                                x: victim.x + Math.random() * 10,
                                y: victim.y + Math.random() * 10,
                                vx: (Math.random() - 0.5) * 4,
                                vy: (Math.random() - 1) * 4,
                                life: 1.0 + Math.random(),
                                color: '#ef4444', // Red
                                size: Math.random() * 3 + 1
                            });
                        }
                    }
                } else {
                    // Victim gone or dead, stop pursuit
                    this.targetVictimName = null;
                    this.targetX = null;
                }
            }

            // Apply gravity
            this.vy += GRAVITY;
            
            if (isRockApproaching) {
                // PANIC MODE
                this.isCheering = true; // Use cheering animation (waving arms)
                this.targetX = null; // Ignore targets
                
                // Random fast movement
                if (Math.random() < 0.2) {
                    this.vx = (Math.random() - 0.5) * (SPEED * 5);
                }
                
                // Keep moving if stopped
                if (Math.abs(this.vx) < 0.1) {
                     this.vx = (Math.random() - 0.5) * (SPEED * 5);
                }
                
                // Random jumping (lower height)
                if (this.isGrounded && Math.random() < 0.08) {
                    this.vy = -JUMP_FORCE * 0.6;
                }
                
                // Face direction of movement
                if (Math.abs(this.vx) > 0.1) {
                    this.facingRight = this.vx > 0;
                }
            } else if (this.targetX !== null) {
                // Moving to target (microphone)
                const dist = this.targetX - this.x;
                // If close enough, snap and stop
                if (Math.abs(dist) < SPEED) { 
                    this.x = this.targetX;
                    this.vx = 0;
                    // Keep targetX set? No, clear it so they idle.
                    // BUT: We want them to face mic.
                    // If targetX was mic position...
                    // Let's special case: If we just arrived at mic (center), face RIGHT.
                    const centerX = gameWidth / 2;
                    if (Math.abs(this.x - (centerX - 8)) < 5) {
                        this.facingRight = true;
                    }
                    this.targetX = null;
                } else {
                    // Move towards target
                    this.vx = Math.sign(dist) * SPEED;
                    this.facingRight = this.vx > 0;
                    
                    // If target is above (stage) and we are close in X, JUMP!
                    // This creates the "natural" jump arc near the stage
                    if (this.isGrounded && this.targetX) {
                        const centerX = gameWidth / 2;
                        // Stage is near center
                        const isTargetStage = Math.abs(this.targetX - centerX) < 40;
                        const distX = Math.abs(this.targetX - this.x);
                        
                        // Jump if approaching stage
                        if (isTargetStage && distX < 60 && distX > 20) {
                             if (this.y > gameHeight - 50) { // Only if on floor
                                 this.vy = -10;
                             }
                        }
                    }
                }
                this.isCheering = false; // Don't cheer while moving to target
            } else {
                // IDLE BEHAVIOR
                
                // Am I the current speaker? (By name if provided, or by position fallback)
                let isMeSpeaking = false;
                if (currentSpeakerName) {
                    isMeSpeaking = this.name === currentSpeakerName && isSomeoneSpeaking;
                } else {
                    // Fallback to position check if no name provided (shouldn't happen with new logic but safe)
                    const centerX = gameWidth / 2;
                    isMeSpeaking = Math.abs(this.x - (centerX - 8)) < 5 && Math.abs(this.vx) < 0.1;
                }

                if (isMeSpeaking) {
                    this.isCheering = false;
                    
                    // TALKING BEHAVIOR:
                    // 1. Random small horizontal pacing
                    if (Math.random() < 0.05) {
                        this.vx = (Math.random() - 0.5) * (SPEED * 0.25); 
                    }
                    
                    // Keep roughly near mic (center)
                    const centerX = gameWidth / 2;
                    const micX = centerX - 8;
                    const leash = 15; // Range to wander
                    
                    if (this.x < micX - leash) this.vx = Math.abs(this.vx) + 0.1;
                    if (this.x > micX + leash) this.vx = -Math.abs(this.vx) - 0.1;

                    // 2. Face direction of movement, or audience (right) if stopped
                    if (Math.abs(this.vx) > 0.05) {
                        this.facingRight = this.vx > 0;
                    } else {
                        // Occasionally look back, but mostly face audience
                        // Reduced frequency of eye movement/direction flipping
                        if (Math.random() < 0.005) this.facingRight = !this.facingRight;
                        else if (Math.random() < 0.02) this.facingRight = true;
                    }

                    // 3. "Talking" bob
                    if (Math.random() < 0.1) {
                         this.y -= 1; 
                    }
                } else if (isSomeoneSpeaking) {
                     // CHEERING MODE (only if NOT the speaker)
                     this.isCheering = true;
                     this.vx = 0; // Stop moving sideways
                     
                     // Face the center (where speaker is)
                     const centerX = gameWidth / 2;
                     this.facingRight = this.x < centerX;

                     // Occasional small jump (cheer)
                     if (this.isGrounded && Math.random() < 0.005) {
                         this.vy = -3; 
                     }
                } else {
                    // Normal wandering
                    this.isCheering = false;
                    if (Math.random() < 0.02) {
                        this.vx = (Math.random() - 0.5) * SPEED;
                        this.facingRight = this.vx > 0;
                    }
                }
            }
            
            // Apply friction if IDLE or Cheering (but less if speaking/pacing)
            if (this.targetX === null) {
                // If panicking, keep moving!
                if (isRockApproaching) {
                    this.vx *= 0.95; 
                } else if (this.isCheering) {
                     this.vx *= 0.5; // Stop fast
                } else {
                     this.vx *= 0.9;
                }
            }

            // X Movement with Platform Constraints
            let nextX = this.x + this.vx;
            
            // Platform constraint check
            // Allow moving off platforms if we have a target OR if we are panicking
            if (this.isGrounded && this.currentPlatform && this.targetX === null && !isRockApproaching) {
                 const minX = this.currentPlatform.x;
                 const maxX = this.currentPlatform.x + this.currentPlatform.width - this.width;
                 
                 // If moving would take us off the platform, stop/bounce
                 // ONLY if we don't have a target. If we have a target, we might need to fall off.
                 if (nextX < minX) {
                     nextX = minX;
                     this.vx *= -0.5;
                     this.facingRight = true;
                 } else if (nextX > maxX) {
                     nextX = maxX;
                     this.vx *= -0.5;
                     this.facingRight = false;
                 }
            }
            
            this.x = nextX;

            // Global screen bounds check
            if (this.x < 0) { this.x = 0; this.vx = 0; }
            if (this.x > gameWidth - this.width) { this.x = gameWidth - this.width; this.vx = 0; }

            // Move Y
            this.y += this.vy;

            // --- COLLISION DETECTION ---
            
            // Assume not grounded first
            this.isGrounded = false;
            
            // If jumping up, we definitely aren't grounded
            if (this.vy < 0) {
                this.currentPlatform = null;
            }

            let foundPlatform = false;

            // Platform collision
            for (const platform of platforms) {
                if (this.y + this.height > platform.y && 
                    this.y + this.height < platform.y + platform.height + 10 &&
                    this.x + this.width > platform.x && 
                    this.x < platform.x + platform.width &&
                    this.vy >= 0) {
                    
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.isGrounded = true;
                    this.currentPlatform = platform;
                    foundPlatform = true;
                }
            }

            // Floor collision
            if (!foundPlatform && this.y + this.height > gameHeight - 20) {
                 this.y = gameHeight - 20 - this.height;
                 this.vy = 0;
                 this.isGrounded = true;
                 this.currentPlatform = { x: 0, y: gameHeight - 20, width: gameWidth, height: 20, color: '' };
                 foundPlatform = true;
            }
            
            // If we didn't find a platform this frame, and we were falling, we are truly airborne
            if (!foundPlatform && this.vy >= 0) {
                this.currentPlatform = null;
            }
            
            this.frame += 0.1;
        }

        draw(ctx: CanvasRenderingContext2D) {
            ctx.save();
            
            // Handle rotation for dead body
            if (this.isDead) {
                const cx = this.x + this.width/2;
                const cy = this.y + this.height/2;
                ctx.translate(cx, cy);
                ctx.rotate(this.rotation);
                ctx.translate(-cx, -cy);
            }

            // Add bobbing if cheering
            let yOffset = 0;
            if (this.isCheering && this.isGrounded && !this.isDead) {
                 yOffset = Math.sin(this.frame * 0.5) * 1; // Gentle bob
            }
            ctx.translate(Math.round(this.x), Math.round(this.y + yOffset));
            
            // Pixel art character
            ctx.fillStyle = this.color;
            // Body
            ctx.fillRect(2, 6, 6, 6);
            // Head
            ctx.fillStyle = '#ffccaa'; // Skin
            ctx.fillRect(2, 1, 6, 5);
            
            // Dead eyes
            if (this.isDead) {
                 ctx.fillStyle = '#000';
                 if (this.facingRight) {
                    ctx.fillRect(5, 3, 1, 1);
                    ctx.fillRect(7, 3, 1, 1);
                 } else {
                    ctx.fillRect(2, 3, 1, 1);
                    ctx.fillRect(4, 3, 1, 1);
                 }
                 // Blood pool
                 ctx.fillStyle = '#ef4444';
                 ctx.globalAlpha = 0.6;
                 ctx.fillRect(-2, 14, 14, 2);
                 ctx.globalAlpha = 1.0;
            }

            // Legs
            ctx.fillStyle = '#333';
            if (Math.abs(this.vx) > 0.1 && !this.isDead) {
                // Walking animation
                const walkCycle = Math.sin(this.frame) > 0;
                ctx.fillRect(2, 12, 3, walkCycle ? 3 : 4);
                ctx.fillRect(6, 12, 3, walkCycle ? 4 : 3);
            } else {
                ctx.fillRect(2, 12, 3, 4);
                ctx.fillRect(6, 12, 3, 4);
            }
            
            // ARMS (Cheering logic)
            if (this.isCheering && !this.isDead) {
                ctx.fillStyle = this.color; // Sleeve
                // Raise hands
                if (Math.sin(this.frame * 0.5) > 0) {
                     // Hands UP
                     ctx.fillRect(1, 5, 2, 4); // Left arm up
                     ctx.fillRect(7, 5, 2, 4); // Right arm up
                } else {
                     // Hands slightly lower
                     ctx.fillRect(1, 6, 2, 4); 
                     ctx.fillRect(7, 6, 2, 4); 
                }
            } else if (this.stabbingFrame > 0) {
                // Stabbing animation
                ctx.fillStyle = this.color;
                if (this.facingRight) {
                    ctx.fillRect(6, 6, 6, 2); // Arm forward
                    ctx.fillStyle = '#bdc3c7'; // Knife blade
                    ctx.fillRect(12, 6, 4, 1);
                    ctx.fillStyle = '#ef4444'; // Blood on knife?
                    ctx.fillRect(14, 6, 2, 1);
                } else {
                    ctx.fillRect(-2, 6, 6, 2); // Arm forward
                    ctx.fillStyle = '#bdc3c7';
                    ctx.fillRect(-6, 6, 4, 1);
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(-6, 6, 2, 1);
                }
            } else {
                // Normal arms (sides)
                // Just implied by body or could draw them
            }

            // Eyes (Alive)
            if (!this.isDead) {
                ctx.fillStyle = '#000';
                if (this.facingRight) {
                    ctx.fillRect(5, 3, 1, 1);
                    ctx.fillRect(7, 3, 1, 1);
                } else {
                    ctx.fillRect(2, 3, 1, 1);
                    ctx.fillRect(4, 3, 1, 1);
                }
            }

            // Name tag
            if (!this.isDead) {
                ctx.fillStyle = 'white';
                ctx.font = '4px monospace';
                ctx.textAlign = 'center';
                // Adjusted font size for smaller scale context
                ctx.fillText(this.name, 5, -2);
            }
            
            ctx.restore();
        }
    }

    interface Platform {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
    }

    let players: GamePlayer[] = [];
    let platforms: Platform[] = [];

    function initGame() {
        if (!canvas) {
            requestAnimationFrame(initGame);
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            requestAnimationFrame(initGame);
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        
        // Physical pixels
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Context scaling
        ctx = canvas.getContext('2d')!;
        // Scale everything up by PIXEL_SCALE (and dpr)
        // This makes 1 unit in our logic = PIXEL_SCALE screen pixels
        ctx.scale(dpr * PIXEL_SCALE, dpr * PIXEL_SCALE);
        ctx.imageSmoothingEnabled = false;

        // Logical width/height for game calculations
        width = rect.width / PIXEL_SCALE;
        height = rect.height / PIXEL_SCALE;

        // Generate platforms - scaled down positions
        const mainPlatY = height - 40;
        platforms = [
            // Main floor (Full width so they don't fall off in panic)
            { x: 0, y: mainPlatY, width: width, height: 10, color: '#445566' },
            // Stage platform (center)
            { x: width / 2 - 30, y: mainPlatY - 15, width: 60, height: 15, color: '#3e2723' }
        ];

        // Init players
        players = names.map((name, i) => {
            const props = characterProps[i];
            
            // Pick a random platform to start on
            const startPlat = platforms[Math.floor(Math.random() * platforms.length)];
            const startX = startPlat.x + Math.random() * (startPlat.width - 10);
            const startY = startPlat.y - 20;

            return new GamePlayer(
                name, 
                props.shirtColor, 
                startX, 
                startY
            );
        });
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();
    }

    function gameLoop() {
        if (gameState !== 'playing') return;
        if (!ctx || !canvas) return;

        // Check if there is an active speaker at the mic
        let isSomeoneSpeaking = false;
        if (currentSpeakerName) {
            // Verify they are still around (sanity check)
            const speaker = players.find(p => p.name === currentSpeakerName);
            if (speaker) {
                // Check if they have arrived at the stage area
                const stage = platforms[1];
                const micX = stage.x + stage.width / 2 - 8;
                // Considered speaking if close to mic, even if moving slightly
                if (Math.abs(speaker.x - micX) < 20 && Math.abs(speaker.y - (stage.y - speaker.height)) < 5) {
                    isSomeoneSpeaking = true;
                }
            }
        }

        // Update
        players.forEach(p => {
             p.update(platforms, width, height, isSomeoneSpeaking, currentSpeakerName, isRockApproaching);
        });

        // --- DRAWING THE SCENE ---

        // 1. Base Background (Ship Interior Wall OR Space if exploded)
        if (isExploding) {
             ctx.fillStyle = '#0a0a12'; // Space
             ctx.fillRect(0, 0, width, height);
        } else {
             ctx.fillStyle = '#2c3e50'; 
             ctx.fillRect(0, 0, width, height);
             
             // Wall panels
             ctx.strokeStyle = '#34495e';
             ctx.lineWidth = 1;
             for(let i=0; i<width; i+=40) {
                 ctx.beginPath();
                 ctx.moveTo(i, 0);
                 ctx.lineTo(i, height);
                 ctx.stroke();
                 
                 // Rivets
                 ctx.fillStyle = '#1a252f';
                 for(let j=10; j<height; j+=40) {
                     ctx.fillRect(i-1, j, 2, 2);
                 }
             }
        }

        // 2. Large Observation Window
        const windowPadding = 20;
        const windowWidth = width - (windowPadding * 2);
        const windowHeight = height * 0.6;
        const wx = windowPadding;
        const wy = 20;

        if (!isExploding) {
             // Window Frame (Behind)
             ctx.fillStyle = '#1a252f';
             ctx.fillRect(wx - 4, wy - 4, windowWidth + 8, windowHeight + 8);

             // Space (Black/Deep Blue)
             ctx.fillStyle = '#0a0a12';
             ctx.fillRect(wx, wy, windowWidth, windowHeight);

             // --- SPACE CONTENT (Clipped to window) ---
             ctx.save();
             ctx.beginPath();
             ctx.rect(wx, wy, windowWidth, windowHeight);
             ctx.clip();
        } else {
             ctx.save(); // Dummy save to match restore
        }

        const time = Date.now() / 1000;
        
        // Far Stars (Randomized positions using seeded logic)
        ctx.fillStyle = '#556677';
        for (let i = 0; i < 60; i++) {
             const boundsW = isExploding ? width : windowWidth;
             const boundsH = isExploding ? height : windowHeight;
             const ox = isExploding ? 0 : wx;
             const oy = isExploding ? 0 : wy;

             // Use prime numbers and modulo for pseudo-random distribution
             const randY = (i * 137 + 53) % 100 / 100;
             const randSpeed = 0.5 + ((i * 31) % 50) / 100; // 0.5 to 1.0 speed multiplier
             
             const x = (ox + ((i * 67 + time * 5 * randSpeed) % boundsW));
             const y = oy + (randY * boundsH);
             
             ctx.globalAlpha = 0.5 + ((i * 23) % 50) / 100; // Random opacity
             ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
             ctx.globalAlpha = 1.0;
        }
        
        // Near Stars (Faster, fewer)
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 30; i++) {
             const boundsW = isExploding ? width : windowWidth;
             const boundsH = isExploding ? height : windowHeight;
             const ox = isExploding ? 0 : wx;
             const oy = isExploding ? 0 : wy;

             const randY = (i * 211 + 17) % 100 / 100;
             const randSpeed = 0.8 + ((i * 47) % 40) / 100; // 0.8 to 1.2 speed multiplier

             const x = (ox + ((i * 101 + time * 15 * randSpeed) % boundsW));
             const y = oy + (randY * boundsH);
             
             // Random blinking
             if (Math.sin(time * 5 + i) > 0.9) ctx.globalAlpha = 0.2;
             else ctx.globalAlpha = 1.0;
             
             ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
             ctx.globalAlpha = 1.0;
        }

        // Random Space Debris (Rocks/Wrecks)
        const ox = isExploding ? 0 : wx;
        const oy = isExploding ? 0 : wy;
        const animWidth = isExploding ? width : windowWidth;
        const animHeight = isExploding ? height : windowHeight;

        // Helper for debris
        const drawRock = (tOffset: number, yPercent: number, size: number, speed: number, color: string) => {
            const cycle = 25 / speed; // seconds, faster speed = shorter cycle
            const localTime = (time + tOffset) % cycle;
            
            // Calculate X based on time, moving right to left
            // The (animWidth + 100) ensures it goes fully off screen before wrapping
            const dist = (localTime / cycle) * (animWidth + 100);
            const dx = animWidth - dist;
            
            // Only draw if within horizontal bounds (with some margin)
            if (dx > -50 && dx < animWidth + 50) {
                const dy = oy + yPercent * animHeight;
                const finalX = ox + dx;
                
                ctx.fillStyle = color;
                
                ctx.save();
                ctx.translate(finalX, dy);
                // Rotate based on time for tumble effect
                ctx.rotate(time * speed * 0.5);
                
                // Simple rock shape
                ctx.beginPath();
                ctx.moveTo(-size, -size * 0.8);
                ctx.lineTo(size * 0.5, -size);
                ctx.lineTo(size * 1.2, -size * 0.2);
                ctx.lineTo(size * 0.8, size * 0.8);
                ctx.lineTo(-size * 0.5, size * 1.2);
                ctx.lineTo(-size * 1.2, size * 0.5);
                ctx.closePath();
                ctx.fill();
                
                // Shadow/Highlight detail
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.arc(size * 0.3, size * 0.3, size * 0.4, 0, Math.PI*2);
                ctx.fill();
                
                ctx.restore();
            }
        };

        // Debris 1: Big brown rock
        drawRock(0, 0.4, 10, 0.8, '#5d4037');
        
        // Debris 2: Small grey rock (faster)
        drawRock(12, 0.7, 5, 1.2, '#7f8c8d');

        // Debris 3: Distant satellite/junk (slow)
        drawRock(7, 0.2, 4, 0.4, '#445566');

        // Debris 4: Another rock
        drawRock(18, 0.5, 8, 0.9, '#6d4c41');
        
        // Debris 5: Tiny fast debris
        drawRock(3, 0.8, 2, 2.0, '#95a5a6');

        // Alien Ship Logic
        if (!alienShip.active) {
            // Check if it's time to spawn
            if (Date.now() > alienShip.nextSpawnTime) {
                alienShip.active = true;
                
                // Pick a random corner for start and end (must be different)
                const buffer = 50;
                let startX, startY, targetX, targetY;
                const corners = [
                    { x: ox - buffer, y: oy - buffer },             // Top-Left
                    { x: ox + animWidth + buffer, y: oy - buffer }, // Top-Right
                    { x: ox + animWidth + buffer, y: oy + animHeight + buffer }, // Bottom-Right
                    { x: ox - buffer, y: oy + animHeight + buffer } // Bottom-Left
                ];

                const startIdx = Math.floor(Math.random() * 4);
                let endIdx = Math.floor(Math.random() * 4);
                while (endIdx === startIdx) {
                    endIdx = Math.floor(Math.random() * 4);
                }

                startX = corners[startIdx].x;
                startY = corners[startIdx].y;
                targetX = corners[endIdx].x;
                targetY = corners[endIdx].y;

                alienShip.x = startX;
                alienShip.y = startY;
                
                // Calculate velocity
                const dx = targetX - startX;
                const dy = targetY - startY;
                const dist = Math.hypot(dx, dy);
                const speed = 0.3 + Math.random() * 0.5; // Slower speed (0.3 - 0.8)
                
                alienShip.vx = (dx / dist) * speed;
                alienShip.vy = (dy / dist) * speed;
            }
        } else {
            // Update position
            alienShip.x += alienShip.vx;
            alienShip.y += alienShip.vy;
            
            // Draw Ship
            const shipX = alienShip.x;
            const shipY = alienShip.y + Math.sin(time * 2) * 5; // Slower, deeper bobbing (more natural)

            // Dome (Background)
            ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(shipX + 10, shipY + 2, 8, Math.PI, 0);
            ctx.fill();

            // Alien inside
            ctx.fillStyle = '#4ade80'; // Green
            ctx.fillRect(shipX + 8, shipY - 4, 4, 4); // Head
            
            // Eyes
            ctx.fillStyle = 'black';
            ctx.fillRect(shipX + 9, shipY - 3, 1, 1);
            ctx.fillRect(shipX + 11, shipY - 3, 1, 1);
            
            // Waving Arm
            ctx.fillStyle = '#4ade80';
            if (Math.sin(time * 15) > 0) {
                 // Hand Up
                 ctx.fillRect(shipX + 13, shipY - 5, 2, 1); // Hand
                 ctx.fillRect(shipX + 12, shipY - 2, 1, 3); // Arm
            } else {
                 // Hand Down
                 ctx.fillRect(shipX + 13, shipY - 2, 2, 1); // Hand
                 ctx.fillRect(shipX + 12, shipY - 2, 1, 1); // Arm stub
            }

            // Saucer Body
            ctx.fillStyle = '#94a3b8'; // Silver
            ctx.beginPath();
            ctx.ellipse(shipX + 10, shipY + 5, 20, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Lights on saucer
            const lightColor = (Math.floor(time * 5) % 2 === 0) ? '#facc15' : '#ef4444';
            ctx.fillStyle = lightColor;
            ctx.fillRect(shipX - 5, shipY + 4, 2, 2);
            ctx.fillRect(shipX + 5, shipY + 6, 2, 2);
            ctx.fillRect(shipX + 15, shipY + 6, 2, 2);
            ctx.fillRect(shipX + 23, shipY + 4, 2, 2);

            // Check boundaries to despawn
            const boundBuffer = 150;
            if (
                alienShip.x < ox - boundBuffer ||
                alienShip.x > ox + animWidth + boundBuffer ||
                alienShip.y < oy - boundBuffer ||
                alienShip.y > oy + animHeight + boundBuffer
            ) {
                alienShip.active = false;
                alienShip.nextSpawnTime = Date.now() + 3000 + Math.random() * 5000;
            }
        }

        // APPROACHING ROCK SEQUENCE
        if (isRockApproaching) {
            rockScale += 0.05; // Growth speed
            
            const centerX = wx + windowWidth / 2;
            const centerY = wy + windowHeight / 2;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            
            // Add Spin
            const spin = time * 4; // Faster spin
            ctx.rotate(spin);
            
            ctx.scale(rockScale, rockScale);
            
            // Draw Big Rock (centered at 0,0 after translate)
            ctx.fillStyle = '#3e2723'; // Dark Brown
            ctx.beginPath();
            // MORE JAGGED shape (more vertices)
            ctx.moveTo(-10, -8);
            ctx.lineTo(-4, -12); // New
            ctx.lineTo(5, -10);
            ctx.lineTo(10, -8); // New
            ctx.lineTo(12, -2);
            ctx.lineTo(14, 4);  // New
            ctx.lineTo(8, 8);
            ctx.lineTo(2, 11);  // New
            ctx.lineTo(-5, 12);
            ctx.lineTo(-12, 5);
            ctx.lineTo(-14, -2); // New
            ctx.closePath();
            ctx.fill();
            
            // Highlights/Crater
            // Removed counter-rotation so details spin with the rock
            
            ctx.fillStyle = '#5d4037';
            ctx.beginPath();
            ctx.arc(-3, -3, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Second Crater
            ctx.beginPath();
            ctx.arc(6, 4, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Shadow side (approximate)
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(-14, -2);
            ctx.lineTo(-5, 12);
            ctx.lineTo(2, 11);
            ctx.lineTo(-1, 0); // Inner point
            ctx.fill();

            ctx.restore();
            
            // IMPACT TRIGGER
            if (rockScale > 15) {
                isRockApproaching = false;
                isExploding = true;
                explosionStartTime = Date.now();
                
                // --- GENERATE DEBRIS PARTICLES FOR EVERYTHING ---

                // 1. Players - NOW THEY FLY AS BODIES
                players.forEach(p => {
                    // Give them random velocity for space drift
                    p.vx = (Math.random() - 0.5) * 5; // Slower, more floaty
                    p.vy = (Math.random() - 0.5) * 5;
                    // Add rotation property
                    p.rotation = 0;
                    p.rotSpeed = (Math.random() - 0.5) * 0.2;
                });

                // 2. Platforms
                platforms.forEach(p => {
                    for(let i=0; i<p.width / 5; i++) {
                        particles.push({
                            x: p.x + Math.random() * p.width,
                            y: p.y + Math.random() * p.height,
                            vx: (Math.random() - 0.5) * 4, // Slower (was 8)
                            vy: (Math.random() - 0.5) * 4,
                            life: 8.0 + Math.random() * 2, // Longer life (was 5)
                            color: ['#7f8c8d', '#95a5a6', '#34495e'][Math.floor(Math.random()*3)],
                            size: Math.random() * 5 + 2
                        });
                    }
                });

                // 3. Window / Walls / General debris
                for(let i=0; i<300; i++) {
                     particles.push({
                         x: Math.random() * width,
                         y: Math.random() * height,
                         vx: (Math.random() - 0.5) * 8, // Slower (was 15)
                         vy: (Math.random() - 0.5) * 8,
                         life: 8.0 + Math.random() * 2, // Longer life
                         color: ['#2c3e50', '#0a0a12', '#f39c12', '#ffffff'][Math.floor(Math.random()*4)],
                         size: Math.random() * 6 + 2
                     });
                }
            }
        }

        ctx.restore();
        // --- END SPACE CONTENT ---

        // IF EXPLODING, DO NOT DRAW SCENE ELEMENTS (Ship, Players, Platforms)
        if (!isExploding) {
             // Window Glass Reflection (Diagonal streaks)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(wx + windowWidth - 20, wy);
            ctx.lineTo(wx + windowWidth, wy);
            ctx.lineTo(wx + 20, wy + windowHeight);
            ctx.lineTo(wx, wy + windowHeight);
            ctx.fill();

            // 3. Floor
            ctx.fillStyle = '#1a252f'; 
            ctx.fillRect(0, height - 20, width, 20);
            // Hazard stripes on floor edge
            ctx.fillStyle = '#f39c12';
            for(let i=0; i<width; i+=20) {
                ctx.fillRect(i, height - 20, 10, 4);
            }

            // 4. Platforms
            platforms.forEach(p => {
                // Metal look
                ctx.fillStyle = '#7f8c8d';
                ctx.fillRect(p.x, p.y, p.width, p.height);
                // Highlights
                ctx.fillStyle = '#95a5a6';
                ctx.fillRect(p.x, p.y, p.width, 2);
                // Shadows
                ctx.fillStyle = '#34495e';
                ctx.fillRect(p.x, p.y + p.height - 2, p.width, 2);
                
                // Rivets
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(p.x + 2, p.y + 4, 2, 2);
                ctx.fillRect(p.x + p.width - 4, p.y + 4, 2, 2);
            });

            // 5. Players (Draw BEFORE mic)
            players.forEach(p => {
                p.draw(ctx);
            });

            // Microphone on Stage (Platform index 1) - Draw AFTER players so it's in front
            if (platforms[1]) {
                 const stage = platforms[1];
                 const mx = stage.x + stage.width / 2;
                 const my = stage.y;
                 
                 // Stand Base
                 ctx.fillStyle = '#2c3e50';
                 ctx.fillRect(mx - 2, my - 1, 4, 1);
                 
                 // Stand Pole
                 ctx.fillStyle = '#bdc3c7'; // Silver
                 ctx.fillRect(mx - 0.5, my - 12, 1, 12);
                 
                 // Mic Head (Retro rounded rectangle)
                 ctx.fillStyle = '#555'; 
                 ctx.fillRect(mx - 1.5, my - 15, 3, 4);
                 ctx.fillStyle = '#333'; // Grille lines
                 ctx.fillRect(mx - 1.5, my - 14, 3, 0.5);
                 ctx.fillRect(mx - 1.5, my - 13, 3, 0.5);
            }
        }

        // EXPLOSION PARTICLES
        if (isExploding) {
            // Draw a flash background initially
            if (Date.now() - explosionStartTime < 500) { // Longer flash (was 200)
                 const alpha = 1 - (Date.now() - explosionStartTime) / 500;
                 ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                 ctx.fillRect(0, 0, width, height);
            }

            // Draw drifting players
            players.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.995; // Very low drag
                p.vy *= 0.995;
                
                // Rotate
                p.rotation += p.rotSpeed;

                // Move to center of player for rotation
                const cx = p.x + p.width/2;
                const cy = p.y + p.height/2;
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(p.rotation);
                
                // Draw relative to center (0,0 is now center of player)
                // Player is ~10x16. Center is (5, 8)
                const dx = -5;
                const dy = -8;
                
                ctx.fillStyle = p.color;
                // Body
                ctx.fillRect(dx + 2, dy + 6, 6, 6);
                // Head
                ctx.fillStyle = '#ffccaa'; // Skin
                ctx.fillRect(dx + 2, dy + 1, 6, 5);
                // Legs (Flailing/Floating)
                ctx.fillStyle = '#333';
                ctx.fillRect(dx + 1, dy + 12, 3, 4); // Left leg out
                ctx.fillRect(dx + 7, dy + 10, 3, 4); // Right leg up
                
                // Arms (Flailing)
                ctx.fillStyle = p.color;
                ctx.fillRect(dx + 0, dy + 4, 2, 4); // Left arm up
                ctx.fillRect(dx + 8, dy + 7, 2, 4); // Right arm down

                // Eyes (X X)
                ctx.fillStyle = '#000';
                ctx.font = '4px monospace';
                ctx.fillText('x', dx + 3, dy + 5);
                ctx.fillText('x', dx + 6, dy + 5);
                
                ctx.restore();
            });

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                // No gravity for space explosion, or very little
                p.vx *= 0.995; // Less Drag (was 0.99)
                p.vy *= 0.995;
                
                p.life -= 0.002; // Slower decay (was 0.005)
                
                if (p.life <= 0) {
                    particles.splice(i, 1);
                } else {
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, p.life);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                    ctx.restore();
                }
            }

            // Check if 8 seconds passed (longer sequence)
            const elapsed = Date.now() - explosionStartTime;
            if (elapsed > 8000) {
                // Fade out
                fadeAlpha += 0.005; // Slower fade
                if (fadeAlpha > 1) fadeAlpha = 1;
                
                ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
                ctx.fillRect(0, 0, width, height);

                if (fadeAlpha >= 1) {
                    stopGame();
                    return;
                }
            }
        }

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        if (names.length > 0) {
            gameState = 'playing';
            spokenPlayers.clear();
            isExploding = false;
            isRockApproaching = false;
            rockScale = 0.1;
            fadeAlpha = 0;
            particles = [];
            currentSpeakerName = null;
            requestAnimationFrame(initGame);
        }
    }

    function stopGame() {
        gameState = 'input';
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    function handleGameKeydown(e: KeyboardEvent) {
        if (gameState === 'input') {
            if (e.key === 'Enter' && newName && newName.trim()) addPlayer();
        } else if (gameState === 'playing' && !isExploding) {
             if (e.key === 'Enter') {
                 if (players.length > 0 && platforms.length > 1) {
                     // Find players who haven't spoken yet
                     const candidates = players.filter(p => !spokenPlayers.has(p.name));

                     if (candidates.length === 0) {
                         // All have spoken! Trigger Rock Approach Sequence
                         isRockApproaching = true;
                         rockScale = 0.1;
                         return;
                     }

                     const stage = platforms[1];
                     const micX = stage.x + stage.width / 2;
                     
                     // 1. Pick random player from CANDIDATES
                     const speaker = candidates[Math.floor(Math.random() * candidates.length)];
                     spokenPlayers.add(speaker.name);
                     currentSpeakerName = speaker.name;
                     
                     players.forEach(p => {
                         if (p === speaker) {
                             // Go to mic (slightly left of it)
                             p.targetX = micX - 8;
                             // Force facing right
                             p.facingRight = true;
                             
                             // Jump if below stage
                             if (p.y > stage.y) {
                                 p.vy = -10; 
                             }
                         } else {
                             // Others leave stage area
                             // If X is near stage, move away just enough
                             if (p.x > stage.x - 10 && p.x < stage.x + stage.width + 10) {
                                 // Decide direction based on where they are relative to center of stage
                                 const centerStage = stage.x + stage.width / 2;
                                 const goLeft = p.x < centerStage;
                                 
                                 // Move just off the stage
                                 const buffer = 15 + Math.random() * 20; // Random distance 15-35px away
                                 if (goLeft) {
                                     p.targetX = stage.x - buffer;
                                 } else {
                                     p.targetX = stage.x + stage.width + buffer;
                                 }
                             }
                         }
                     });
                 }
             } else if (e.key === ' ') {
                 // VIOLENT TRANSITION
                 if (players.length > 0 && platforms.length > 1) {
                     const candidates = players.filter(p => !spokenPlayers.has(p.name) && !p.isDead && p.name !== currentSpeakerName);

                     if (candidates.length === 0) {
                         // Everyone dead or spoken? Rock approach?
                         isRockApproaching = true;
                         rockScale = 0.1;
                         return;
                     }

                     const stage = platforms[1];
                     const micX = stage.x + stage.width / 2;

                     // Check if we have a victim
                     if (!currentSpeakerName) {
                         // No victim, just act like Enter (Normal start)
                         const speaker = candidates[Math.floor(Math.random() * candidates.length)];
                         spokenPlayers.add(speaker.name);
                         currentSpeakerName = speaker.name;
                         
                         players.forEach(p => {
                             if (p === speaker) {
                                 p.targetX = micX - 8;
                                 p.facingRight = true;
                                 if (p.y > stage.y) p.vy = -10; 
                             }
                         });
                     } else {
                         // KILLER MODE
                         const victimName = currentSpeakerName;
                         const killer = candidates[Math.floor(Math.random() * candidates.length)];
                         
                         spokenPlayers.add(killer.name);
                         currentSpeakerName = killer.name; // They will be the speaker
                         
                         // Set Killer to hunt
                         killer.targetVictimName = victimName;
                         killer.facingRight = killer.x < micX; // Face victim initially
                         if (killer.y > stage.y) killer.vy = -10; // Jump to stage
                         
                         // Everyone else (except victim and killer) clears out
                         players.forEach(p => {
                             if (p.name !== victimName && p !== killer && !p.isDead) {
                                 // Scram!
                                 if (p.x > stage.x - 10 && p.x < stage.x + stage.width + 10) {
                                     const centerStage = stage.x + stage.width / 2;
                                     const goLeft = p.x < centerStage;
                                     const buffer = 15 + Math.random() * 20;
                                     if (goLeft) p.targetX = stage.x - buffer;
                                     else p.targetX = stage.x + stage.width + buffer;
                                 }
                             }
                         });
                     }
                 }
             }
         }
    }
</script>

<svelte:window on:keydown={handleGameKeydown} />

<div class="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-4">
    {#if gameState === 'input'}
        <div class="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
            <h1 class="text-3xl font-bold mb-8 text-center text-teal-400 drop-shadow-lg">Not Alone in Space</h1>
            
            <div class="flex gap-2 mb-8 relative">
                <input
                    type="text"
                    bind:value={newName}
                    placeholder="Enter player name..."
                    class="w-full px-5 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white placeholder-slate-500"
                />
                <button
                    on:click|preventDefault={addPlayer}
                    class="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                    Add
                </button>
            </div>

            <div class="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {#if names.length === 0}
                    <div class="text-center py-8 text-slate-500 italic bg-slate-900/50 rounded-lg border border-slate-700/50 border-dashed">
                        Add at least one player to start...
                    </div>
                {:else}
                    {#each names as name, i}
                        <div class="group flex justify-between items-center bg-slate-700/50 hover:bg-slate-700 px-4 py-3 rounded-lg border border-transparent hover:border-slate-600 transition-all">
                            <span class="font-medium text-lg text-slate-200">{name}</span>
                            <button
                                on:click={() => removePlayer(i)}
                                class="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all transform hover:rotate-90"
                                aria-label="Remove player"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <button
                on:click={startGame}
                disabled={names.length === 0}
                class="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold text-xl shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:transform-none"
            >
                Start Game ({names.length} Player{names.length !== 1 ? 's' : ''})
            </button>
        </div>
    {:else if gameState === 'playing'}
        <div class="fixed inset-0 w-full h-full bg-slate-900">
            <canvas 
                bind:this={canvas} 
                class="w-full h-full block"
            ></canvas>
            
            <button 
                class="absolute top-4 left-4 z-50 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded border border-white/50 font-mono text-sm tracking-widest transition-all uppercase"
                on:click={stopGame}
            >
                &lt; BACK
            </button>
        </div>
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(30, 41, 59, 0.5);
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #64748b;
    }
</style>
