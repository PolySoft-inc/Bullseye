<script>
	import { pb } from '$lib/custom/pocketbase';
	import { goto } from '$app/navigation';
	import { zod } from 'sveltekit-superforms/adapters';
	import { z } from 'zod';

	import { superForm, defaults } from 'sveltekit-superforms';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ChevronLeft, LoaderCircle } from 'lucide-svelte';

	const formSchema = z.object({
		email: z.string().email(),
		password: z
			.string()
			.min(8, { message: 'Must be 8 or more characters long' })
			.max(50, { message: 'Must be 50 characters or less' })
	});

	const form = superForm(defaults(zod(formSchema)), {
		SPA: true,
		validators: zod(formSchema),
		resetForm: false
	});

	const { form: formData, enhance, validateForm, errors } = form;

	let loading = false;
	let authError = '';

	async function handleSubmit(event) {
		event.preventDefault();
		authError = '';
		const result = await validateForm();

		if (!result.valid) {
			errors.update((v) => ({
				...v,
				email: result.errors.email,
				password: result.errors.password
			}));
			return;
		}

		loading = true;

		try {
			await pb.collection('users').authWithPassword($formData.email, $formData.password);

			const userId = pb.authStore.model?.id;
			if (!userId) throw new Error('User ID not found');

			await goto('/train');
		} catch (err) {
			console.error('Login error or fetch failed:', err);
			authError = 'Invalid email, password, or failed to fetch.';
		} finally {
			loading = false;
		}
	}
</script>

<a href="./" class="absolute">
	<ChevronLeft class="mt-16 ml-4 text-2xl underline" size="24" />
</a>

<form
	method="POST"
	use:enhance
	onsubmit={handleSubmit}
	class="pb-safe pt-safe flex h-dvh flex-col px-8"
>
	<Form.Field {form} name="email" class="mb-2">
		<Form.Control>
			{#snippet children({ props })}
				<div class="my-14 text-3xl font-bold">Log into your account</div>
				<Input class="p-7" placeholder="email" {...props} bind:value={$formData.email} />
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Field {form} name="password">
		<Form.Control>
			{#snippet children({ props })}
				<Input
					class="p-7"
					placeholder="password"
					{...props}
					type="password"
					bind:value={$formData.password}
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	{#if authError}
		<div class="text-red-500">{authError}</div>
	{/if}

	<div class="grow"></div>
	<Form.Button class="mb-4 w-full p-7 text-lg"
		>{#if loading}
			<LoaderCircle class="size-6 animate-spin" />
		{:else}
			Log In
		{/if}</Form.Button
	>
</form>
