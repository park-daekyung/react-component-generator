# PR Body Template (English)

Use this structure as is. Replace each `<...>` hint with real content, and write `N/A` where nothing applies.

```markdown
## Summary

<What this PR does, in 1-2 sentences>

## Motivation

<Why this change is needed. Link the issue or requirement if any (e.g. Closes #12). N/A if there is no basis>

## Changes

- <User-visible change or key code change>
- <...>

## Verification

- [ ] Tests pass (`<command you ran>`)
- [ ] Lint passes (`<command you ran>`)
- [ ] Build passes (`<command you ran>`)
- [ ] Manual check (<what you checked>)

<If you added tests, one line on what they verify>

## Notes for reviewers

<Parts that need careful review, compatibility-affecting changes, config or dependency changes. N/A if none>

## Screenshots

<Only when there are UI changes. N/A otherwise>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Guidelines

- Write **Changes** per behavior, not as a file list. The diff already shows files.
- In **Verification**, mark `[x]` only for items you actually ran. Leave `[ ]` for anything not run, or delete lines that do not apply to this PR.
- Always keep the attribution line at the very end.
