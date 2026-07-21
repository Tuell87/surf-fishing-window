# Surf Fishing Window v0.2.2 — Location-Aware Live Cams

## What changed
- The Live Cams tab is no longer a fixed Santa Rosa Beach list. It now calculates the distance from your current forecast location to each curated camera and shows the nearest ones (within ~40 miles), closest first, with the distance labeled on each card.
- The tab header shows whichever location you're currently on.
- If no curated camera is within range — which will be true most places, since there's no free service that indexes every beach cam everywhere — the tab always shows two fallback cards instead of coming up empty:
  - **Search the web**, built from your current location name
  - **Browse nearby on the map**, centered on your current coordinates
- The camera list refreshes automatically after you tap "Use my location."
- Service worker cache bumped again (v3) so the installed app picks this up.

## Honest limitation
The curated list currently only has real, verified cameras for the Santa Rosa Beach / 30A area. Anywhere else, you'll see the search and map fallbacks instead of a named camera — that's expected, not a bug. If you want more areas covered with named cameras (say, your other favorite fishing spots), send me the beach/pier name and I can add it to the curated list with real coordinates the same way.

## Exact replacement list
Only these three files need replacing:

- `index.html`
- `app.js`
- `service-worker.js`

`styles.css` and `manifest.webmanifest`/`icons/` are unchanged — leave them alone.

## Steps on iPhone
1. Open each of the three files in the GitHub repo, tap the pencil.
2. Select all, delete, paste in the new version, commit to `main`.
3. Wait 1–2 minutes for GitHub Pages to redeploy.
4. Fully close and reopen the installed Home Screen app (swipe it away, don't just background it).

## Try it
- Open **Live Cams** with the default Santa Rosa Beach location — you should see the 5 curated cams sorted by distance.
- Tap "Use my location" somewhere far from the Panhandle (or manually note the fallback logic) — you should see the two search/map fallback cards instead.
