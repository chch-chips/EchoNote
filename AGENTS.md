<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-specific code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EchoNote Project Rules

- Use Context7 for current docs when touching frameworks, SDKs, APIs, CLIs, or cloud services.
- Use UI/UX Pro Max before changing visible UI.
- Do not commit `.env`, secrets, database passwords, API keys, or private server material.
- Do not mutate the Tencent Cloud server without explicit confirmation.
- Local development uses the isolated dev database `echo_note_dev` via SSH tunnel `127.0.0.1:15432`; do not point local `.env` at production `echo_note`.
- Production database changes use committed Prisma migrations and `npm run db:deploy`; `db:push` is not a routine post-launch workflow.
- Release handoff default: Codex prepares and pushes a feature branch with verification notes; the user creates/reviews/merges the GitHub PR unless explicitly requested otherwise.
- Prefer mobile-first UI. Test 375px, tablet, and desktop layouts before delivery.
- Keep EchoNote private-first: fast capture matters more than management features.
