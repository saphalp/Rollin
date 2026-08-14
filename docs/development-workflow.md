# Development Workflow

## Branches

Rollin uses `main` as the shared integration branch. Feature work should be completed on a branch with a name that describes the associated user story or task.

Before starting a branch:

```powershell
git switch main
git pull origin main
git switch -c descriptive-branch-name
```

Unrelated features should be kept in separate branches so their pull requests can be reviewed and merged independently.

## Making Changes

Before editing code, you should:

- Read the user story and task breakdown
- Pull the latest version of main
- Inspect the existing screen, components, services, and database usage
- Identify existing patterns that the change should follow
- Make the smallest change that completes the task
- Test the affected aspects of the app

## Component-First Development

Rollin follows a component-first preference.

Reusable interface behavior should be implemented in `components/` rather than placing the entire implementation inside a route file. Hooks should contain reusable React data logic, while services should contain domain or backend operations.

A route file should generally focus on:

- Navigation parameters
- Page-level state
- Screen composition
- Connecting components to feature behavior

This structure reduces duplication, allows multiple screens to use the same components, and enhances readability within route files.
