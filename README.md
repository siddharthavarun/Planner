# Goal Planner

A Notion-style app for planning yearly goals. It runs entirely in the browser.

## Features

- **Sidebar of pages.** Make a page for each year, theme or anything else. You can rename pages, give them an emoji, drag to reorder them and expand each one to see its goals.
- **Gallery of goal cards.** Each card shows a cover (an uploaded picture, an image link or a color), the created date, priority, target date with days left or overdue, status and a progress bar. You can filter by status, sort by any property, pick a card size and drag cards to reorder them. Use **Group** to set goals out side by side in columns by status or by priority, then drag a card to another column (or use its ⋯ menu on a phone) to change it.
- **Goal pages.** Each goal has a cover, an icon, a title and these properties: created date, target date, priority, status (Not started, In progress, On hold, Completed, Cancelled) and progress. You can set progress with a slider, or have it calculated from the goal's to-do checklist.
- **Block editor for the goal body.** Block types are text, headings 1–3, to-do lists, galleries (small or medium cards; each card is a sub-goal with its own properties and page), bulleted and numbered lists, toggles, tables (columns can be text, number, currency, percent, date or checkbox, with Sum/Average/Min/Max/Count totals and formulas such as `=B1*12` or `=SUM(B)`), callouts, quotes, images, code and dividers.
  - Type `/` to open the block menu, or use the `+` and `⋮⋮` handles beside each block.
  - Markdown shortcuts: `#`, `##`, `###`, `-`, `1.`, `[]`, `>` (toggle), `"` (quote), and three backticks for code.
  - Drag blocks to reorder them. Use Tab and Shift+Tab to indent and outdent.
- **Live reports.** Type `/report` on any goal to add number tiles, bar charts, line charts and donut charts that read straight from your tables and update as the numbers change. A report can sit next to its table or on its own page (any goal or gallery card), and draw from tables anywhere in the planner. Name a table (e.g. *Budget*) to use it in formulas elsewhere: `=Budget!B2`, `=SUM(Budget!B) - SUM(Spent!B)`.
- **Bin.** Deleted goals and pages go to the Bin at the bottom of the sidebar, with an Undo button right after you delete. You can restore them from the Bin or delete them for good. Anything left there is removed after 30 days.
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

The workflow in `.github/workflows/gh-pages.yml` builds the app on every push to `main` and saves the result to the `gh-pages` branch.

1. **Turn on Pages.** In the repository go to **Settings → Pages**. Under **Build and deployment** set **Source** to **Deploy from a branch**, then pick **gh-pages** and **/ (root)** and click **Save**. GitHub Pages for a private repository needs a paid GitHub plan; on a free account, make the repository public first.
2. **Wait a minute.** The site appears at `https://<your-username>.github.io/Planner/`. Each later push to `main` updates it automatically.
3. **Install it.**
   - **iPhone or iPad:** open the link in Safari, tap **Share**, then **Add to Home Screen**.
   - **Android:** open the link in Chrome, tap **⋮**, then **Install app** (or **Add to Home screen**).

The installed app opens full screen and works offline. It keeps its own data, separate from the browser tab. To move goals between devices or browsers, use **Export backup** and **Import backup** in the sidebar.
