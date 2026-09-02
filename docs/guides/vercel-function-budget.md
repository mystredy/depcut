# Vercel Function Budget

The hosted site deploys to Vercel on the Hobby plan, which caps a deployment at
12 Serverless Functions. Vercel bundles the app's route handlers into as few
functions as it can, but a route with a `maxDuration` (or other config) that
doesn't match the rest breaks off into its own function, and enough app growth
also forces the shared bundle itself to split. The project is at exactly 12
functions today, with no room to spare.

**The one rule:** a route only needs its own `maxDuration` when its own work
genuinely runs long. Every long-running route today shares one value, `300`
seconds — adding a route with any other duration, or any other divergent
config, is the most direct way to blow the budget again.

## How it works

Vercel groups route handlers into functions by matching configuration
(duration, memory, region) and splits a group further only once its bundled
code outgrows a size ceiling. The build decides *what* goes in a function; the
Hobby plan decides *how many* functions a deployment is allowed to end up
with.

```text
route handlers
      |
      v
group by (maxDuration, memory, region)  <- config match keeps routes together
      |
      v
split oversized groups by code size     <- growth alone can force a split
      |
      v
Hobby: reject the deployment if the result exceeds 12 functions
```

This surfaced directly: a batch of new routes landed with `maxDuration` values
of `120` and `60` alongside the app's existing `300`, each a distinct group,
and deployments started failing with Vercel's own
`exceeded_serverless_functions_per_deployment` error. Collapsing every
long-running route onto the shared `300` value removed two of those groups and
brought the count back to exactly 12 — the ceiling itself, not a margin under
it.

## Constraints

1. **Zero headroom.** The deployment is at 12 of 12 functions. There is no
   slack for one more `maxDuration` value, one more `runtime` override, or
   enough new default-config routes to force another size-based split.
2. **The count is opaque until deploy time.** Nothing in the local build
   reports the function count Vercel will land on; the only signal is a
   deployment succeeding or failing after the build completes.
3. **A route's duration should describe its actual work**, not get bumped to
   `300` out of habit — the shared value exists so genuinely long routes don't
   fragment the budget, not as a default for new ones.

## Plan: getting real headroom

Nobody has picked one of these yet. Recording them here so the tradeoff is
visible before the next route addition forces the decision under pressure.

| Option | What it buys | Cost |
|---|---|---|
| Upgrade to Vercel Pro | Raises the function ceiling well past what this app needs; zero code risk | Recurring plan cost |
| Consolidate routes into fewer catch-all handlers | Cuts the raw route count the builder has to place | A large, invasive refactor across working routes, with no guarantee it beats the Pro ceiling — some of the growth is code-size-driven, not just route-count-driven |

The Pro upgrade is the safer default recommendation: it is guaranteed to work
and touches no application code, where consolidation is a real rewrite for an
uncertain payoff. Revisit this before adding any route that needs its own
`maxDuration`, `memory`, or `runtime`, and before a wave of new endpoints that
could push the shared bundle over its size ceiling on their own.

## Where it lives

Route duration config lives as a `maxDuration` export in each route handler
under the site project's API routes; the deployment target and plan live in
the project's Vercel dashboard, not in this repo.
