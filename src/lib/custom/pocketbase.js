import PocketBase, { AsyncAuthStore } from "pocketbase";
import { Preferences } from "@capacitor/preferences";

const store = new AsyncAuthStore({
	save: async (data) => Preferences.set({ key: "pb_auth", value: data }),
	initial: Preferences.get({ key: "pb_auth" }).then((r) => r.value),
});

export const pb = new PocketBase("https://trackee.pockethost.io", store);
