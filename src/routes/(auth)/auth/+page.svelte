<script>
	import { Button } from "$lib/components/ui/button/index.js";
	import Logo from "$lib/assets/logo.svelte";
</script>

<div class="h-dvh">
	<enhanced:img src="./archer.jpg" alt="An alt text" class="absolute -z-10 h-full object-cover" />
	<div class="flex h-full flex-col">
		<header class="pt-safe"></header>
		<div class="text-primary flex items-center justify-center gap-3 p-10 pt-32 text-5xl">
			<Logo class="fill-primary size-20 " />
		</div>
		<div class="h-full"></div>
		<Button href="/track" class="mx-8 p-7 text-lg ">Create Account</Button>
		<Button href="/login" variant="secondary" class=" mx-8 mt-2 mb-8 p-7 text-lg">Log In</Button>

		<footer class="pb-safe"></footer>
	</div>
</div>
