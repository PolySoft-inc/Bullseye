import { pb } from '$lib/custom/pocketbase';
import { redirect } from '@sveltejs/kit';

export async function load() {
	await pb.authStore.loadFromCookie(''); // No-op in Capacitor, kept for consistency

	if (pb.authStore.isValid) {
		throw redirect(302, '/track');
	} else {
		throw redirect(302, '/auth');
	}
}
