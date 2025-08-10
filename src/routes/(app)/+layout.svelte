<script>
	import { Camera, Calendar, UserRound } from "lucide-svelte";
	import { page } from "$app/stores";
	import { derived } from "svelte/store";
	import { pb } from "$lib/custom/pocketbase";
	import { onMount } from "svelte";
	let { children } = $props();

	const currPage = derived(page, ($page) => $page.url.pathname.split("/")[1] || "map");

	const navItems = [
		{ name: "train", icon: Camera },
		{ name: "history", icon: Calendar },
		{ name: "account", icon: UserRound },
	];
</script>

<div class="flex h-dvh flex-col">
	{@render children?.()}

	<footer class="pb-safe flex justify-between pt-4">
		{#each navItems as { name, icon: Icon } (name)}
			{#await $currPage}
				<div class="flex flex-1 flex-col items-center opacity-50">
					<Icon class="mb-1 size-6" />
					<div class="text-xs capitalize">{name}</div>
				</div>
			{:then current}
				<a href="/{name}" class="flex flex-1 flex-col items-center transition-opacity duration-300 {current === name ? '' : 'opacity-50'}">
					<Icon class="{current === name ? 'stroke-primary' : ''} mb-1 size-6" />
					<div class="text-xs capitalize">{name}</div>
				</a>
			{/await}
		{/each}
	</footer>
</div>
