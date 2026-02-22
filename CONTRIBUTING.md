# Contributing to BIM-Chain

Thank you for your interest in contributing to BIM-Chain. This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Commit Convention](#commit-convention)
- [Testing](#testing)
- [Issue Reporting](#issue-reporting)

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker & Docker Compose | Latest | Run Fabric network and CouchDB |
| Node.js | 20+ | Middleware and frontend development |
| Go | 1.21+ | Chaincode development |
| .NET SDK | 8.0+ | Revit plugin development |
| Git | Latest | Version control |

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/bim-chain/bim-chain.git
cd bim-chain

# Install middleware dependencies
cd packages/middleware
npm ci

# Install frontend dependencies
cd ../frontend
npm ci

# Install chaincode dependencies
cd ../chaincode-go
go mod download

# Build the Revit plugin
cd ../revit-plugin
dotnet restore
dotnet build
```

### Running Locally

```bash
# Start the Fabric network (Docker)
docker compose up -d

# Start the middleware (development mode)
cd packages/middleware
npm run dev

# Start the frontend (development mode)
cd packages/frontend
npm run dev
```

## Project Structure

```
bim-chain/
  packages/
    chaincode-go/       # Go smart contracts
    middleware/          # Node.js/Fastify REST API
    frontend/           # Next.js dashboard
    revit-plugin/       # C#/.NET Revit add-in
  docs/                 # Documentation
  .github/workflows/    # CI/CD pipelines
```

## Coding Standards

### Go (Chaincode)

- Follow standard Go formatting (`gofmt`).
- Use `go vet` to catch common issues.
- All exported functions and types must have documentation comments.
- Error messages should start with a lowercase letter and not end with punctuation.
- Use table-driven tests where appropriate.

### TypeScript (Middleware & Frontend)

- Use TypeScript strict mode.
- Follow the existing code style (enforced by `tsc --noEmit` for middleware, `next lint` for frontend).
- Use `const` by default; use `let` only when reassignment is necessary.
- Prefer named exports over default exports.
- Use async/await over raw Promises.

### C# (Revit Plugin)

- Follow the .NET coding conventions.
- Use file-scoped namespaces.
- Use record types for immutable data models.
- Use `System.Text.Json` for serialization.
- All public members must have XML documentation comments.

### General

- Keep functions focused and small.
- Write meaningful variable and function names.
- Add comments for non-obvious logic.
- Never commit secrets, credentials, or API keys.

## Pull Request Process

1. **Fork and branch**: Create a feature branch from `main`. Use a descriptive branch name:
   - `feat/audit-trail-pagination`
   - `fix/governance-approval-race`
   - `docs/api-reference-update`

2. **Develop**: Make your changes, following the coding standards above.

3. **Test**: Ensure all existing tests pass and add new tests for your changes.
   ```bash
   # Chaincode
   cd packages/chaincode-go && go test -v ./...

   # Middleware
   cd packages/middleware && npm test

   # Frontend
   cd packages/frontend && npm test

   # Revit plugin
   cd packages/revit-plugin && dotnet test
   ```

4. **Commit**: Use conventional commit messages (see below).

5. **Push**: Push your branch and open a pull request against `main`.

6. **Review**: All PRs require at least one approving review before merge. Address review feedback in additional commits (do not force-push over review comments).

7. **CI**: All CI checks must pass before merge.

8. **Merge**: Maintainers will merge using squash-and-merge to keep the history clean.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring (no feature or fix) |
| `test` | Adding or updating tests |
| `chore` | Build process, CI, or auxiliary tool changes |
| `perf` | Performance improvements |

### Scopes

| Scope | Package |
|-------|---------|
| `chaincode` | `packages/chaincode-go` |
| `middleware` | `packages/middleware` |
| `frontend` | `packages/frontend` |
| `plugin` | `packages/revit-plugin` |
| `docs` | Documentation files |
| `ci` | GitHub Actions workflows |

### Examples

```
feat(chaincode): add QueryByTimeRange to AuditContract

fix(middleware): handle JWT expiry race condition in auth middleware

docs(api): add batch endpoint documentation

test(plugin): add ChangeQueue thread safety tests

chore(ci): add coverage upload to chaincode workflow
```

## Testing

### Test Coverage Expectations

- **Chaincode**: All public contract functions must have unit tests. Aim for 80%+ coverage.
- **Middleware**: All route handlers and service methods must have tests. Aim for 80%+ coverage.
- **Frontend**: All components must have rendering tests. Interactive components must have behavior tests.
- **Revit Plugin**: All services (hasher, queue, API client, record builder) must have unit tests.

### Writing Tests

- Use meaningful test names that describe the expected behavior.
- Test both success and error paths.
- Use mocks for external dependencies (Fabric SDK, HTTP clients, Revit API).
- Do not rely on external services in unit tests.

## Issue Reporting

When opening an issue, please include:

1. **Description**: Clear summary of the bug or feature request.
2. **Steps to reproduce** (for bugs): Numbered steps to trigger the issue.
3. **Expected behavior**: What should happen.
4. **Actual behavior**: What actually happens.
5. **Environment**: OS, Revit version, Node.js version, Go version, etc.
6. **Screenshots or logs**: If applicable.

Use the appropriate issue template when available.

## Adding a New Chaincode Function

End-to-end checklist:

1. **Define the data type** in `packages/chaincode-go/shared/types.go` (if new)
2. **Write tests first** in the appropriate `*_test.go` file
3. **Implement the function** in the contract file (e.g., `audit/audit.go`)
4. **Run Go tests**: `go test ./... -v -count=1`
5. **Add CouchDB index** if the function uses rich queries (in `META-INF/statedb/couchdb/indexes/`)
6. **Add the TypeScript interface method** in `packages/middleware/src/services/fabric-service.ts`
7. **Implement the mock** in `MockFabricService` for testing
8. **Add the API route** in the appropriate routes file
9. **Write middleware tests** for the new endpoint
10. **Run middleware tests**: `cd packages/middleware && npm test`
11. **Update the frontend** if the function is user-facing (add API client method, component, page)
12. **Update documentation**:
    - `docs/api-reference.md` for the REST endpoint
    - `docs/chaincode-reference.md` for the chaincode function
13. **Update contract tests** in `tests/contract/schema-validation.test.ts`
14. **Run the full test suite**: `./scripts/test-all.sh`

## Code Review Expectations

All PRs require at least one review. Reviewers check for:

- **Correctness**: Does the code do what it claims?
- **Tests**: Are there adequate tests? Do they test meaningful behavior?
- **Security**: No hardcoded secrets, proper input validation, correct access control
- **Consistency**: Does the code follow existing patterns and conventions?
- **Documentation**: Are public APIs documented? Are complex algorithms explained?
- **Error handling**: Are errors properly wrapped with context and propagated?

## License

By contributing to BIM-Chain, you agree that your contributions will be licensed under the Apache License 2.0.
