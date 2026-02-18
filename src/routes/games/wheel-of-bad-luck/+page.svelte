<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let names: string[] = [];
    let newName = '';
    let gameState: 'input' | 'playing' = 'input';
    
    let stars: { x: number; y: number; size: number; opacity: number }[] = [];
    let snowflakes: { x: number; y: number; size: number; duration: number; delay: number }[] = [];
    let clouds: { x: number; y: number; scale: number; opacity: number; duration: number }[] = [];
    let lightning: { x: number, active: boolean, path: string } = { x: 0, active: false, path: '' };
    let struckIndex: number | null = null;
    let deadIndices: Set<number> = new Set();
    
    function generateBoltPath(width: number, height: number): string {
        const startX = width / 2;
        const endX = width / 2; // Target center bottom
        let path = `M${startX},0`;
        let currentX = startX;
        let currentY = 0;
        const segments = 8;
        const segmentHeight = height / segments;
        
        for (let i = 1; i <= segments; i++) {
            currentY += segmentHeight;
            
            // For the last point, snap to target. For others, wander but bias towards target
            if (i === segments) {
                currentX = endX;
            } else {
                // Calculate bias towards center as we get closer to bottom
                const progress = i / segments;
                const centerBias = (endX - currentX) * progress; // Pull harder towards end
                const randomJitter = (Math.random() - 0.5) * 60; // Random zig-zag
                
                currentX += randomJitter + centerBias * 0.5;
            }
            
            path += ` L${currentX},${currentY}`;
        }
        return path;
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
        
        // Generate stars
        stars = Array.from({ length: 100 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 60, // Top 60% of screen
            size: Math.random() * 2 + 1,
            opacity: Math.random() * 0.7 + 0.3
        }));

        // Generate snowflakes
        snowflakes = Array.from({ length: 400 }, () => ({
            x: Math.random() * 150 - 25, // Start wider to account for wind
            y: -20, // Start above screen
            size: Math.random() * 3 + 1,
            duration: Math.random() * 3 + 2, // 2-5s fall duration (faster)
            delay: Math.random() * 5
        }));

        // Generate clouds
        clouds = Array.from({ length: 8 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 30, // Top 30% of screen
            scale: Math.random() * 0.5 + 0.5,
            opacity: Math.random() * 0.3 + 0.1,
            duration: Math.random() * 60 + 60 // 60-120s drift duration
        }));
    });

    import { onDestroy } from 'svelte';
    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeydown);
        }
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && gameState === 'playing' && !lightning.active && names.length > deadIndices.size) {
            triggerLightning();
        }
    }

    function triggerLightning() {
        // Find alive people
        const aliveIndices = names.map((_, i) => i).filter(i => !deadIndices.has(i));
        
        if (aliveIndices.length === 0) return;

        const randomAliveIndex = Math.floor(Math.random() * aliveIndices.length);
        const targetIndex = aliveIndices[randomAliveIndex];
        
        struckIndex = targetIndex;
        
        // Generate new random path for this strike
        const path = generateBoltPath(100, 400); // 100 width, 400 height (viewport units in SVG)
        lightning = { ...lightning, active: true, path };
        
        const duration = 200 + Math.random() * 400; // Random duration 200-600ms
        
        setTimeout(() => {
            lightning.active = false;
            if (struckIndex !== null) {
                deadIndices.add(struckIndex);
                deadIndices = deadIndices; // Trigger reactivity
            }
            struckIndex = null;
        }, duration); 
    }

    function addName() {
        if (newName.trim()) {
            names = [...names, newName.trim()];
            newName = '';
        }
    }

    function removeName(index: number) {
        names = names.filter((_, i) => i !== index);
    }

    function startGame() {
        if (names.length > 0) {
            deadIndices = new Set();
            gameState = 'playing';
        }
    }
</script>

<div class="h-screen w-full overflow-hidden bg-zinc-900 text-gray-200 font-sans relative">
    {#if gameState === 'input'}
        <div class="absolute inset-0 flex flex-col items-center justify-center h-full p-4 space-y-6 bg-zinc-900 z-50" out:fade={{ duration: 500 }} in:fade={{ duration: 500 }}>
            <h1 class="text-4xl font-bold text-gray-400 mb-8 uppercase tracking-widest border-b border-gray-700 pb-2">Wheel of Bad Luck</h1>
            
            <div class="w-full max-w-md bg-zinc-800 p-6 rounded-lg shadow-2xl border border-zinc-700">
                <h2 class="text-xl mb-4 font-medium text-gray-400 text-center">Enter the names of the doomed</h2>
                
                <form on:submit|preventDefault={addName} class="flex gap-2 mb-6">
                    <input
                        type="text"
                        bind:value={newName}
                        placeholder="Type a name..."
                        class="flex-1 px-4 py-2 bg-zinc-700 border border-zinc-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:bg-zinc-600 transition-colors"
                    />
                    <button
                        type="submit"
                        class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded font-semibold transition-colors border border-gray-500"
                    >
                        Add
                    </button>
                </form>

                <div class="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {#each names as name, i}
                        <div class="flex justify-between items-center bg-zinc-700/50 p-2 rounded group border border-transparent hover:border-gray-600 transition-colors">
                            <span class="text-gray-300">{name}</span>
                            <button 
                                on:click={() => removeName(i)}
                                class="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                            >
                                ✕
                            </button>
                        </div>
                    {/each}
                    {#if names.length === 0}
                        <p class="text-gray-600 text-center italic text-sm py-4">The list is empty...</p>
                    {/if}
                </div>

                <button
                    on:click={startGame}
                    disabled={names.length === 0}
                    class="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold text-lg transition-all shadow-lg border border-zinc-600 hover:border-gray-500 uppercase tracking-wide"
                >
                    Enter the Forest
                </button>
            </div>
        </div>
    {:else}
        <!-- Game Scene -->
        <div class="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#334155]" in:fade={{ duration: 800 }} out:fade={{ duration: 500 }}>
            
            <!-- Stars -->
            {#each stars as star}
                <div 
                    class="absolute rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)] animate-pulse"
                    style="left: {star.x}%; top: {star.y}%; width: {star.size}px; height: {star.size}px; opacity: {star.opacity}; animation-duration: {Math.random() * 3 + 2}s"
                ></div>
            {/each}

            <!-- Clouds -->
            {#each clouds as cloud}
                <div 
                    class="absolute animate-drift pointer-events-none"
                    style="left: {cloud.x}%; top: {cloud.y}%; opacity: {cloud.opacity}; transform: scale({cloud.scale}); animation-duration: {cloud.duration}s"
                >
                    <div class="w-32 h-12 bg-slate-400/30 rounded-full blur-xl"></div>
                    <div class="w-24 h-12 bg-slate-400/30 rounded-full blur-xl absolute -top-4 left-6"></div>
                    <div class="w-28 h-10 bg-slate-400/30 rounded-full blur-xl absolute top-4 left-8"></div>
                </div>
            {/each}

            <!-- Parallax Layers -->
            
            <!-- Layer 1: Distant Mountains (Slowest) -->
            <div class="absolute bottom-0 left-0 w-[200%] h-full pointer-events-none opacity-60 translate-x-[-10%]">
                <svg viewBox="0 0 1200 600" class="w-full h-full absolute bottom-0 fill-slate-800" preserveAspectRatio="none">
                    <path d="M0,600 L0,300 L150,150 L300,350 L450,100 L600,400 L750,200 L900,350 L1050,150 L1200,400 L1200,600 Z" />
                </svg>
            </div>

            <!-- Layer 2: Closer Mountains -->
            <div class="absolute bottom-0 left-0 w-[200%] h-full pointer-events-none opacity-80 translate-x-[-5%]">
                <svg viewBox="0 0 1200 600" class="w-full h-full absolute bottom-0 fill-slate-700" preserveAspectRatio="none">
                    <path d="M0,600 L0,400 L100,250 L250,450 L400,200 L550,400 L700,250 L900,450 L1050,200 L1200,450 L1200,600 Z" />
                </svg>
            </div>

            <!-- Layer 3: Trees (Back) -->
            <div class="absolute bottom-20 left-0 w-[200%] h-64 pointer-events-none">
                {#each Array.from({length: 20}) as _, i}
                    <div 
                        class="absolute bottom-0 w-0 h-0 border-l-[30px] border-r-[30px] border-b-[120px] border-l-transparent border-r-transparent border-b-emerald-900/60"
                        style="left: {i * 10}%; transform: scale({0.8 + Math.random() * 0.4})"
                    ></div>
                {/each}
            </div>

            <!-- Layer 4: Ground -->
            <div class="absolute bottom-0 w-full h-32 bg-gradient-to-t from-emerald-950 to-emerald-900 z-10 border-t-4 border-emerald-800/50"></div>

            <!-- Snow (Foreground) -->
            <div class="absolute inset-0 pointer-events-none z-50">
                 {#each snowflakes as flake}
                    <div 
                        class="absolute bg-white rounded-full opacity-80 animate-fall"
                        style="
                            left: {flake.x}%; 
                            top: -10px;
                            width: {flake.size}px; 
                            height: {flake.size}px; 
                            animation-duration: {flake.duration}s; 
                            animation-delay: -{flake.delay}s;
                        "
                    ></div>
                {/each}
            </div>
            
            <!-- Lightning Flash Overlay -->
            {#if lightning.active}
                <div class="absolute inset-0 bg-white/30 z-[60] pointer-events-none animate-flash"></div>
            {/if}

            <!-- Characters on Ground -->
            <div class="absolute bottom-28 left-0 right-0 z-20 px-10 flex justify-center items-end gap-24 overflow-visible">
                {#each names as name, i}
                    <div class="group relative flex flex-col items-center hover:scale-110 transition-transform cursor-pointer">
                        <!-- Lightning Bolt -->
                        {#if lightning.active && struckIndex === i}
                            <div class="absolute -top-[600px] bottom-16 left-1/2 -translate-x-1/2 w-40 h-[700px] z-50 pointer-events-none">
                                <!-- Main Bolt Core -->
                                <svg viewBox="0 0 100 400" class="w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] filter overflow-visible">
                                    <defs>
                                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                            <feMerge>
                                                <feMergeNode in="coloredBlur"/>
                                                <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <!-- Main jagged path -->
                                    <path d={lightning.path} 
                                          fill="none" stroke="white" stroke-width="3" filter="url(#glow)"
                                          class="animate-bolt">
                                    </path>
                                    <!-- Secondary path for thickness/variation -->
                                    <path d={lightning.path} 
                                          fill="none" stroke="#bfdbfe" stroke-width="6" opacity="0.4" filter="url(#glow)"
                                          class="animate-bolt-2">
                                    </path>
                                </svg>
                                
                                <!-- Side Branches -->
                                <svg viewBox="0 0 100 200" class="absolute top-20 -left-20 w-32 h-64 opacity-70 animate-branch-1">
                                    <path d="M100,0 L60,40 L80,80 L40,120" fill="none" stroke="#93c5fd" stroke-width="1.5" filter="url(#glow)" />
                                </svg>
                                <svg viewBox="0 0 100 200" class="absolute top-40 -right-16 w-32 h-64 opacity-70 animate-branch-2">
                                    <path d="M0,0 L40,30 L20,70 L60,100" fill="none" stroke="#93c5fd" stroke-width="1.5" filter="url(#glow)" />
                                </svg>
                            </div>
                        {/if}

                        <!-- Character Body -->
                        <div class="relative w-12 h-24 transition-all duration-75 {lightning.active && struckIndex === i ? 'animate-shake' : ''}">
                             <!-- Normal Appearance -->
                             <div class="{(lightning.active && struckIndex === i) || deadIndices.has(i) ? 'opacity-0' : 'opacity-100'} transition-opacity duration-100">
                                 <!-- Head -->
                                <div class="w-10 h-10 bg-[#fca] rounded-full absolute -top-1 left-1 border border-black z-10"></div>
                                <!-- Body -->
                                <div class="w-12 h-14 bg-blue-600 absolute top-8 rounded-t-lg border border-black z-0"></div>
                                 <!-- Legs -->
                                <div class="w-4 h-10 bg-black absolute bottom-0 left-1"></div>
                                <div class="w-4 h-10 bg-black absolute bottom-0 right-1"></div>
                                 <!-- Arms -->
                                 <div class="w-3 h-12 bg-[#fca] absolute top-9 -left-2 rotate-12 rounded-full border border-black"></div>
                                 <div class="w-3 h-12 bg-[#fca] absolute top-9 -right-2 -rotate-12 rounded-full border border-black"></div>
                             </div>

                             <!-- Skeleton Appearance (X-Ray Effect) -->
                             <div class="absolute inset-0 {(lightning.active && struckIndex === i) || deadIndices.has(i) ? 'opacity-100' : 'opacity-0'} transition-opacity duration-75 z-20 pointer-events-none">
                                <!-- Skull -->
                                <div class="w-8 h-9 bg-white rounded-full absolute top-0 left-2 border border-slate-300">
                                    <div class="w-2 h-2 bg-black rounded-full absolute top-2.5 left-1.5"></div>
                                    <div class="w-2 h-2 bg-black rounded-full absolute top-2.5 right-1.5"></div>
                                    <div class="w-3 h-1.5 bg-black rounded-full absolute bottom-2 left-2.5"></div>
                                </div>
                                <!-- Spine -->
                                <div class="w-2 h-14 bg-white absolute top-9 left-[20px] border border-slate-300 flex flex-col justify-between py-1">
                                    {#each Array(6) as _} <div class="w-4 h-0.5 bg-slate-300 -ml-1"></div> {/each}
                                </div>
                                <!-- Ribs -->
                                <div class="w-8 h-8 border-2 border-white rounded-full absolute top-10 left-2 opacity-80"></div>
                                <div class="w-6 h-6 border-2 border-white rounded-full absolute top-12 left-3 opacity-80"></div>
                                <!-- Pelvis -->
                                <div class="w-8 h-4 bg-white absolute top-[64px] left-2 rounded-b-lg border border-slate-300"></div>
                                <!-- Leg Bones -->
                                <div class="w-1.5 h-9 bg-white absolute bottom-0 left-2.5 border border-slate-300"></div>
                                <div class="w-1.5 h-9 bg-white absolute bottom-0 right-2.5 border border-slate-300"></div>
                                <!-- Arm Bones -->
                                <div class="w-1.5 h-11 bg-white absolute top-10 -left-1 rotate-12 border border-slate-300"></div>
                                <div class="w-1.5 h-11 bg-white absolute top-10 -right-1 -rotate-12 border border-slate-300"></div>
                             </div>
                        </div>
                        
                        <!-- Name Tag -->
                        <div class="absolute -bottom-8 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 z-30">
                            {name}
                        </div>
                    </div>
                {/each}
            </div>

            <!-- UI Overlay -->
            <button 
                class="absolute top-4 left-4 z-50 px-4 py-2 bg-black/50 hover:bg-black/80 text-white rounded text-sm backdrop-blur-md border border-white/10 transition-colors"
                on:click={() => gameState = 'input'}
            >
                ← Back to Input
            </button>
            
            <div class="absolute top-4 right-4 z-50 bg-black/50 text-white rounded text-sm backdrop-blur-md border border-white/10 p-3">
                <h3 class="font-bold text-gray-300 border-b border-gray-600 mb-2 pb-1 text-xs uppercase tracking-wider">Commands</h3>
                <div class="flex items-center gap-2">
                    <kbd class="px-2 py-0.5 bg-gray-700 rounded border border-gray-600 font-mono text-xs shadow-sm">Enter</kbd>
                    <span class="text-xs text-gray-300">Strike Lightning</span>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    @keyframes fall {
        0% { transform: translateY(-10vh) translateX(0); }
        100% { transform: translateY(110vh) translateX(-20vw); }
    }
    .animate-fall {
        animation-name: fall;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }
    
    @keyframes drift {
        0% { transform: translateX(-10%) scale(var(--tw-scale-x, 1)); }
        100% { transform: translateX(110vw) scale(var(--tw-scale-x, 1)); }
    }
    .animate-drift {
        animation-name: drift;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }
    .animate-bolt {
        animation: bolt-flicker 0.15s steps(3) infinite;
        transform-origin: top center;
    }
    .animate-bolt-2 {
        animation: bolt-flicker 0.1s steps(4) infinite reverse;
        transform-origin: top center;
    }
    .animate-branch-1 {
        animation: branch-flicker 0.2s linear infinite;
    }
    .animate-branch-2 {
        animation: branch-flicker 0.25s linear infinite reverse;
    }

    @keyframes bolt-flicker {
        0% { opacity: 1; stroke-width: 4; transform: translateX(0); }
        33% { opacity: 0.6; stroke-width: 2; transform: translateX(2px); }
        66% { opacity: 0.9; stroke-width: 3; transform: translateX(-2px); }
        100% { opacity: 0.2; stroke-width: 1; transform: translateX(0); }
    }
    
    @keyframes branch-flicker {
        0% { opacity: 0; }
        20% { opacity: 0.8; }
        40% { opacity: 0; }
        60% { opacity: 0.6; }
        100% { opacity: 0; }
    }

    /* Remove old lightning animations */
    
    @keyframes flash {
        0% { opacity: 0; background-color: rgba(255,255,255,0); }
        2% { opacity: 1; background-color: rgba(200, 230, 255, 0.9); } /* Blue-white tint */
        4% { opacity: 0.8; }
        6% { opacity: 1; }
        10% { opacity: 0.1; }
        15% { opacity: 0.3; }
        30% { opacity: 0; }
        100% { opacity: 0; }
    }
    .animate-flash {
        animation: flash 0.6s ease-out forwards;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
        20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    .animate-shake {
        animation: shake 0.2s infinite;
    }
</style>
