# 🤖 Agent Instructions for Kiana Project

This document provides comprehensive instructions for agents working on the Kiana Agent project, including development workflows, testing procedures, and documentation conventions.

## 🚀 Quick Start for Agents

### Development Environment Setup

1. **Use Bun (Preferred)** - This project is optimized for Bun
   ```bash
   # Install Bun if not already installed
   curl -fsSL https://bun.sh/install | bash
   
   # Verify installation
   bun --version
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Build the Project**
   ```bash
   bun run build
   ```

4. **Run Tests**
   ```bash
   bun test
   ```

### Alternative: Using npm/yarn
If Bun is not available, you can use npm/yarn, but Bun is strongly preferred:
```bash
npm install
npm run build
npm test
```

## 🧪 Testing Guidelines

### Running Tests with Bun

**Primary test command (use this):**
```bash
bun test
```

**Run specific test files:**
```bash
bun test lib/test/CommandParser.test.js
bun test lib/test/v6-compatibility.test.js
```

**Run tests with coverage:**
```bash
bun test --coverage
```

**Run tests in watch mode:**
```bash
bun test --watch
```

### Testing with Real ARK Models (.env)

To test with real ARK LLM models, set up your environment:

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env with your ARK credentials:**
   ```env
   ARK_API_KEY=your-actual-ark-api-key
   ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
   ARK_MODEL_ID=doubao-pro-32k
   MAX_ROUNDS=10
   VERBOSE=true
   STREAM=false
   ```

3. **Validate your ARK setup:**
   ```bash
   bun run examples/validate-ark-setup.js
   ```

4. **Run tests with real models:**
   ```bash
   # This will run V6 compatibility tests with real ARK models
   bun test lib/test/v6-compatibility.test.js
   ```

### Testing without Real Models (Default)

If you don't have ARK credentials, tests will automatically skip API-dependent tests:
```bash
# This runs all tests that don't require API calls
bun test
```

### Test Structure

- **Unit Tests**: `lib/test/*.test.js` - Compiled from TypeScript sources
- **Integration Tests**: Test file system operations, command parsing, etc.
- **Compatibility Tests**: V6 agent compatibility with real models
- **Utility Tests**: Standalone test utilities for edge cases

### Writing New Tests

1. **Create TypeScript test file:**
   ```typescript
   // test/MyFeature.test.ts
   import { expect } from 'chai';
   import { MyFeature } from '../src/MyFeature';
   
   describe('MyFeature', () => {
     it('should do something', () => {
       const result = new MyFeature().doSomething();
       expect(result).to.equal('expected');
     });
   });
   ```

2. **Build and run:**
   ```bash
   bun run build
   bun test lib/test/MyFeature.test.js
   ```

## 📚 Documentation Conventions

### File Naming Convention

**Format**: `docs/YYYYMMDD_description.md`

**Examples**:
- `docs/20251110_ARK_SETUP.md` - ARK setup guide
- `docs/20251110_MIGRATION_SUMMARY.md` - Migration summary
- `docs/20251110_AI_SDK_V6.md` - AI SDK v6 documentation

### Documentation Structure

Each documentation file should include:

1. **Header with date and topic**
   ```markdown
   # Topic Name
   *Date: YYYY-MM-DD*
   
   Brief description of what this document covers.
   ```

2. **Table of Contents** (for longer docs)
   ```markdown
   ## Table of Contents
   - [Section 1](#section-1)
   - [Section 2](#section-2)
   ```

3. **Clear sections with headers**
   ```markdown
   ## 🚀 Quick Start
   ## 📋 Configuration
   ## 🛠️ Usage Examples
   ## ⚠️ Troubleshooting
   ```

4. **Code examples with language tags**
   ```markdown
   ```bash
   # Shell commands
   bun test
   ```
   
   ```javascript
   // JavaScript/TypeScript examples
   const result = await runKianaV6(options, memtools, writer);
   ```
   ```

### Documentation Types

1. **Setup Guides** (`*_SETUP.md`)
   - Step-by-step configuration
   - Environment setup
   - Prerequisites
   - Validation steps

2. **Usage Examples** (`*_EXAMPLES.md`)
   - Code examples
   - Different use cases
   - Best practices

3. **Migration Guides** (`*_MIGRATION.md`)
   - Before/after comparisons
   - Breaking changes
   - Migration steps

4. **Technical Docs** (`*_TECHNICAL.md`)
   - Architecture decisions
   - Implementation details
   - Performance considerations

5. **Complete Documentation** (No summary files)
   - Write comprehensive documentation that stands alone
   - Avoid creating separate summary files after completing tasks
   - Include all necessary information in the main documentation file

## 🔧 Development Workflow

### Making Changes

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes in TypeScript:**
   ```bash
   # Edit files in src/ directory
   nano src/YourFeature.ts
   ```

3. **Build and test:**
   ```bash
   bun run build
   bun test
   ```

4. **Run specific tests:**
   ```bash
   bun test lib/test/YourFeature.test.js
   ```

### Code Quality Checks

Before committing:

1. **Build successfully:**
   ```bash
   bun run build
   ```

2. **All tests pass:**
   ```bash
   bun test
   ```

3. **TypeScript compilation clean:**
   ```bash
   bunx tsc --noEmit
   ```

### Commit Messages

Use conventional commits:
```
feat: add ARK model support
test: add command substitution edge cases
docs: update ARK setup guide
fix: resolve import path issues
```

## 📋 Project Structure

```
kiana/
├── src/                    # TypeScript source files
│   ├── KianaAgentV6.ts    # V6 agent implementation
│   ├── MemTools.ts        # Memory tools
│   └── ...
├── lib/                    # Compiled JavaScript (generated)
│   ├── KianaAgentV6.js    # Compiled agent
│   ├── MemTools.js        # Compiled tools
│   └── ...
├── test/                   # Test files
│   ├── *.test.ts          # TypeScript test sources
│   └── test_*.ts          # Test utility scripts
├── lib/test/               # Compiled tests (generated)
├── examples/               # Usage examples
├── docs/                   # Documentation
├── bin/                    # CLI executables
└── AGENTS.md              # This file
```

## 🌍 Environment Variables

### Required for ARK Testing
```env
ARK_API_KEY=your-ark-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_ID=doubao-pro-32k
```

### Optional Configuration
```env
MAX_ROUNDS=20          # Maximum conversation rounds
VERBOSE=true           # Enable detailed logging
STREAM=false           # Enable streaming responses
OPENAI_API_KEY=...     # Fallback API key
DEBUG=false            # Debug mode
```

## 🚨 Common Issues and Solutions

### Import Path Issues
**Problem**: `Cannot find module '../lib/...'`
**Solution**: Ensure imports point to `../src/` in TypeScript files, not `../lib/`

### Build Failures
**Problem**: TypeScript compilation errors
**Solution**: 
- Check import paths
- Verify all dependencies are installed
- Run `bun run build` to see specific errors

### Test Failures
**Problem**: Tests fail with API errors
**Solution**: 
- Without ARK credentials: Expected behavior, tests will skip API calls
- With ARK credentials: Check validation script `node examples/validate-ark-setup.js`

### Missing Environment Variables
**Problem**: "ARK_API_KEY not found"
**Solution**: Copy `.env.example` to `.env` and fill in your credentials

## 📞 Getting Help

If you encounter issues:

1. **Check this guide** for common solutions
2. **Run validation**: `node examples/validate-ark-setup.js`
3. **Check build**: `bun run build`
4. **Run tests**: `bun test`
5. **Review examples**: Check `examples/` directory

## 🎯 Agent Success Checklist

Before marking work as complete:

- [ ] Code builds successfully with `bun run build`
- [ ] All tests pass with `bun test`
- [ ] TypeScript compilation is clean
- [ ] Documentation follows naming convention (`docs/YYYYMMDD_description.md`)
- [ ] Documentation is comprehensive and doesn't require separate summary files
- [ ] Examples work correctly
- [ ] ARK validation passes (if applicable)
- [ ] Code follows project conventions
- [ ] Commit messages are descriptive

---

**Happy coding with Kiana Agent!** 🤖✨