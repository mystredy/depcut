# Studio and Drops

A Studio is a user's publishing identity — a channel with a name, handle, and
avatar. A Drop is one post to it: a video plus a title, description, and
hashtags. Every account's identity flows through a Studio now; there's no
separate personal profile.

**The one rule:** whether a Drop's video or details can be seen goes through
one gate — a studio manager always sees it, anyone else only once it's
`complete` and not `private`. Every read path shares that same check: the
studio grid, a direct link to one Drop, and the video stream itself. A route
that reads a Drop without it would leak a private post to anyone who knows
its id.

## How it works

A Drop moves through one status at a time, from upload to post:

```
pending
  │
  ▼
uploading ──▶ error (upload never arrived)
  │
  ▼
draft
  │
  ├──▶ complete
  │
  └──▶ scheduled ──▶ complete
```

The manager decides what to post, when, and who can see it; the platform
enforces that decision on every read.

## Visibility

Set once, when a Drop is published or scheduled:

| Visibility | Studio grid | Direct link |
| --- | --- | --- |
| Public (default) | anyone signed in | anyone signed in |
| Unlisted | manager only | anyone signed in |
| Private | manager only | manager only |

A `draft` or `scheduled` Drop is manager-only regardless of visibility — it
hasn't been posted yet, so nobody outside the studio has agreed to see it.

## Scheduling

Publishing with a future time moves a Drop to `scheduled` instead of
`complete`. A sweep runs every few minutes, publishes every scheduled Drop
whose time has passed, and fans it out exactly like an immediate post.
Deleting a scheduled Drop before its time is how a post gets cancelled — the
sweep simply won't find it.

## Publications

A posted Drop can fan out to a studio's connected accounts through two kinds
of workflow, both configured from the studio's settings:

- **Repurpose new posts** pushes every new Drop the moment it's posted.
- **Repurpose existing content** trickles a studio's back catalog out at a
  fixed number of posts per day, oldest first, until the catalog is caught up.

Each attempt writes a durable record of what actually reached which
platform — what a manager's Share and Repurpose actions, and the studio
grid's platform badges, read from.

## Where it lives

The composer's visibility and scheduling controls live with the New Drop
dialog; the access gate and the publish/schedule routes live with the
studio API handlers; the sweep is a background job beside the other
scheduled sweeps.
