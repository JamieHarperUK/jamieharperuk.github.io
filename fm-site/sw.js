self.addEventListener("push", (event) => {
	let payload = {
		title: "New Football Management post",
		body: "A new update is available.",
		icon: "data/fm_icon.png",
		badge: "data/fm_icon.png",
		data: {
			url: "#posts"
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

	const targetUrl = event.notification?.data?.url || "#posts";
	const finalUrl = new URL(targetUrl, self.location.origin).toString();

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
			for (const client of windowClients) {
				if (client.url.startsWith(self.location.origin)) {
					client.focus();
					client.navigate(finalUrl);
					return;
				}
			}
			return clients.openWindow(finalUrl);
		})
	);
});
