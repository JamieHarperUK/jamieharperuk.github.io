self.addEventListener("push", (event) => {
	let payload = {
		title: "New Club Update",
		body: "A new club announcement is available.",
		icon: "https://example.com/fc-template/data/fm_icon.png",
		badge: "https://example.com/fc-template/data/fm_icon.png",
		data: {
			url: "https://example.com/fc-template/#posts"
		}
	};

	if (event.data) {
		try {
			const parsed = event.data.json();
			payload = {
				...payload,
				...parsed,
				data: {
					...payload.data,
					...(parsed.data || {})
				}
			};
		} catch (_error) {
			const text = event.data.text();
			payload.body = text || payload.body;
		}
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: payload.icon,
			badge: payload.badge,
			data: payload.data
		})
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const targetUrl = event.notification?.data?.url || "https://example.com/fc-template/#posts";

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
			for (const client of windowClients) {
				if (client.url.includes("/fc-template/")) {
					client.focus();
					client.navigate(targetUrl);
					return;
				}
			}
			return clients.openWindow(targetUrl);
		})
	);
});
