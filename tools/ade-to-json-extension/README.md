# ADE to json extension

Builds a `resources/plannings/*.json` file from an ADE 6 tree, in the browser.

Use it for the schools whose timetables live on an `anonymous_cal.jsp` server, such as
`planning.univ-ubs.fr`. Rennes and the other ADE 7 portals have no tree to scrape: use
`scripts/ade-portal-generator.ts` instead.

## Build and load

```bash
npm install
npm run build
```

Then load `extension/` as an unpacked extension: in Chrome, **chrome://extensions** →
Developer mode → Load unpacked. `npm run dev` rebuilds on save.

## Use

1. Open the ADE page and sign in if the school asks for it.
2. Open the side panel. It lists every folder of the tree it can see.
3. Pick the folder to export, set **Planning title** and, when the school belongs to a
   city already used by other files, **City**.
4. **Expand & Generate**. The extension walks the whole subtree, finds the working
   `projectId` by trying 0 to 10, and copies the finished file to the clipboard.
5. Save it as `resources/plannings/<school>.json`. The file name becomes the planning id,
   so keep it stable: it is the first segment of every saved selection.

## What it produces

A whole planning file, ready to commit:

```json
{
  "title": "IUT de Vannes",
  "group": "Vannes",
  "children": [{ "id": "gea", "title": "GEA", "children": [] }]
}
```

Ids come from the label: no accents, no separators, lower case. The trailing academic
year is dropped, so a group keeps its id next September. Siblings are sorted by title and
duplicate ids get a `-2` suffix, so re-running the export gives the same file.

There is no `id` at the root: the loader takes it from the file name.

## Check before opening a pull request

The export is only as good as the ADE tree. Three things still need a human:

- **Keep the ids that already exist.** Ids are the saved selection of every user of that
  school. Diff against the file on `main` and reuse its ids for every group that is still
  there, even where the ADE label has moved on.
- **Read a resource before trusting it.** ADE recycles its resource ids between years and
  between schools. A url can serve a full calendar that belongs to someone else. Fetch it
  and check the `DESCRIPTION` lines name the group you expect.
- **Rename what ADE names badly.** The export keeps the labels as they are, which means
  the parent name repeated at every level (`GEA1 Groupe 1` under `BUT1 GEA`) and the odd
  typo. The existing files use short names, `1ère année` and the like.

Then run `bun test test/plannings.schema.test.ts` and
`bun scripts/check-plannings-urls.ts --only <school>`.
