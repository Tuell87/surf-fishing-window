# Surf Fishing Window — iPhone/PWA version

This is a Progressive Web App. It can be installed on an iPhone Home Screen and opens like a regular app.

## Fastest way to put it online: GitHub Pages

1. Create a free GitHub account if needed.
2. Create a new public repository named `surf-fishing-window`.
3. Upload the **contents** of this folder to the repository.
4. Open repository **Settings → Pages**.
5. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
6. Save. GitHub will provide an HTTPS address.

## Install on iPhone

1. Open the GitHub Pages address in Safari.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Open **Fish Window** from the new icon.
5. Tap **Use my location** and allow location access.
6. Tap **Enable notifications** if desired.

## Current capabilities

- Uses the phone's GPS location.
- Checks NWS hourly forecasts and active weather alerts.
- Retrieves NOAA tide predictions.
- Scores the next 48 hours.
- Installs to the Home Screen.
- Caches the interface and most recently retrieved forecast.
- Refreshes every 15 minutes while open.

## Notification limitation

iPhone Home Screen web apps support Web Push, but true notifications while the app is closed require:

- A hosted backend or serverless scheduled function
- Push subscription storage
- VAPID keys
- Apple Push Notification delivery through the Web Push standard

The included version gives local notifications while open. A second phase can add a small cloud service for closed-app background alerts.

## Default location and tide station

The app starts near Santa Rosa Beach, Florida and allows the phone to replace this with current GPS coordinates.

Default NOAA tide station: `8729376`.

Always obey beach flags, local officials, lightning warnings, and marine/coastal alerts.
