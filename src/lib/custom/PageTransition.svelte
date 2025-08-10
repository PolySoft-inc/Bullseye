<script>
	import { navigating } from '$app/stores';
	import { fly } from 'svelte/transition';

	export let refresh;

	let xOut = -50;
	let xIn = 50;

	let from = $navigating?.from.route.id;
	let to = refresh;

	if (from && to) {
		let fromCount = from == '/' ? 0 : (from.match(/\//g) || []).length;
		let toCount = to == '/' ? 0 : (to.match(/\//g) || []).length;

		if (fromCount > toCount) {
			xOut = 50;
			xIn = -50;
		} else {
			xOut = -50;
			xIn = 50;
		}
	}

	// The intention here is to fade out the old page and fade in the new one.

	// Also, we want to make sure that the scroll isn't visible during the transition,

	// because this could cause a flicker effect.
</script>

{#key refresh}
	<div
		on:introstart={() => (document.body.style.overflow = 'hidden')}
		out:fly={{ x: xOut, duration: 300 }}
		in:fly={{ x: xIn, duration: 300, delay: 300 }}
		on:outroend={() => setTimeout(() => (document.body.style.overflow = 'auto'), 300)}
	>
		<slot />
	</div>
{/key}
