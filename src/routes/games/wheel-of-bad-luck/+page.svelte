<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let names: string[] = [];
    let characterProps: { 
        skinTone: string, 
        shirtColor: string, 
        pantsColor: string, 
        hairColor: string, 
        hairStyle: number,
        height: number,
        waveType: number, // 0: none, 1: both, 2: left, 3: right
        waveDelay: number,
        waveDuration: number
    }[] = [];
    
    let newName = '';
    
    const skinTones = ['#f8d9ce', '#f0c0b0', '#e0ac9a', '#c68674', '#8d5524', '#523424'];
    const shirtColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#334155', '#475569', '#94a3b8'];
    const pantsColors = ['#1e293b', '#334155', '#475569', '#422006', '#292524', '#262626', '#1e1b4b', '#1e3a8a'];
    const hairColors = ['#09090b', '#27272a', '#3f3f46', '#451a03', '#713f12', '#a16207', '#d97706', '#fcd34d', '#fef3c7', '#e5e7eb', '#9ca3af'];

    function getRandomProp(arr: any[]) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    let snowflakes: { x: number; y: number; size: number; duration: number; delay: number }[] = [];
    let clouds: { x: number; y: number; scale: number; opacity: number; duration: number }[] = [];
    let stars: { x: number; y: number; size: number; opacity: number }[] = [];
    let gameState: 'input' | 'playing' = 'input';
    let lightning: { x: number, active: boolean, path: string } = { x: 0, active: false, path: '' };
    let struckIndex: number | null = null;
    let deadIndices: Set<number> = new Set();
    let isDancing = false;
    let showWorkBubble = false;
    let workBubbleIndex = -1;
    
    // Remove duplicate generateBoltPath function if it exists here
    
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
                
                // Check if everyone is dead
                if (deadIndices.size === names.length) {
                    setTimeout(() => {
                        isDancing = true;
                        
                        // After dancing for a bit, show the "Let's work" bubble
                        setTimeout(() => {
                            workBubbleIndex = Math.floor(Math.random() * names.length);
                            showWorkBubble = true;
                            
                            // Then transition back to input
                            setTimeout(() => {
                                gameState = 'input';
                                showWorkBubble = false;
                                isDancing = false;
                            }, 2000);
                        }, 3000); // Dance for 3 seconds first
                    }, 500); // Slight delay before dancing starts
                }
            }
            struckIndex = null;
        }, duration); 
    }

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

    function addName() {
        if (newName.trim()) {
            names = [...names, newName.trim()];
            characterProps = [...characterProps, {
                skinTone: getRandomProp(skinTones),
                shirtColor: getRandomProp(shirtColors),
                pantsColor: getRandomProp(pantsColors),
                hairColor: getRandomProp(hairColors),
                hairStyle: Math.floor(Math.random() * 4), // 0-3 styles
                height: 0.9 + Math.random() * 0.2, // 0.9 - 1.1 scale variation
                waveType: Math.floor(Math.random() * 3) + 1, // Always wave (types 1-3)
                waveDelay: Math.random() * 2, // 0-2s delay
                waveDuration: 0.3 + Math.random() * 0.5 // Faster 0.3-0.8s duration for chaos
            }];
            newName = '';
        }
    }

    function removeName(index: number) {
        names = names.filter((_, i) => i !== index);
        characterProps = characterProps.filter((_, i) => i !== index);
    }

    function startGame() {
        if (names.length > 0) {
            // Ensure props exist for all names (legacy/HMR fix)
            while (characterProps.length < names.length) {
                characterProps.push({
                    skinTone: getRandomProp(skinTones),
                    shirtColor: getRandomProp(shirtColors),
                    pantsColor: getRandomProp(pantsColors),
                    hairColor: getRandomProp(hairColors),
                    hairStyle: Math.floor(Math.random() * 4),
                    height: 0.9 + Math.random() * 0.2,
                    waveType: Math.floor(Math.random() * 3) + 1, // Always wave
                    waveDelay: Math.random() * 2,
                    waveDuration: 0.3 + Math.random() * 0.5 // Faster
                });
            }
            
            deadIndices = new Set();
            isDancing = false;
            showWorkBubble = false;
            workBubbleIndex = -1;
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

            <!-- Layer 3: Trees (Removed) -->
            
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
                    {@const defaultProps = {
                        skinTone: '#f0c0b0',
                        shirtColor: '#3b82f6',
                        pantsColor: '#1e293b',
                        hairColor: '#451a03',
                        hairStyle: 0,
                        height: 1,
                        waveType: 1,
                        waveDelay: 0,
                        waveDuration: 0.5
                    }}
                    {@const props = characterProps[i] || defaultProps}
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
                        <div 
                            class="relative w-12 h-32 transition-all duration-75 {lightning.active && struckIndex === i ? 'animate-shake' : ''}"
                            style="transform: scale({props.height})"
                        >
                             <!-- Normal Appearance -->
                             <div class="{(lightning.active && struckIndex === i) || deadIndices.has(i) ? 'opacity-0' : 'opacity-100'} transition-opacity duration-100">
                                 <!-- Head -->
                                <div class="w-10 h-10 rounded-full absolute top-0 left-1 border border-black/30 z-10 shadow-sm" style="background-color: {props.skinTone}"></div>
                                
                                <!-- Hair -->
                                {#if props.hairStyle === 0} <!-- Short -->
                                    <div class="w-10 h-4 rounded-t-full absolute top-0 left-1 z-20" style="background-color: {props.hairColor}"></div>
                                {:else if props.hairStyle === 1} <!-- Long/Side -->
                                    <div class="w-11 h-8 rounded-t-full rounded-br-xl absolute -top-0.5 left-0.5 z-20" style="background-color: {props.hairColor}"></div>
                                {:else if props.hairStyle === 2} <!-- Spiky/Messy -->
                                    <div class="w-11 h-5 rounded-t-md absolute -top-1 left-0.5 z-20" style="background-color: {props.hairColor}; clip-path: polygon(0% 100%, 10% 0%, 20% 60%, 30% 0%, 40% 50%, 50% 0%, 60% 50%, 70% 0%, 80% 60%, 90% 0%, 100% 100%);"></div>
                                {:else} <!-- Bun -->
                                    <div class="w-10 h-5 rounded-t-full absolute top-0 left-1 z-20" style="background-color: {props.hairColor}"></div>
                                    <div class="w-4 h-4 rounded-full absolute -top-2 left-4 z-10" style="background-color: {props.hairColor}"></div>
                                {/if}

                                <!-- Body/Shirt -->
                                <div class="w-12 h-16 absolute top-9 rounded-t-lg border border-black/30 z-0 shadow-inner" style="background-color: {props.shirtColor}">
                                    <!-- Neck -->
                                    <div class="w-4 h-2 absolute -top-1 left-4 rounded-b-md opacity-20 bg-black"></div> 
                                </div>
                                
                                 <!-- Legs/Pants (Longer for standing) -->
                                <div class="w-4 h-14 absolute top-24 left-1 border-x border-black/20" style="background-color: {props.pantsColor}"></div>
                                <div class="w-4 h-14 absolute top-24 right-1 border-x border-black/20" style="background-color: {props.pantsColor}"></div>
                                
                                <!-- Shoes -->
                                <div class="w-5 h-2 bg-stone-900 absolute top-[150px] left-0.5 rounded-full"></div>
                                <div class="w-5 h-2 bg-stone-900 absolute top-[150px] right-0.5 rounded-full"></div>

                                 <!-- Arms (Longer) -->
                                 <div class="w-3 h-16 absolute top-10 -left-2 rotate-6 rounded-full border border-black/20 shadow-sm" style="background-color: {props.skinTone}">
                                     <!-- Sleeve -->
                                     <div class="w-full h-5 absolute top-0 rounded-t-full" style="background-color: {props.shirtColor}"></div>
                                 </div>
                                 <div class="w-3 h-16 absolute top-10 -right-2 -rotate-6 rounded-full border border-black/20 shadow-sm" style="background-color: {props.skinTone}">
                                     <!-- Sleeve -->
                                     <div class="w-full h-5 absolute top-0 rounded-t-full" style="background-color: {props.shirtColor}"></div>
                                 </div>
                             </div>

                             <!-- Skeleton Appearance (X-Ray Effect) - Adjusted for height -->
                             <div 
                                class="absolute inset-0 {(lightning.active && struckIndex === i) || deadIndices.has(i) ? 'opacity-100' : 'opacity-0'} {isDancing ? 'animate-skeleton-dance' : ''} transition-opacity duration-75 z-20 pointer-events-none"
                                style="animation-delay: {props.waveDelay}s"
                             >
                                <!-- Skull -->
                                <div class="w-8 h-9 bg-white rounded-full absolute top-0 left-2 border border-slate-300">
                                    <div class="w-2 h-2 bg-black rounded-full absolute top-2.5 left-1.5"></div>
                                    <div class="w-2 h-2 bg-black rounded-full absolute top-2.5 right-1.5"></div>
                                    <div class="w-3 h-1.5 bg-black rounded-full absolute bottom-2 left-2.5"></div>
                                </div>
                                <!-- Spine -->
                                <div class="w-2 h-16 bg-white absolute top-9 left-[20px] border border-slate-300 flex flex-col justify-between py-1">
                                    {#each Array(7) as _} <div class="w-4 h-0.5 bg-slate-300 -ml-1"></div> {/each}
                                </div>
                                <!-- Ribs -->
                                <div class="w-8 h-10 border-2 border-white rounded-full absolute top-10 left-2 opacity-80"></div>
                                <div class="w-6 h-8 border-2 border-white rounded-full absolute top-12 left-3 opacity-80"></div>
                                <!-- Pelvis -->
                                <div class="w-8 h-5 bg-white absolute top-[72px] left-2 rounded-b-lg border border-slate-300"></div>
                                <!-- Leg Bones (Longer) -->
                                <div class="w-1.5 h-14 bg-white absolute top-[90px] left-2.5 border border-slate-300"></div>
                                <div class="w-1.5 h-14 bg-white absolute top-[90px] right-2.5 border border-slate-300"></div>
                                <!-- Arm Bones (Longer) -->
                                <div 
                                    class="w-1.5 h-16 bg-white absolute top-11 -left-1 rotate-6 border border-slate-300 origin-top {isDancing ? 'animate-wave-left' : ''}"
                                    style="animation-delay: {props.waveDelay}s; animation-duration: {props.waveDuration}s"
                                ></div>
                                <div 
                                    class="w-1.5 h-16 bg-white absolute top-11 -right-1 -rotate-6 border border-slate-300 origin-top {isDancing ? 'animate-wave-right' : ''}"
                                    style="animation-delay: {props.waveDelay + (Math.random() * 0.5)}s; animation-duration: {props.waveDuration * (0.8 + Math.random() * 0.4)}s"
                                ></div>
                             </div>
                        </div>
                        
                        <!-- Name Tag -->
                        <div class="absolute -bottom-8 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 z-30">
                            {name}
                        </div>
                        
                        <!-- "Let's work" Bubble -->
                        {#if showWorkBubble && workBubbleIndex === i}
                            <div class="absolute -top-24 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap z-50 animate-pop-in shadow-lg border-2 border-gray-200">
                                Let's work! 💼
                                <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-b-2 border-r-2 border-gray-200"></div>
                            </div>
                        {/if}
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

    @keyframes skeleton-dance {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-8px) rotate(-3deg); }
        50% { transform: translateY(0) rotate(0deg); }
        75% { transform: translateY(-8px) rotate(3deg); }
    }
    .animate-skeleton-dance {
        animation: skeleton-dance 1s ease-in-out infinite;
    }

    @keyframes wave-left {
        0%, 100% { transform: rotate(6deg); }
        50% { transform: rotate(140deg); }
    }
    .animate-wave-left {
        animation: wave-left 0.5s ease-in-out infinite;
    }

    @keyframes wave-right {
        0%, 100% { transform: rotate(-6deg); }
        50% { transform: rotate(-140deg); }
    }
    .animate-wave-right {
        animation: wave-right 0.5s ease-in-out infinite;
    }
    
    @keyframes pop-in {
        0% { transform: translate(-50%, 20px) scale(0); opacity: 0; }
        60% { transform: translate(-50%, -10px) scale(1.1); opacity: 1; }
        100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
    }
    .animate-pop-in {
        animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
</style>
