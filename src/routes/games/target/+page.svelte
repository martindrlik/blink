<script lang="ts">
	import { onMount } from 'svelte';

	let container: HTMLDivElement;
	let target: HTMLDivElement;
	let frame: HTMLDivElement;
	let pos = vec();
	let newTargetPos = vec();
	let usableWidth: number;
	let usableHeight: number;
	let inFrameTime = $state(0);
	let score = $state(0);

	onMount(() => {
		resetWidthAndHeight();
		let rid = requestAnimationFrame(function update() {
			rid = requestAnimationFrame(update);
			const x = pos.x - newTargetPos.x;
			const y = pos.y - newTargetPos.y;
			const increment = function (d: number) {
				if (d > 0) return -1;
				if (d < 0) return 1;
				return 0;
			};
			pos.x += increment(x);
			pos.y += increment(y);

			if (Math.abs(x) <= 5 && Math.abs(y) <= 5) {
				// TODO target stucks
				const arr = new Uint32Array(2);
				crypto.getRandomValues(arr);
				newTargetPos = vec(arr[0] % usableWidth, arr[1] % usableHeight);
			}

			handleTargetVsFrame();

			target.style = `left: ${pos.x}px; top: ${pos.y}px`;
		});
		return () => cancelAnimationFrame(rid);
	});

	const handleTargetVsFrame = () => {
		const frameRect = frame.getBoundingClientRect();
		const targetRect = target.getBoundingClientRect();
		if (
			frameRect.left <= targetRect.left &&
			frameRect.right >= targetRect.right &&
			frameRect.top <= targetRect.top &&
			frameRect.bottom >= targetRect.bottom
		) {
			inFrameTime += 1;
		} else {
			if (inFrameTime > score) score = inFrameTime;
			inFrameTime = 0;
		}
	};

	const resetWidthAndHeight = () => {
		const containerRect = container.getBoundingClientRect();
		const targetRect = target.getBoundingClientRect();
		usableWidth = containerRect.width - targetRect.width;
		usableHeight = containerRect.height - targetRect.height;
	};

	const mouseMove = (ev: MouseEvent) => {
		setFramePosition(ev.clientX, ev.clientY);
	};

	const touchMove = (ev: TouchEvent) => {
		setFramePosition(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY);
	};

	function setFramePosition(clientX: number, clientY: number) {
		const frameRect = frame.getBoundingClientRect();
		const x = clientX - frameRect.width / 2;
		const y = clientY - frameRect.height / 2;
		frame.style = `left: ${x}px; top: ${y}px`;
	}

	function vec(x: number = 0, y: number = 0) {
		return { x, y };
	}
</script>

<svelte:window on:resize={resetWidthAndHeight} on:mousemove={mouseMove} on:touchmove={touchMove} />

<div
	class="w-screen h-screen flex items-center justify-center cursor-none flex-col"
	bind:this={container}
>
	{#if inFrameTime === 0}
		<div class="text-xl">Try to keep the target inside the frame.</div>
	{:else}
		<div class="text-9xl text-gray-700">{inFrameTime}</div>
	{/if}
	{#if inFrameTime === 0 && score !== 0}
		<div class="text-xl">Your best score: {score}.</div>
	{/if}
	<div class="size-8 absolute bg-white left-0 top-0" bind:this={target}></div>
	<div class="size-32 border-white border-4 absolute" bind:this={frame}></div>
</div>
