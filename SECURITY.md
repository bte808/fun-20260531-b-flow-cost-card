# Security

FlowCost Card is a static local-first browser app. It does not require an account, API key, backend service, or network call for normal use.

## Data handling

- Workflow data is entered by the user in the browser.
- Drafts are stored in `localStorage` on the same device.
- CSV, JSON, and Markdown exports are generated locally.
- The app should not transmit user workflow data to a server.

## Reporting a security issue

Please open a private channel with the maintainer before publishing details if you find a vulnerability that could expose local drafts, trigger unsafe downloads, or introduce unexpected network behavior.

Public issues are fine for documentation problems, calculation mistakes, accessibility bugs, and normal UI defects.

## Security expectations for changes

- Keep user-entered content escaped before rendering into HTML.
- Avoid adding third-party runtime dependencies.
- Avoid remote scripts, analytics, trackers, or hosted fonts.
- Keep downloads user-initiated.

