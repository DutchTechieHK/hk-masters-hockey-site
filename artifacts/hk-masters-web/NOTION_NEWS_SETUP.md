# Notion News Setup Checklist

This guide walks you through setting up the Notion side so news posts you write in Notion appear automatically on **hkmastershockey.com/news**.

Total time: ~15 minutes.

---

## Step 1 — Create the "News" database in Notion

1. In Notion, create a new page called **HK Masters News** (or use any existing page).
2. Inside it, create a new **database** of type **Table**.
3. Name the database **News**.
4. Set up these properties exactly as below (delete any default properties you don't need):

| Property name      | Type           | Notes                                                                 |
|--------------------|----------------|-----------------------------------------------------------------------|
| **Title**          | Title          | Already exists — just rename to "Title". The post headline.           |
| **Slug**           | Text           | URL-safe identifier, e.g. `squad-announcement-2026`.                 |
| **Status**         | Select         | Options: `Draft`, `Published`, `Archived`.                            |
| **Published date** | Date           | Controls the order posts appear on the site.                          |
| **Author**         | Text           | Byline shown on the post.                                             |
| **Category**       | Select         | Options: `News`, `Match Report`, `Announcement`.                      |
| **Team tag**       | Multi-select   | Options: `MO40`, `MO50`, `WO40`, `All`. Used for filtering.           |
| **Cover image**    | Files & media  | Upload one image to act as the hero/cover. Optional.                  |
| **Excerpt**        | Text           | 1–2 line summary shown on the news index. Optional.                   |

> The post body itself is the **page content** — just write it naturally inside the page like any Notion doc (headings, paragraphs, images, lists, quotes, links — they all render).

---

## Step 2 — Create a Notion integration

1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**.
3. Name it **HK Masters Website**.
4. Associated workspace: pick your workspace.
5. Type: **Internal**.
6. Capabilities: **Read content** is enough (you can leave Insert/Update content unchecked).
7. Click **Save**.
8. On the integration page, copy the **"Internal Integration Secret"** (starts with `secret_…` or `ntn_…`). **Keep this safe — share it with the developer to add as the `NOTION_API_TOKEN` secret.**

---

## Step 3 — Share the News database with the integration

1. Open the News database page in Notion.
2. Click the **`…`** menu in the top-right of the page → **Connections** → **Connect to** → pick **HK Masters Website**.
3. Confirm the connection.

Without this step the integration can't see the database, even with a valid token.

---

## Step 4 — Get the database ID

1. Open the News database as a **full page** (click the title bar so the URL shows the database, not a single row).
2. Look at the URL:
   ```
   https://www.notion.so/<workspace>/<DATABASE_ID>?v=<view_id>
   ```
3. The `DATABASE_ID` is the long string of letters and numbers between the workspace name and the `?v=`. It looks like `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`.
4. **Hand this to the developer to add as the `NOTION_NEWS_DATABASE_ID` secret.**

---

## Step 5 — (Recommended) Wire up the publish webhook

This makes posts appear on the site within seconds of you publishing them, instead of waiting ~5 minutes for the cache to refresh.

1. Ask the developer to add a `NOTION_WEBHOOK_SECRET` secret (any random string — the dev can generate one).
2. The webhook URL will be:
   ```
   https://app.hkmastershockey.com/api/news/refresh?secret=<NOTION_WEBHOOK_SECRET>
   ```
3. In your News database, click the **⚡ Automations** button (top-right).
4. Create a new automation:
   - **Trigger**: "When Status is set to" → `Published`
   - **Action**: "Send webhook" → paste the URL above.
5. Save the automation.

Now: change a post's Status from Draft to Published → the site updates within seconds.

(Notion's "Send webhook" automation requires a Business or Enterprise workspace. On free/Plus plans, posts will still appear within 5 minutes via cache refresh.)

---

## Step 6 — Write your first post

1. In the News database, click **+ New**.
2. Fill in: Title, Slug (e.g. `welcome-to-our-news`), Published date (today), Author, Category, Excerpt.
3. Click into the page and write the body — headings, paragraphs, images, links, all work.
4. Set **Status** = `Published`.
5. Visit hkmastershockey.com/news — your post should be there.

If it doesn't appear within 5 minutes (or seconds with the webhook):
- Check the database is shared with the integration (Step 3).
- Check Status is exactly `Published` (case matters).
- Check the developer has set both secrets correctly.

---

## Editing & unpublishing

- **Editing**: edit the page in Notion → changes appear on the site within 5 minutes (or instantly if the webhook is wired and you re-trigger by toggling Status).
- **Unpublishing**: change Status to `Draft` or `Archived` → post disappears within 5 minutes.
- **Deleting**: deleting the page in Notion removes the post from the site (within 5 minutes).

---

## What if I want tournament info pages or sponsors in Notion too?

Same pattern, separate databases. We deliberately scoped this first task to News only — once you've used it for a while and confirmed the editing flow feels right, follow-up tasks can extend the same approach to Tournament Info and Sponsors.
