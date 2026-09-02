# Clipper — Feature Plan

**Status: plan only, nothing built.** This is not a supported-behavior guide —
it's a scoping doc for a feature that doesn't exist yet, kept separate from
`docs/guides/` for that reason. Nothing here should be treated as how the app
currently works.

Clipper is a new top-level feature in Donkey Cut, alongside the video editor
and Speech-to-Text: a user brings in a movie-length video, watches it in a
Netflix-style viewer, and while watching can tag a moment with a label for
later, or cut a range out into a standalone clip saved to a library.

**The one rule:** tagging never touches the source video; clipping always
produces a new file. A tag is a label at a timestamp, gone if you delete it. A
clip is a real export — cutting it out and deleting the tag around it should
never be able to corrupt or shorten the original.

## Getting the source video

The four acquisition paths the user described all match something Donkey Cut
already has, built for the editor's own import flow:

| Acquisition path | Existing piece to reuse |
|---|---|
| Upload File | The editor's existing file import |
| Record Audio | `RecordDialog`'s existing audio-only recording mode |
| Social Link | The existing URL import pipeline (already fetches from social platforms) |
| Source URL | The same URL import pipeline |

Social Link and Source URL import carry the same ownership assumption the
editor's own URL import already carries today — Clipper doesn't introduce a
new content-acquisition risk, it reuses the one already accepted there.

## Watching, tagging, clipping

**Watch view.** A full-bleed player over a browsable list of the user's
sources — the "movie box" framing from the request. Playback only; no editing
chrome.

**Tag.** While watching, mark the current moment with a label — the user's
own examples were things like "emotional" or "funny." A tag is a timestamp
plus a label, nothing more, meant to be jumped back to later.

**Clip.** Cut a range out of the source and save it as a new video file in a
library, separate from the movie it came from. This is a real ffmpeg trim and
export, the same kind of operation the Flow feature's Scene Builder already
does when it exports a sequence — Clipper would reuse that pattern rather
than write a second one.

## Open questions

Not decided. Recording them so the next planning pass starts here instead of
from zero.

1. **Data model.** A movie-length source with tags and derived clips doesn't
   look like `CutProject`'s multi-track timeline, and it doesn't look like
   `GenerationFlow` either — closer to a single long asset with markers and
   exports hanging off it. The Flow feature already set the precedent for this
   call: Scene Builder got its own lightweight model rather than being forced
   into `CutProject`'s timeline, because the shapes didn't match. Recommend
   the same move here — a dedicated Clipper model — but that's a real decision
   to make, not assumed.
2. **Where clips land.** A new "Clips" library view, or folded into the app's
   existing Library page?
3. **Tag taxonomy.** Freeform label text, a fixed preset list (emotional,
   funny, …), or both?
4. **Privacy.** Are tags and clips private to the person who added them, like
   Flow's report data is private to nobody but a moderation queue, or
   shareable?
5. **Duration.** A movie is far longer than anything else this app currently
   generates or edits — playback, seeking, and export at that length need
   real testing before this is scoped as "just like the editor."

## Suggested build order

Not started — sequencing for when this gets picked up.

1. Reuse the four existing acquisition paths behind one new Clipper entry
   point.
2. Watch view: player only, no tag or clip yet.
3. Tagging: label + timestamp, with a way to jump back to one.
4. Clipping: trim and export to a library.
5. A library view for saved clips.
