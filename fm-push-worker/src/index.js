import webpush from "web-push";

const DEFAULT_SITE_ID = "fm";

function withTrailingSlash(url) {
	return String(url || "").replace(/\/+$/, "") + "/";
}

function getSiteBaseUrl(env) {
	const configured = String(env.SITE_BASE_URL || "").trim();
	return withTrailingSlash(configured || "https://jhuk.co.uk/fm/");
}

function getSiteIconUrl(env) {
	const configured = String(env.SITE_ICON_URL || "").trim();
	if (configured) {
		return configured;
	}
	return new URL("data/fm_icon.png", getSiteBaseUrl(env)).toString();
}

function jsonResponse(status, payload, extraHeaders = {}) {
	return new Response(JSON.stringify(payload, null, 2), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...extraHeaders
		}
	});
}

function getCorsHeaders(request, env) {
	const origin = request.headers.get("Origin") || "";
	const allowedOrigin = String(env.ALLOWED_ORIGIN || "*").trim() || "*";
	const allowOriginHeader = allowedOrigin === "*" ? "*" : origin === allowedOrigin ? origin : "null";

	return {
		"Access-Control-Allow-Origin": allowOriginHeader,
		"Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400"
	};
}

function verifyNotifyAuth(request, env) {
	const expected = String(env.NOTIFY_BEARER_TOKEN || "").trim();
	if (!expected) {
		return false;
	}

	const header = request.headers.get("Authorization") || "";
	const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
	return token.length > 0 && token === expected;
}

function buildVapid(env) {
	const subject = String(env.VAPID_SUBJECT || "").trim();
	const publicKey = String(env.VAPID_PUBLIC_KEY || "").trim();
	const privateKey = String(env.VAPID_PRIVATE_KEY || "").trim();

	if (!subject || !publicKey || !privateKey) {
		throw new Error("Missing VAPID secrets. Configure VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.");
	}

	webpush.setVapidDetails(subject, publicKey, privateKey);
	return { subject, publicKey, privateKey };
}

async function readJson(request) {
	try {
		return await request.json();
	} catch (_error) {
		throw new Error("Request body must be valid JSON.");
	}
}

function ensureSubscriptionShape(subscription) {
	if (!subscription || typeof subscription !== "object") {
		throw new Error("subscription must be an object.");
	}

	if (!subscription.endpoint || typeof subscription.endpoint !== "string") {
		throw new Error("subscription.endpoint is required.");
	}

	if (!subscription.keys || typeof subscription.keys !== "object") {
		throw new Error("subscription.keys is required.");
	}

	if (!subscription.keys.p256dh || !subscription.keys.auth) {
		throw new Error("subscription.keys.p256dh and subscription.keys.auth are required.");
	}
}

function normalizeSiteId(raw) {
	const value = String(raw || DEFAULT_SITE_ID).trim();
	return value || DEFAULT_SITE_ID;
}

async function digestHex(input) {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function subscriptionKey(siteId, endpoint) {
	const hash = await digestHex(endpoint);
	return "sub:" + siteId + ":" + hash;
}

async function listSubscriptionKeys(env, siteId) {
	const prefix = "sub:" + siteId + ":";
	const keys = [];
	let cursor = undefined;

	while (true) {
		const page = await env.SUBSCRIPTIONS.list({ prefix, cursor, limit: 1000 });
		for (const key of page.keys || []) {
			keys.push(key.name);
		}
		if (!page.list_complete) {
			cursor = page.cursor;
			continue;
		}
		break;
	}

	return keys;
}

async function getSubscriptionRecords(env, siteId) {
	const keys = await listSubscriptionKeys(env, siteId);
	const records = [];

	for (const keyName of keys) {
		const value = await env.SUBSCRIPTIONS.get(keyName, "json");
		if (value && value.subscription) {
			records.push({ keyName, record: value });
		}
	}

	return records;
}

function makePostSlug(latestPost) {
	const title = String(latestPost?.title || "post");
	const date = String(latestPost?.date || "");
	const time = String(latestPost?.time || "");
	const seed = (title + "-" + date + "-" + time).toLowerCase();

	const slug = seed
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "post";
}

function buildPostNotifyPayload(body, siteId, env) {
	const latestPost = body.latestPost && typeof body.latestPost === "object" ? body.latestPost : {};
	const slug = makePostSlug(latestPost);
	const siteBaseUrl = getSiteBaseUrl(env);
	const iconUrl = getSiteIconUrl(env);

	const title = latestPost.title
		? "New post: " + String(latestPost.title)
		: "New Football Management post";

	const category = String(latestPost.category || "Update");
	const content = String(latestPost.content || "").replace(/\s+/g, " ").trim();
	const shortBody = content.length > 140 ? content.slice(0, 137) + "..." : content;

	return {
		title,
		body: shortBody || category,
		icon: iconUrl,
		badge: iconUrl,
		data: {
			siteId,
			url: siteBaseUrl + "#post/" + slug,
			category,
			commitSha: String(body.commitSha || "")
		}
	};
}

function buildGamesNotifyPayload(body, siteId, env) {
	const latestResult = body.latestResult && typeof body.latestResult === "object" ? body.latestResult : {};
	const siteBaseUrl = getSiteBaseUrl(env);
	const iconUrl = getSiteIconUrl(env);
	const homeTeam = String(latestResult.homeTeam || "Home").trim();
	const awayTeam = String(latestResult.awayTeam || "Away").trim();
	const homeScore = String(latestResult.homeScore ?? "").trim();
	const awayScore = String(latestResult.awayScore ?? "").trim();
	const winner = String(latestResult.winner || "").trim();
	const competition = String(latestResult.competition || "").trim();
	const date = String(latestResult.date || "").trim();
	const time = String(latestResult.time || "").trim();

	const hasScore = homeScore !== "" && awayScore !== "";
	const fixtureText = homeTeam + " vs " + awayTeam;
	const scoreText = hasScore ? homeScore + "-" + awayScore : "Result";
	const title = fixtureText + " " + scoreText;

	const bodyParts = [];
	if (winner) {
		if (/^draw$/i.test(winner)) {
			bodyParts.push("Result: Draw");
		} else {
			bodyParts.push("Winner: " + winner);
		}
	}
	if (competition) {
		bodyParts.push(competition);
	}
	if (date) {
		bodyParts.push(date + (time ? " " + time : ""));
	}

	const fallbackSlug = String(latestResult.winnerTeamSlug || "").trim();
	const fallbackUrl = fallbackSlug ? siteBaseUrl + "#team/" + fallbackSlug : siteBaseUrl;
	const requestedUrl = String(body.notificationUrl || latestResult.winnerTeamUrl || "").trim();

	return {
		title,
		body: bodyParts.join(" · ") || "Latest result update",
		icon: iconUrl,
		badge: iconUrl,
		data: {
			siteId,
			url: requestedUrl || fallbackUrl,
			category: "Result",
			commitSha: String(body.commitSha || "")
		}
	};
}

function buildNotifyPayload(body, siteId, env) {
	const kind = String(body.kind || "posts").trim().toLowerCase();
	if (kind === "games") {
		return buildGamesNotifyPayload(body, siteId, env);
	}

	return buildPostNotifyPayload(body, siteId, env);
}

async function writeLastNotifyState(env, siteId, body, sentCount) {
	await env.STATE.put(
		"state:lastNotify:" + siteId,
		JSON.stringify(
			{
				timestamp: new Date().toISOString(),
				repo: String(body.repo || ""),
				path: String(body.path || ""),
				commitSha: String(body.commitSha || ""),
				sentCount
			},
			null,
			2
		)
	);
}

async function handleSubscribe(request, env) {
	const body = await readJson(request);
	const siteId = normalizeSiteId(body.siteId);
	const subscription = body.subscription;

	ensureSubscriptionShape(subscription);

	const keyName = await subscriptionKey(siteId, subscription.endpoint);
	await env.SUBSCRIPTIONS.put(
		keyName,
		JSON.stringify(
			{
				siteId,
				subscription,
				createdAt: new Date().toISOString()
			},
			null,
			2
		)
	);

	return jsonResponse(200, {
		ok: true,
		siteId,
		key: keyName
	});
}

async function handleUnsubscribe(request, env) {
	const body = await readJson(request);
	const siteId = normalizeSiteId(body.siteId);
	const endpoint = String(body.endpoint || body.subscription?.endpoint || "").trim();

	if (!endpoint) {
		throw new Error("endpoint is required for unsubscribe.");
	}

	const keyName = await subscriptionKey(siteId, endpoint);
	await env.SUBSCRIPTIONS.delete(keyName);

	return jsonResponse(200, {
		ok: true,
		siteId,
		key: keyName
	});
}

async function handleNotify(request, env) {
	if (!verifyNotifyAuth(request, env)) {
		return jsonResponse(401, { ok: false, error: "Unauthorized" });
	}

	buildVapid(env);
	const body = await readJson(request);
	const siteId = normalizeSiteId(body.siteId);
	const messagePayload = buildNotifyPayload(body, siteId, env);
	const payloadText = JSON.stringify(messagePayload);

	const records = await getSubscriptionRecords(env, siteId);
	let sent = 0;
	let failed = 0;
	let removed = 0;

	for (const item of records) {
		try {
			await webpush.sendNotification(item.record.subscription, payloadText, {
				TTL: 60,
				urgency: "high"
			});
			sent += 1;
		} catch (error) {
			failed += 1;
			const statusCode = Number(error?.statusCode || 0);
			if (statusCode === 404 || statusCode === 410) {
				await env.SUBSCRIPTIONS.delete(item.keyName);
				removed += 1;
			}
		}
	}

	await writeLastNotifyState(env, siteId, body, sent);

	return jsonResponse(200, {
		ok: true,
		siteId,
		totalSubscriptions: records.length,
		sent,
		failed,
		removed
	});
}

async function handleList(request, env) {
	if (!verifyNotifyAuth(request, env)) {
		return jsonResponse(401, { ok: false, error: "Unauthorized" });
	}

	const url = new URL(request.url);
	const siteId = normalizeSiteId(url.searchParams.get("siteId"));
	const keys = await listSubscriptionKeys(env, siteId);

	return jsonResponse(200, {
		ok: true,
		siteId,
		count: keys.length,
		keys
	});
}

async function handleDeleteOneSubscription(request, env) {
	if (!verifyNotifyAuth(request, env)) {
		return jsonResponse(401, { ok: false, error: "Unauthorized" });
	}

	const body = await readJson(request);
	const siteId = normalizeSiteId(body.siteId);
	const keyName = String(body.keyName || "").trim();
	const endpoint = String(body.endpoint || "").trim();

	let resolvedKeyName = keyName;
	if (!resolvedKeyName && endpoint) {
		resolvedKeyName = await subscriptionKey(siteId, endpoint);
	}

	if (!resolvedKeyName) {
		throw new Error("keyName or endpoint is required.");
	}

	await env.SUBSCRIPTIONS.delete(resolvedKeyName);

	return jsonResponse(200, {
		ok: true,
		siteId,
		deleted: 1,
		keyName: resolvedKeyName
	});
}

async function handleDeleteAllSubscriptions(request, env) {
	if (!verifyNotifyAuth(request, env)) {
		return jsonResponse(401, { ok: false, error: "Unauthorized" });
	}

	const url = new URL(request.url);
	const siteId = normalizeSiteId(url.searchParams.get("siteId"));
	const keys = await listSubscriptionKeys(env, siteId);

	for (const keyName of keys) {
		await env.SUBSCRIPTIONS.delete(keyName);
	}

	return jsonResponse(200, {
		ok: true,
		siteId,
		deleted: keys.length
	});
}

export default {
	async fetch(request, env) {
		const corsHeaders = getCorsHeaders(request, env);
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const url = new URL(request.url);

		try {
			if (request.method === "GET" && url.pathname === "/health") {
				return jsonResponse(200, { ok: true, service: "fm-push-worker" }, corsHeaders);
			}

			if (request.method === "GET" && url.pathname === "/vapid-public-key") {
				const vapid = buildVapid(env);
				return jsonResponse(200, { ok: true, publicKey: vapid.publicKey }, corsHeaders);
			}

			if (request.method === "POST" && url.pathname === "/subscribe") {
				const response = await handleSubscribe(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			if (request.method === "POST" && url.pathname === "/unsubscribe") {
				const response = await handleUnsubscribe(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			if (request.method === "POST" && url.pathname === "/notify") {
				const response = await handleNotify(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			if (request.method === "GET" && url.pathname === "/subscriptions") {
				const response = await handleList(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			if (request.method === "POST" && url.pathname === "/subscriptions/delete") {
				const response = await handleDeleteOneSubscription(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			if (request.method === "DELETE" && url.pathname === "/subscriptions") {
				const response = await handleDeleteAllSubscriptions(request, env);
				response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
				return response;
			}

			return jsonResponse(404, { ok: false, error: "Not found" }, corsHeaders);
		} catch (error) {
			return jsonResponse(400, { ok: false, error: error instanceof Error ? error.message : "Unknown error" }, corsHeaders);
		}
	}
};
