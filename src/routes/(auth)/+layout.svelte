<script>
	let { children, data } = $props();
	import PageTransition from '$lib/custom/PageTransition.svelte';
</script>

<PageTransition refresh={data.url}>
	{@render children?.()}
</PageTransition>
