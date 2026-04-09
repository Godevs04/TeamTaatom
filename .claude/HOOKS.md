# Hooks Configuration Guide

This file explains how to set up automated behaviors via Claude Code hooks.

---

## What are Hooks?

Hooks are shell commands that execute automatically in response to events:
- Before/after tool execution
- Before/after commits
- When certain patterns are detected

They live in `settings.json` and let you automate quality checks.

---

## Common Hook Use Cases

### 1. Auto-Lint Before Commit

Automatically format code before you commit:

```json
{
  "hooks": {
    "afterEdit": {
      "description": "Auto-fix linting issues",
      "command": "cd {cwd} && npm run lint:fix"
    }
  }
}
```

### 2. Run Tests After Edit

Validate changes don't break tests:

```json
{
  "hooks": {
    "afterEdit": {
      "description": "Run tests on changes",
      "command": "cd {cwd} && npm test"
    }
  }
}
```

### 3. Check Migrations Applied

Before starting, verify DB is up-to-date:

```json
{
  "hooks": {
    "beforeTask": {
      "description": "Check migrations",
      "command": "cd {cwd}/backend && npm run migrate:status"
    }
  }
}
```

### 4. Prevent Secrets in Commits

Scan for secrets before pushing:

```json
{
  "hooks": {
    "beforeBash": {
      "description": "Prevent secrets in commits",
      "command": "if [[ $COMMAND == *'git push'* ]]; then grep -r 'password\\|secret\\|key' . --exclude-dir=node_modules && echo 'SECRETS DETECTED' && exit 1; fi"
    }
  }
}
```

### 5. Enforce Branch Naming

Ensure branches follow naming convention:

```json
{
  "hooks": {
    "beforeBash": {
      "description": "Enforce branch names",
      "command": "BRANCH=$(git rev-parse --abbrev-ref HEAD); if [[ ! $BRANCH =~ ^(main|develop|feature/|bugfix/|hotfix/) ]]; then echo 'Branch must start with feature/, bugfix/, hotfix/, main, or develop'; exit 1; fi"
    }
  }
}
```

---

## Hook Event Types

| Event | Trigger | Example |
|-------|---------|---------|
| `beforeEdit` | Before editing a file | Validate file path |
| `afterEdit` | After editing a file | Run linter |
| `beforeBash` | Before running bash | Check secrets |
| `afterBash` | After bash completes | Cleanup artifacts |
| `beforeTask` | Before task starts | Verify setup |
| `afterTask` | After task completes | Run validation |

---

## Hook Variables Available

Inside hook commands, you can use:

| Variable | Description | Example |
|----------|-------------|---------|
| `{cwd}` | Current working directory | `/c/Users/srigo/Desktop/TeamTaatom` |
| `{file}` | File being edited (Edit hook) | `frontend/App.jsx` |
| `{command}` | Bash command being run | `git push origin main` |

---

## Recommended Setup for This Project

Create or update `~/.claude/settings.json`:

```json
{
  "hooks": {
    "afterEdit": [
      {
        "description": "Auto-fix linting for JavaScript files",
        "filePattern": "**/*.{js,jsx,ts,tsx}",
        "command": "cd {cwd} && npm run lint:fix -- {file}"
      }
    ],
    "beforeBash": [
      {
        "description": "Warn if pushing to main",
        "command": "if [[ $COMMAND == *'git push'* && $COMMAND == *'main'* ]]; then echo '⚠️  About to push to main - confirm intent'; fi"
      }
    ]
  }
}
```

---

## How to Enable Hooks

1. **Locate settings.json**:
   - Linux/Mac: `~/.claude/settings.json`
   - Windows: `C:\\Users\\YourUsername\\.claude\\settings.json`

2. **Add hooks section** (or use the `update-config` skill):
   ```bash
   /update-config
   ```

3. **Test the hook**:
   - Edit a file and watch for the hook command to run
   - Check the output in the console

---

## Best Practices

✅ **DO**:
- Keep hooks fast (< 2 seconds)
- Use specific file patterns to avoid running on everything
- Log meaningful messages (`echo "✅ Lint passed"`)
- Test hooks locally first

❌ **DON'T**:
- Run expensive operations in hooks (full test suite)
- Block on user input
- Silence errors (`2>/dev/null`)
- Make hooks too verbose

---

## Example: Complete Setup

Here's a full `settings.json` example for this project:

```json
{
  "hooks": {
    "afterEdit": [
      {
        "description": "Fix linting on JS/TS changes",
        "filePattern": "**/*.{js,jsx,ts,tsx}",
        "command": "cd {cwd} && npm run lint:fix -- {file} 2>&1 || true"
      },
      {
        "description": "Validate JSON files",
        "filePattern": "**/*.json",
        "command": "node -e \"JSON.parse(require('fs').readFileSync('{file}'))\" && echo '✅ JSON valid' || echo '❌ Invalid JSON'"
      }
    ],
    "beforeBash": [
      {
        "description": "Prevent accidental force-push",
        "command": "if [[ $COMMAND == *'--force'* || $COMMAND == *'-f'* ]]; then echo '⚠️  FORCE PUSH detected'; fi"
      }
    ],
    "beforeTask": [
      {
        "description": "Verify backend is installed",
        "command": "test -d '{cwd}/backend/node_modules' || echo '⚠️  Backend dependencies not installed - run: cd backend && npm install'"
      }
    ]
  }
}
```

---

## Troubleshooting Hooks

**Hook not running?**
1. Check `settings.json` syntax (must be valid JSON)
2. Verify file pattern matches your edited file
3. Check hook event type matches action you're taking

**Hook output not showing?**
1. Add explicit `echo` statements
2. Check if command succeeded or failed
3. Use `2>&1` to capture stderr

**Hook blocking my work?**
1. You can disable hooks temporarily:
   ```bash
   /update-config
   # Set hooks to empty object: {}
   ```
2. Or modify the condition to be more specific

---

## When to Use Hooks

**Use hooks for**:
✅ Auto-formatting (fast)
✅ Validation checks (quick)
✅ Status checks (informational)
✅ Warnings (important events)

**Don't use hooks for**:
❌ Full test suites (too slow)
❌ Deployments (too risky)
❌ Complex logic (belongs in code)
❌ User-facing changes (go in code)

---

**Next steps**:
1. Decide which hooks you want to enable
2. Add them to `~/.claude/settings.json`
3. Test them by editing a file
4. Come back to update this file with what works

**Last updated**: 2026-04-09
