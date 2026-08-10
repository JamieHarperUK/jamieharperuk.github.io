# White-Label Football Management Site

This directory is a plug-and-play white-label version of the `/fm` site, including an accompanying browser-based JSON editor for editing the site data via GitHub OAuth.

## What is included

- `index.html` — main football management front-end
- `main.js` — site logic for fixtures, teams, posts, sharing, and optional push notifications
- `styles.css` — site styling
- `manifest.json` — PWA metadata
- `sw.js` — service worker for notifications and install behavior
- `webeditor.html` — GitHub JSON editor for managing `data/*.json`
- `data/` — sample JSON templates and image assets
  - `games.json`, `teams.json`, `posts.json`
  - logo and site asset images
- `ghwe_config.example.json` — example GitHub WebEditor repo config
- `ghwe_log.example.json` — example commit log file

## Quick start

1. Copy the entire `fm-site` directory contents to your GitHub Pages repository root.
2. Replace the sample images in `fm-site/data/` if you want custom branding.
3. Fill the `data/*.json` templates with your own football management data.
4. Configure the GitHub WebEditor and optional Cloudflare Workers as described below.

## Deploying the site

### Root deployment

This package is configured to work when hosted at the repository root.

- `index.html`, `main.js`, `styles.css`, `sw.js`, `manifest.json`, and `data/` should all be at the root level.
- The front-end expects `data/games.json`, `data/teams.json`, and `data/posts.json` to exist.
- `manifest.json` is already configured for root scope and start URL.

### If your site is hosted in a subdirectory

If you host the site under a subfolder, update the following paths:

- `main.js` service worker registration and canonical URLs
- `manifest.json` `start_url` and `scope`
- `index.html` metadata URLs and social image references

## Configuring the GitHub OAuth broker worker

The WebEditor uses GitHub Device Flow and requires a Cloudflare Worker to exchange GitHub OAuth tokens safely.

### 1. Register a GitHub OAuth app

1. Go to GitHub Settings > Developer settings > OAuth Apps.
2. Create a new OAuth App.
3. Set the application name to your site name.
4. Set the homepage URL to your site URL.
5. Use any valid callback URL (GitHub requires one), such as `https://example.com/`.
6. Save the app and copy the `Client ID` and `Client Secret`.

### 2. Create the OAuth broker worker

Use a Cloudflare Worker to proxy GitHub OAuth requests.

Example worker code:

```js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}

function textResponse(message, status = 200) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      ...CORS_HEADERS
    }
  });
}

async function proxyToGitHub(url, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    const url = new URL(request.url);

    if (request.method !== "POST") {
      return textResponse("Method not allowed", 405);
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return textResponse("Worker secrets GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured.", 500);
    }

    if (url.pathname === "/github/device/code") {
      const requestBody = await request.text();
      const params = new URLSearchParams(requestBody);
      params.set("client_id", env.GITHUB_CLIENT_ID);
      const githubResponse = await proxyToGitHub("https://github.com/login/device/code", params);
      const payload = await githubResponse.json();
      return jsonResponse(payload, githubResponse.status);
    }

    if (url.pathname === "/github/oauth/access_token") {
      const requestBody = await request.text();
      const params = new URLSearchParams(requestBody);
      params.set("client_id", env.GITHUB_CLIENT_ID);
      params.set("client_secret", env.GITHUB_CLIENT_SECRET);
      const githubResponse = await proxyToGitHub("https://github.com/login/oauth/access_token", params);
      const payload = await githubResponse.json();
      return jsonResponse(payload, githubResponse.status);
    }

    return textResponse("Not found", 404);
  }
};
```

### 3. Deploy the worker

1. Install Wrangler or use Cloudflare's UI.
2. Create a new Worker project.
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Worker secrets.
4. Deploy the worker.
5. Copy the worker URL.

### 4. Configure `webeditor.html`

Open `webeditor.html` and set:

```js
oauth: {
  clientId: "<your-client-id>",
  scope: "repo read:user",
  brokerBaseUrl: "https://your-broker-worker.workers.dev"
}
```

## Configuring the WebEditor repository mapping

The WebEditor requires two root files in the repository:

- `ghwe_config.json`
- `ghwe_log.json`

### Example `ghwe_config.json`

```json
{
  "site_data": {
    "title": "Football Management",
    "url": "https://example.com/"
  },
  "metadata": {
    "last_updated": null
  },
  "json_files": {
    "games": "data/games.json",
    "teams": "data/teams.json",
    "posts": "data/posts.json"
  }
}
```

### Example `ghwe_log.json`

```json
[]
```

Place these two files at the repository root.

## Setting up the share worker (optional)

The share worker generates social preview pages for individual posts.

### 1. Create the share worker

Use this worker code as the handler:

```js
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

    const posts = await loadPosts(String(env.POSTS_JSON_URL || ""));
    const post = findPostBySlug(posts, slug);
    const siteTitle = String(env.SITE_TITLE || "Football Management");
    const siteDescription = String(env.SITE_DESCRIPTION || "");
    const defaultImage = String(env.SITE_DEFAULT_IMAGE || "");
    const spaBase = String(env.SITE_SPA_URL || "https://example.com/").replace(/\/+$/, "/");
    const assetOrigin = getAssetOrigin(env, spaBase, requestUrl);
    const redirectUrl = `${spaBase}#post/${encodeURIComponent(slug)}`;

    const html = renderHtml({
      title: post ? `${post.title || "Post"} | ${siteTitle}` : `Post Not Found | ${siteTitle}`,
      description: post ? getPostDescription(post.content, siteDescription) : siteDescription || "Post not found.",
      image: post ? resolvePostImage(post.image, defaultImage, assetOrigin) : defaultImage,
      canonicalUrl: requestUrl.toString(),
      redirectUrl
    });

    return new Response(html, {
      status: post ? 200 : 404,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};
```

### 2. Worker environment variables

- `POSTS_JSON_URL` — URL to `data/posts.json` on your site
- `SITE_TITLE` — site title
- `SITE_DESCRIPTION` — default meta description
- `SITE_DEFAULT_IMAGE` — default share image URL
- `SITE_SPA_URL` — the front-end spa URL, e.g. `https://example.com/`
- `SITE_ASSET_ORIGIN` — optional origin to resolve local images

### 3. Deploy and connect

1. Deploy the worker.
2. Set `shareConfig.workerBaseUrl` in `fm-site/main.js`:

```js
const shareConfig = {
  workerBaseUrl: "https://your-share-worker.workers.dev"
};
```

This enables the post share button and copy link preview pages.

## Setting up optional push notifications

This site supports browser push notifications if you deploy a push worker and configure `main.js`.

### 1. Create the push worker

Use the worker code from the optional push worker template. It should support these endpoints:

- `GET /vapid-public-key`
- `POST /subscribe`
- `POST /unsubscribe`
- `POST /notify`

### 2. Generate VAPID keys

Run locally:

```bash
npm install web-push
npx web-push generate-vapid-keys --json
```

Copy the generated `publicKey` and `privateKey`.

### 3. Configure Cloudflare secrets

In your worker settings, add:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (for example `mailto:admin@example.com`)
- `ALLOWED_ORIGIN` (your site origin, e.g. `https://example.com`)
- `SITE_BASE_URL` (your site URL)
- `SITE_ICON_URL` (optional icon URL)
- `NOTIFY_BEARER_TOKEN` (secret for posting notifications)

### 4. Configure `fm-site/main.js`

Set:

```js
const pushConfig = {
  workerBaseUrl: "https://your-push-worker.workers.dev",
  siteId: "example-site",
  serviceWorkerPath: "sw.js"
};
```

### 5. Enable notifications in the browser

- Open your site.
- Click the `Alerts` button.
- Grant notification permission.
- Click `Enable Notifications`.

### 6. Send notifications

Use the worker `POST /notify` endpoint with your bearer token.

Example body for a new post:

```json
{
  "kind": "posts",
  "latestPost": {
    "title": "New Match Update",
    "content": "A new result is live.",
    "category": "OSM",
    "image": "data/fm_bg_thin.png",
    "date_time": ["01-08-2026", "20:00"]
  },
  "commitSha": "abc123"
}
```

Example body for a match result:

```json
{
  "kind": "games",
  "latestResult": {
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    "homeScore": "2",
    "awayScore": "1",
    "winner": "Team A",
    "competition": "League",
    "date": "01-08-2026",
    "time": "20:00"
  },
  "commitSha": "abc123"
}
```

## Connecting everything

### 1. Populate `data` templates

- `data/games.json`
- `data/teams.json`
- `data/posts.json`

Keep the JSON structure consistent with the sample metadata fields inside each template.

### 2. Customize `index.html`

- Update the page title and description.
- Replace the logo image path if desired.
- Keep `script src="main.js"` and `styles.css` in place.

### 3. Customize `webeditor.html`

- Set `WEBEDITOR_CONFIG.branding` text.
- Set `WEBEDITOR_CONFIG.oauth.clientId` and `brokerBaseUrl`.
- Keep `repository.requiredRootFiles` as `ghwe_config.json` and `ghwe_log.json`.

### 4. Push to GitHub Pages

- Commit your updated `fm-site` files.
- Push to `main` or your GitHub Pages branch.
- Access the site at `https://<username>.github.io/`.

### 5. Use the WebEditor

- Open `https://<username>.github.io/webeditor`.
- Login with GitHub.
- Select your repository.
- Load a configured JSON file.
- Edit and commit changes.

## Notes

- `ghwe_config.json` and `ghwe_log.json` are required by the editor.
- The share worker is optional and only needed if you want social preview pages for individual posts.
- Push notifications are optional and require a Cloudflare Worker and valid browser permissions.
- If you host under a subfolder instead of the repository root, adjust the site path references accordingly.
