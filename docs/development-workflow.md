# Development Workflow

We use **`dev` for testing** and **`main` for production**. Do feature work on your own branch, then open a pull request into `dev` so the team can review and test it.

## Start a feature

Check for local changes first:

```powershell
git status
```

If the working tree is clean, update `dev` and create a branch:

```powershell
git switch dev
git pull --ff-only origin dev
git switch -c your-feature-name
```

Use a name that describes the work. Keep unrelated features in separate pull requests when possible.

## Bring dev into work you already started

Stay on your feature branch. If you have uncommitted changes, save them temporarily with a stash:

```powershell
git stash push -u -m "Work before updating from dev"
git fetch origin dev
git merge origin/dev
git stash pop
```

Only use `stash pop` here if the first command created a stash. If Git reports conflicts during the merge, resolve those before restoring the stash. If conflicts happen while restoring it, Git keeps the stash until you finish. Check `git status` and review the files before continuing.

## Check and share your work

Test the changed screens on a device and run the feature's tests. Use `npx tsc --noEmit` to check TypeScript. For changes to interactions between users, test with two accounts.

Before committing, review `git diff` and `git status`. Press `q` to leave Git's scrolling diff view. Stage the intended files, then commit and push when you are ready:

```powershell
git add path/to/changed-file
git commit -m "Describe the change"
git push -u origin your-feature-name
```

On GitHub, create a pull request with **base: `dev`** and your feature branch as the comparison. Explain what changed, how you tested it, and whether someone needs to run SQL or deploy a function. Moving tested changes to `main` is a separate release step.

## Keep the code and docs readable

Use existing components before creating a new version of the same control. Put shared requests in services and shared React logic in hooks. Update the feature page when behavior or setup changes.

Write docs the way you would explain the feature to a teammate: what it does, how to use it, and anything they need to know before changing it. Explain unfamiliar terms when they matter. There is no need to list every variable or repeat what the code already says.

## Preview the documentation

With Python installed, run:

```powershell
python -m venv .venv-docs
.venv-docs/Scripts/python.exe -m pip install -r docs/requirements.txt
.venv-docs/Scripts/python.exe -m mkdocs serve
```

Open the address printed in the terminal. To check the site without running the preview server, use `.venv-docs/Scripts/python.exe -m mkdocs build --strict`.
