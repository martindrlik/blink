<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="h-screen flex flex-col items-center justify-center">
	{#snippet a(route: string, label: string)}
		<a class="hover:text-pink-600 text-2xl" href={resolve(route)}>{label}</a>
	{/snippet}
	{@render a('/games/rock-paper-scissors', 'Hackable Rock Paper Scissors')}
	{@render a('/games/target', 'Frustrating Target')}
</div>
