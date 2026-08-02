export default {
	async fetch(request, env) {
		const requestUrl = new URL(request.url);

		if (requestUrl.pathname === "/health") {
			return new Response("ok", { status: 200 });
		}

		if (!requestUrl.pathname.startsWith("/post/")) {
			return new Response("Not found", { status: 404 });
		}

		const slug = decodeURIComponent(requestUrl.pathname.slice("/post/".length)).trim();
		if (!slug) {
			return new Response("Missing post slug", { status: 400 });
		}
		
		try {
			const posts = await loadPosts(String(env.POSTS_JSON_URL || ""));
			const post = findPostBySlug(posts, slug);

			const siteTitle = String(env.SITE_TITLE || "Site");
			const siteDescription = String(env.SITE_DESCRIPTION || "");
			const defaultImage = String(env.SITE_DEFAULT_IMAGE || "");
			const spaBase = String(env.SITE_SPA_URL || "https://jamieharperuk.github.io/fm/").replace(/\/+$/, "/");
			const redirectUrl = `${spaBase}#post/${encodeURIComponent(slug)}`;

			if (!post) {
				const html = renderHtml({
					title: `Post Not Found | ${siteTitle}`,
					description: siteDescription || "Post not found.",
					image: defaultImage,
					canonicalUrl: requestUrl.toString(),
					redirectUrl
				});
				return htmlResponse(html, 404);
			}

			const title = String(post.title || "Post");
			const description = getPostDescription(post.content, siteDescription);
			const image = resolvePostImage(post.image, defaultImage);

			const html = renderHtml({
				title: `${title} | ${siteTitle}`,
				description,
				image,
				canonicalUrl: requestUrl.toString(),
				redirectUrl
			});

			return htmlResponse(html, 200);
		} catch (error) {
			const html = renderHtml({
				title: "Share page unavailable",
				description: "Unable to build share metadata right now.",
				image: String(env.SITE_DEFAULT_IMAGE || ""),
				canonicalUrl: requestUrl.toString(),
				redirectUrl: String(env.SITE_SPA_URL || "https://jamieharperuk.github.io/fm/")
			});
			return htmlResponse(html, 500, error instanceof Error ? error.message : "Unknown error");
		}
	},
};

async function loadPosts(postsJsonUrl) {
	if (!postsJsonUrl) {
		throw new Error("POSTS_JSON_URL is not configured.");
	}

	const res = await fetch(postsJsonUrl, {
		cf: {
			cacheEverything: true,
			cacheTtl: 120,
		},
	});

	if (!res.ok) {
		throw new Error(`Posts JSON fetch failed: ${res.status}`);
	}

	const payload = await res.json();
	return Array.isArray(payload?.posts) ? payload.posts : [];
}

function findPostBySlug(posts, targetSlug) {
	return posts.find((post) => makeSlug(post) === targetSlug) || null;
}

function makeSlug(post) {
	const title = String(post?.title || "post");
	const date = String(post?.date_time?.[0] || "");
	const time = String(post?.date_time?.[1] || "");

	return `${title}-${date}-${time}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "post";
}

function getPostDescription(content, fallback) {
	const text = String(content || "").replace(/\s+/g, " ").trim();
	if (!text) {
		return String(fallback || "");
	}
	return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function resolvePostImage(postImage, defaultImage) {
	const raw = String(postImage || "").trim();
	if (!raw) {
		return String(defaultImage || "");
	}
	if (/^https?:\/\//i.test(raw)) {
		return raw;
	}

	const normalizedPath = raw.replace(/^\/+/, "");
	const path = normalizedPath.startsWith("fm/") ? normalizedPath : `fm/${normalizedPath}`;
	return new URL(path, "https://jamieharperuk.github.io/").toString();
}

function renderHtml({ title, description, image, canonicalUrl, redirectUrl }) {
	const safeTitle = escapeHtml(title);
	const safeDescription = escapeHtml(description);
	const safeImage = escapeHtml(image);
	const safeCanonical = escapeHtml(canonicalUrl);
	const safeRedirect = escapeHtml(redirectUrl);

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:url" content="${safeCanonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<meta name="twitter:url" content="${safeCanonical}">
<meta http-equiv="refresh" content="0;url=${safeRedirect}">
</head>
<body>
<p>Redirecting to post...</p>
<p><a href="${safeRedirect}">Continue</a></p>
<script>location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

function htmlResponse(html, status = 200, errorMessage = "") {
	return new Response(html, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "public, max-age=300",
			...(errorMessage ? { "x-share-worker-error": errorMessage } : {}),
		},
	});
}

function escapeHtml(value) {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
