# Contributing to LightSession

Thank you for your interest in contributing to LightSession! This Firefox extension helps keep ChatGPT fast by optimizing DOM performance.

## Getting Started

### Prerequisites

- Node.js 24.10.0+ (use [fnm](https://github.com/Schniz/fnm) or check `.node-version`)
- Firefox Developer Edition (recommended) or Firefox stable

### Development Setup

```bash
# Clone the repository
git clone https://github.com/11me/light-session.git
cd light-session

# Install dependencies
npm install

# Start development mode
npm run dev
```

For detailed architecture and development guide, see [docs/development.md](docs/development.md).

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/11me/light-session/issues) first
2. Create a new issue with:
   - Firefox version
   - Extension version
   - Steps to reproduce
   - Expected vs actual behavior

### Suggesting Features

Open an issue with the `enhancement` label describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run checks:
   ```bash
   npm run lint
   npm run test
   npm run build:types
   npm run build
   ```
5. Commit with a clear message
6. Push and open a Pull Request

### Code Style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- Run `npm run lint:fix` before committing

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update tests if adding new functionality
- Ensure all CI checks pass
- Reference related issues in the PR description

## Project Structure

```
light-session/
├── extension/src/     # TypeScript source code
│   ├── content/       # Content script (DOM trimming logic)
│   ├── popup/         # Extension popup UI
│   └── shared/        # Shared utilities
├── tests/             # Unit tests (vitest)
└── docs/              # Documentation
```

## Questions?

Feel free to open an issue or start a discussion. We're happy to help!
