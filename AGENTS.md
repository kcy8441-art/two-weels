<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Version control workflow

- Remote repository: `https://github.com/kcy8441-art/two-weels.git`.
- The user requests ongoing Git version control. Commit completed code changes in meaningful work units after appropriate validation; do not leave finished code changes uncommitted.
- Review the staged diff and exclude secrets, local environment files, dependencies, build output, and runtime data before committing.
- Use concise commit messages describing the change. Report validation limitations accurately.
- Push when requested by the user. Never force-push or overwrite remote history without explicit authorization.
- Preserve unrelated user changes. Do not amend or rewrite existing commits unless requested.
