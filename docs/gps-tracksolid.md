# Fleet tracking with Tracksolid Pro

`/admin/tracking` shows each car's position from Tracksolid Pro on a live map (OpenStreetMap), refreshed every 15 seconds. It is visible to administrators, managers and fleet officers, and every view is recorded in the activity history. Locations are never shown on customer pages.

## Connect the account

Add these to the server environment (`.env` locally). Do not commit them or paste them into chat.

```
TRACKSOLID_APP_KEY=        # "API Key" (appKey) issued by Jimi for the Open API
TRACKSOLID_APP_SECRET=     # "Secret" (appSecret) issued with the API key
TRACKSOLID_ACCOUNT=        # "Account": the Tracksolid Pro login that owns the trackers
TRACKSOLID_PASSWORD_MD5=   # "user_pwd_md5": MD5 of that login's password
TRACKSOLID_NODE=hk         # hk, eu or us: the node your Open API account belongs to
```

`TRACKSOLID_PASSWORD` (the plain password) can be used instead of `TRACKSOLID_PASSWORD_MD5`, but the hash is preferred so the password itself is not stored. Restart the app after changing these. Until the key, secret, account and password hash are all set, the page shows clearly labelled simulated positions.

Then open **Fleet tracking → Link trackers to cars** and choose the tracker for each car. The list comes from the Tracksolid account; each tracker can be linked to one car.

## Live map and routes

- Choose a car in the list, or **Track** in the table, to centre the map on it. With **Follow this car on the map** ticked, the map moves with the car as new positions arrive, and its route line grows.
- **Route** draws where the car has been: today, the last 24 hours or the last 3 days (`jimi.device.track.list`). Drag **Replay route** to step through it with the time and speed at each point; **Back to live** returns to the current position.
- Viewing the map is recorded in the activity history at most every 10 minutes per person, and each route request is recorded with the car and period.

## How it works

- `src/lib/tracksolid.ts` signs each request as the Open API requires (sorted parameters wrapped in the app secret, MD5, upper case) and posts it to the account's node.
- The access token lasts up to two hours. It is cached in the `IntegrationState` table and renewed automatically when Tracksolid reports it invalid (code 1004).
- Positions are requested in batches of up to 100 trackers and cached for 10 seconds, so all viewers share one Tracksolid request per 10 seconds.
- `src/lib/gps.ts` labels each car **Live**, **Stale** (no report for 15 minutes), **Tracker offline** or **No GPS fix**, and always shows when the position was recorded, so a last known point is never presented as live.

## Verify after connecting

`npm run test:gps` checks the client against a local stand-in for the API (no request reaches Tracksolid). With real keys, open the tracking page and confirm the trackers list loads and a linked car shows a position. Two details the public docs leave open, request encoding and the expired-token code, are handled as form-encoded requests and code 1004; adjust `src/lib/tracksolid.ts` if the live API differs.

Route history (Guide FR-019) is on the live map. Geofences (FR-020) are not built yet.
