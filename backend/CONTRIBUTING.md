# Contributing Guide

Thank you for contributing to Terminal Backend!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make changes
5. Test locally
6. Submit a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Copy environment
cp .env.example .env

# Start dev server
npm run dev
```

## Code Standards

### TypeScript
- Use explicit `.ts` extensions in imports
- Prefer `import type` for type-only imports
- Use `express from 'express'; import type { ... } from 'express'` pattern
- Strict typing enabled

### Formatting
```bash
npm run format  # Prettier
npm run lint    # ESLint
```

### Commits
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user authentication
fix: handle PTY resize race condition
docs: update API reference
refactor: extract error handling middleware
test: add health endpoint tests
chore: update dependencies
```

## Pull Request Process

1. Ensure all checks pass:
   - `npm run lint`
   - `npm run format` (no changes)
   - Manual testing

2. Update documentation if needed:
   - README.md
   - docs/API.md
   - docs/ARCHITECTURE.md
   - CHANGELOG.md (unreleased section)

3. Keep PR focused - one feature/fix per PR

4. Write clear PR description:
   - What changed
   - Why
   - How to test

## Adding Dependencies

### Production
```bash
npm install package-name
```

### Development
```bash
npm install -D package-name
```

Always commit `package-lock.json`.

## Testing

```bash
# Run tests (when implemented)
npm test

# Watch mode
npm run test:watch
```

## Code Review Checklist

- [ ] TypeScript compiles (IDE shows no errors)
- [ ] ESLint passes
- [ ] Prettier formatted
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log in production code
- [ ] Error handling follows patterns
- [ ] Security considerations addressed

## Reporting Issues

Use GitHub Issues with:
- Clear title
- Steps to reproduce
- Expected vs actual behavior
- Environment (Node version, OS)
- Logs/screenshots

## Security Issues

Report security vulnerabilities privately via email (not GitHub Issues).

## License

By contributing, you agree your contributions will be licensed under MIT.