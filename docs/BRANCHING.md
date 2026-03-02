# Branching Model

NimbleRate uses this flow:

- `main`: stable, production-ready only
- `dev`: integration branch for completed features
- `feature/*`: short-lived branches for focused work
- `codex/*`: temporary engineering branches (CI-covered) used while consolidating work into `dev`

## Rules

1. Create feature branches from `dev`.
2. Open PRs from `feature/*` into `dev`.
3. Merge `dev` into `main` only after integration checks pass.
4. If using `codex/*`, open PR into `dev` and do not deploy directly from `codex/*`.

## Commands

Create feature branch:

```bash
git checkout dev
git pull
git checkout -b feature/<scope>
```

Push feature branch:

```bash
git push -u origin feature/<scope>
```

Promote integration to stable:

```bash
git checkout main
git pull
git merge --no-ff dev
git push origin main
```
