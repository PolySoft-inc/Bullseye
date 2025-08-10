import { pb } from '$lib/custom/pocketbase';
import { redirect } from '@sveltejs/kit';

export async function load() {
	if (!pb.authStore.isValid) {
		console.log('User is not authenticated, redirecting to /auth');
		throw redirect(302, '/auth');
	}
}
