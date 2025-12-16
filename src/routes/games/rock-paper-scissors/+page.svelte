<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="w-96 mx-auto h-screen p-4">
	<div class="h-1/5"></div>
	<div class="h-3/5">
		<div class="flex justify-between">
			<h1 class="content-end font-bold">Hackable Rock-Paper-Scissors</h1>
			<div>
				<form method="POST" use:enhance>
					<button
						class="hover:border-blue-700 border border-blue-500 text-white font-bold py-2 px-4 rounded"
						formaction="?/reset">Reset</button
					>
				</form>
			</div>
		</div>
		<div class="flex flex-col my-16">
			<form method="POST" use:enhance>
				{#snippet headDiv(text: string, result: number)}
					<div class="w-1/2 px-4 py-2 border">
						{text} ({data.turns.filter((x: { result: number }) => x.result === result).length})
					</div>
				{/snippet}
				{#snippet div(value: string, isWinner: boolean)}
					<div class="w-1/2 px-4 py-2 border">
						{value}
						{#if isWinner}
							(won)
						{/if}
					</div>
				{/snippet}
				<div class="justify-between flex">
					{@render headDiv('Player 1', 1)}
					{@render headDiv('Player 2', 2)}
				</div>
				{#each data.turns as turn (turn)}
					<div class="justify-between flex">
						{@render div(turn.player1, turn.result === 1)}
						{@render div(turn.player2, turn.result === 2)}
					</div>
				{/each}
			</form>
		</div>
	</div>
	<div class="h-1/5">
		<form method="POST" use:enhance>
			{#snippet button(label: string, formaction: string)}
				<button
					class="hover:border-blue-700 border border-blue-500 text-white font-bold py-2 px-4 rounded w-1/3"
					{formaction}>{label}</button
				>
			{/snippet}
			<div class="flex justify-evenly gap-2">
				{@render button('Rock', '?/rock')}
				{@render button('Paper', '?/paper')}
				{@render button('Scissors', '?/scissors')}
			</div>
		</form>
	</div>
</div>
