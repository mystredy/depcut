# Vercel Function Budget

The hosted site deploys to Vercel on the Pro plan, which has enough headroom in
its Serverless Function ceiling that route count isn't a deploy-time risk. It
wasn't always: the project ran on Hobby's 12-function cap until a batch of new
routes exceeded it and forced the upgrade. The grouping mechanism below still
governs how routes turn into functions, so it still shapes how to add one.

**The one rule:** a route only needs its own `maxDuration` when its own work
genuinely runs long. Every long-running route today shares one value, `300`
seconds — adding a route with a different duration, or other divergent config,
is what splits the shared bundle into more functions than it needs.

## How it works

Vercel groups route handlers into functions by matching configuration
(duration, memory, region) and splits a group further only once its bundled
code outgrows a size ceiling.

```text
route handlers
      |
      v
group by (maxDuration, memory, region)  <- config match keeps routes together
      |
      v
split oversized groups by code size     <- growth alone can force a split
```

A route's duration should describe its actual work, not get bumped to `300`
out of habit — the shared value exists so genuinely long routes don't fragment
the bundle, not as a default for new ones.

## Where it lives

Route duration config lives as a `maxDuration` export in each route handler
under the site project's API routes; the deployment target and plan live in
the project's Vercel dashboard, not in this repo.
