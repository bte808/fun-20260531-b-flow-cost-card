# Contributing

Thanks for taking a look at FlowCost Card. This is a small local-first tool, so contributions are most useful when they keep the app fast, inspectable, and easy to run as a static site.

## Good first contributions

- Add realistic workflow templates for support bots, OCR pipelines, coding agents, study tools, or internal ops flows.
- Improve calculation notes when a field is confusing.
- Add edge-case tests for pricing, latency groups, CSV export, or Markdown output.
- Tighten mobile layout and accessibility without adding a build step.
- Share comparison cases where the estimate helped catch an expensive or slow workflow.

## Local setup

```bash
npm test
npm run verify:browser
npm run serve
```

Then open:

```text
http://localhost:5179/
```

The app itself has no runtime dependencies. Node is only used for tests and browser verification.

## Pull request checklist

- Keep the app static and local-first.
- Do not add tracking, analytics, remote API calls, or account requirements.
- Keep runtime dependencies empty unless there is a strong reason.
- Run `npm test` and `npm run verify:browser`.
- Update README or CHANGELOG when behavior changes.
- Add or update tests for calculation changes.

## Design boundaries

FlowCost Card is a planning aid, not a billing source of truth. Prefer wording that helps users inspect assumptions instead of claiming exact cost prediction.

