# No Man's Sky Alliance Website Template

Use this template to publish a website for your No Man's Sky alliance with GitHub Pages. The site displays alliance details, members, systems, bases, roles, and social links from JSON files in the `data/` folder.

## What You Need

- A GitHub account with permission to create a repository.
- Git and GitHub Desktop, or Git installed with a terminal you are comfortable using.
- A web browser.

The website itself is static and does not need a server or paid hosting. You can update its JSON files directly on GitHub if you do not want to set up the optional browser editor.

## 1. Create Your GitHub Pages Repository

If you already have a GitHub Pages repository, you can use it and skip to step 2. Otherwise:

1. Sign in at [github.com](https://github.com/).
2. Select **New repository**.
3. For a personal site at `https://YOUR-USERNAME.github.io/`, name the repository exactly `YOUR-USERNAME.github.io`, replacing `YOUR-USERNAME` with your GitHub username.
4. Choose **Public** for the simplest GitHub Pages setup. Add a README if you like.
5. Select **Create repository**.

You can also use a repository with another name, such as `my-alliance`. Its site address will include the repository name, for example `https://YOUR-USERNAME.github.io/my-alliance/`.

## 2. Put the Template in the Repository Root

The template lives in the `nms-alliance` folder of the [template repository](https://github.com/jamieharperuk/jamieharperuk.github.io/tree/main/nms-alliance).

1. Download the template repository using its **Code** button and **Download ZIP**, then extract the ZIP.
2. Clone your new Pages repository to your computer. For example, in Git Bash:

	```sh
	git clone https://github.com/YOUR-USERNAME/YOUR-USERNAME.github.io.git
	```

	For a repository named `my-alliance`, use that repository name in the URL instead.
3. Open the cloned repository folder. Copy the *contents* of the extracted `nms-alliance` folder into it. Do not copy the enclosing `nms-alliance` folder itself.
4. Check that `index.html`, `manager.html`, `data/`, and `source/` are directly inside your cloned repository folder. In particular, the main page must be at the repository root as `index.html`.
5. If your new repository already contains a README or other files, keep them unless you intentionally want to replace them.

To publish the files from Git Bash, run these commands from inside your cloned repository:

```sh
git add .
git commit -m "Add NMS alliance website"
git push
```

You can do the same with GitHub Desktop: add the files to the local repository, commit the changes, then select **Push origin**.

## 3. Turn On GitHub Pages

1. Open your repository on GitHub and select **Settings**.
2. In the sidebar, select **Pages**.
3. Under **Build and deployment**, set the source to **Deploy from a branch**.
4. Choose the `main` branch and the `/(root)` folder, then select **Save**.
5. Wait a few minutes and open the Pages URL shown on that settings screen.

For a personal repository named `YOUR-USERNAME.github.io`, the URL is normally `https://YOUR-USERNAME.github.io/`. A repository with another name is normally published at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## 4. Add Your Alliance Information

Edit the JSON files in `data/`. Keep the existing JSON structure and valid JSON syntax (including quotation marks and commas).

- `data/alliance.json`: alliance name and description, home system index, leaderboard score, social links, and alliance roles.
- `data/members.json`: the members you want to showcase. Friend codes are optional; leave `nms_friend_code` as `null` if a member does not want to share one.
- `data/systems.json`: the systems and worlds recorded by your alliance. The `home_system` value in `alliance.json` refers to a system's zero-based position in this file; use `0` for the first system.
- `data/bases.json`: alliance bases associated with your recorded systems and worlds.

The starter files contain examples and placeholder values. Replace them with information your alliance has agreed to publish. To change the appearance, replace the alliance artwork in `source/images/` while keeping the existing filenames, or update the matching image paths in `index.html` and `manager.html`.

Commit and push data or image changes to publish them. GitHub Pages can take a short time to show each update. Open the site using its `https://` URL; loading the page as a local `file://` can prevent the browser from fetching the JSON data.

## 5. Update the Site Later

You can edit a file on GitHub by opening it and selecting the pencil icon, or edit the local clone and push your changes. The site reads the JSON files directly, so changes to alliance data do not require rebuilding the website.

After publishing, check the home, members, territory, and join sections. If the page reports that records could not be loaded, confirm that all four JSON files are present under `data/` at the repository root and that each file contains valid JSON.

## Optional: Configure `manager.html`

`manager.html` is a browser-based editor that can commit changes to the site's JSON files. It is **not ready to use in a copied template without configuration**: its current settings point to the template author's repository and use an OAuth broker. Do not try to connect it to your site until you have changed those settings.

In `manager.html`, find `WEBEDITOR_CONFIG` and update:

1. `repository.targetRepoFullName` to your GitHub repository, in `OWNER/REPOSITORY` format.
2. Each path under `repository.files` to the matching root-level path in your repository: `data/alliance.json`, `data/bases.json`, `data/members.json`, and `data/systems.json`.
3. `oauth.clientId` to the client ID for an OAuth app you control, and `oauth.brokerBaseUrl` to an OAuth broker you have configured for that app. The editor expects the broker's `/github/device/code` and `/github/oauth/access_token` endpoints.
4. The branding values if you want the editor to show your alliance's name.

GitHub device-flow authentication requires an OAuth app and a broker that safely handles the browser's requests. Follow the current GitHub and broker setup instructions; any OAuth client secret required by your broker must stay on the server and must not be added to `manager.html`. The editor requests the `repo read:user` scope and can commit to the configured repository for GitHub users who have write access. Only configure it if you understand and accept that access model. The page also displays the editor's licence terms; review them before using or distributing the editor.

If you do not want to operate or configure an OAuth broker, leave `manager.html` unused and update the JSON files directly in GitHub instead.