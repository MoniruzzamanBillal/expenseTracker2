# Build Plan — Server Specs

No specs exist yet. This is scaffolding, not a backlog of fabricated future work — don't invent specs for hypothetical features nobody asked for.

## Convention

- Filename: `specs/NN-slug.md`, zero-padded two digits, sequential, numbers are never reused.
- Pull a candidate from `progress-tracker.md`'s "Next Up" list (which itself links into `known-issues.md`) and promote it to a numbered spec only when work is about to actually start — not speculatively ahead of time.

## Spec template

```md
# NN: Title

## Goal
One or two sentences: what this achieves and why.

## Scope
What's in, what's explicitly out.

## Design
The approach — enough detail that someone else could implement it without re-deriving the decision.

## Implementation notes
Files touched, gotchas hit along the way.

## Verify when done
- [ ] Concrete, checkable items — not "test thoroughly."
```

## Keeping this mechanism alive

The first time any nontrivial work is scoped in this repo — even something small, like fixing `AUTH-1` — create `01-<slug>.md` using the template above and mark its row in `progress-tracker.md`'s Spec Status table. If specs never get created, this whole folder silently rots and future sessions won't trust it as a real workflow.
