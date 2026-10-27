# Goal Planner

A Notion-style app for planning yearly goals. It runs entirely in the browser.

## Features

- **Sidebar of pages.** Make a page for each year, theme or anything else. You can rename pages, give them an emoji, drag to reorder them and expand each one to see its goals.
- **Gallery of goal cards.** Each card shows a cover (an uploaded picture, an image link or a color), the created date, priority, target date with days left or overdue, status and a progress bar. You can filter by status, sort by any property, pick a card size and drag cards to reorder them.
- **Goal pages.** Each goal has a cover, an icon, a title and these properties: created date, target date, priority, status (Not started, In progress, On hold, Completed, Cancelled) and progress. You can set progress with a slider, or have it calculated from the goal's to-do checklist.
- **Block editor for the goal body.** Block types are text, headings 1–3, to-do lists, bulleted and numbered lists, toggles, tables, callouts, quotes, images, code and dividers.
  - Type `/` to open the block menu, or use the `+` and `⋮⋮` handles beside each block.
  - Markdown shortcuts: `#`, `##`, `###`, `-`, `1.`, `[]`, `>` (toggle), `"` (quote), and three backticks for code.
  - Drag blocks to reorder them. Use Tab and Shift+Tab to indent and outdent.
- Light and dark mode, and a layout that works on phones.
- **Local storage with backups.** Everything is saved in your browser's IndexedDB. Use *Export backup* and *Import backup* to move your data to another browser or keep a copy.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck and build to dist/
npm run preview    # serve the production build
```

The `dist/` build is a static site, so any static host can serve it, including GitHub Pages and Netlify.

## Put it on your phone's home screen

The repo includes a workflow (`.github/workflows/deploy.yml`) that publishes the app to GitHub Pages on every push to `main`.

1. **Turn on Pages.** In the repository go to **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**. GitHub Pages for a private repository needs a paid GitHub plan. On a free account, make the repository public first under **Settings → General → Danger Zone → Change visibility**.
2. **Deploy.** Under **Actions**, open **Deploy to GitHub Pages** and click **Run workflow**, or push a commit. When it finishes, the site is at `https://<your-username>.github.io/Planner/`.
3. **Install it.**
   - **iPhone or iPad:** open the link in Safari, tap **Share**, then **Add to Home Screen**.
   - **Android:** open the link in Chrome, tap **⋮**, then **Install app** (or **Add to Home screen**).

The installed app opens full screen and works offline. It keeps its own data, separate from the browser tab. To move goals between devices or browsers, use **Export backup** and **Import backup** in the sidebar.
