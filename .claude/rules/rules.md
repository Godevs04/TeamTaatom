# Rules (Strict)

## Mandatory Initialization Protocol

1. **READ FIRST**: Before performing any web searches, running commands, or writing code, you MUST read all markdown files in `.claude/rules/`.
2. **ACKNOWLEDGE**: Explicitly state "I have read the rules and context" in your first message.
3. **PLAN NEXT**: Outline a brief plan of what you are going to do before taking any actions.

## ❌ Do NOT

- Do NOT use web search or browse the internet unless explicitly asked by the user. Rely only on the provided context and workspace files.
- Refactor existing code
- Rename variables/files
- Change architecture
- Optimize working code
- Touch unrelated files

## ✅ Allowed

- Fix bugs (minimal change)
- Add requested features only
- Reuse existing patterns

## Change Philosophy

- Smallest possible change wins
- If 1 line fixes it, don't write 10

## Safety

- If unsure → ASK
- If change is risky → EXPLAIN FIRST
