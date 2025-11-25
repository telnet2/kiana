.PHONY: help install build clean test test-unit test-all watch lint format check dev publish

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Installation

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

##@ Build

build: ## Build TypeScript to JavaScript
	@echo "$(BLUE)Building TypeScript...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf lib/
	rm -rf dist/
	rm -rf coverage/
	rm -rf .nyc_output/
	@echo "$(GREEN)✓ Clean complete$(NC)"

rebuild: clean build ## Clean and rebuild

watch: ## Watch for changes and rebuild
	@echo "$(BLUE)Watching for changes...$(NC)"
	npx tsc -p tsconfig.json --watch

##@ Testing

test: build ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm test
	@echo "$(GREEN)✓ All tests passed$(NC)"

test-unit: build ## Run unit tests only (*.test.js)
	@echo "$(BLUE)Running unit tests...$(NC)"
	npx mocha test/*.test.js
	@echo "$(GREEN)✓ Unit tests passed$(NC)"

test-only: ## Run tests without rebuilding
	@echo "$(BLUE)Running tests (no build)...$(NC)"
	npx mocha test/*.test.js
	@echo "$(GREEN)✓ Tests passed$(NC)"

test-all: build ## Run all tests including test_*.js files
	@echo "$(BLUE)Running all tests...$(NC)"
	npx mocha test/*.test.js
	npx mocha test/test_*.js
	@echo "$(GREEN)✓ All tests passed$(NC)"

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	npx mocha test/*.test.js --watch

test-coverage: build ## Run tests with coverage
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npx nyc --reporter=html --reporter=text npx mocha test/*.test.js
	@echo "$(GREEN)✓ Coverage report generated$(NC)"
	@echo "$(YELLOW)Open coverage/index.html to view the report$(NC)"

##@ Code Quality

lint: ## Lint TypeScript files
	@echo "$(BLUE)Linting code...$(NC)"
	@if command -v eslint > /dev/null; then \
		eslint src/**/*.ts; \
		echo "$(GREEN)✓ Linting complete$(NC)"; \
	else \
		echo "$(YELLOW)⚠ ESLint not installed, skipping...$(NC)"; \
	fi

format: ## Format code with prettier
	@echo "$(BLUE)Formatting code...$(NC)"
	@if command -v prettier > /dev/null; then \
		prettier --write "src/**/*.ts" "test/**/*.js"; \
		echo "$(GREEN)✓ Code formatted$(NC)"; \
	else \
		echo "$(YELLOW)⚠ Prettier not installed, skipping...$(NC)"; \
	fi

check: ## Type check without emitting files
	@echo "$(BLUE)Type checking...$(NC)"
	npx tsc --noEmit
	@echo "$(GREEN)✓ Type check passed$(NC)"

##@ Development

dev: ## Start development mode (watch + memsh)
	@echo "$(BLUE)Starting development mode...$(NC)"
	@echo "$(YELLOW)Run 'make watch' in another terminal to auto-rebuild$(NC)"
	./bin/memsh

repl: build ## Start memsh REPL
	@echo "$(BLUE)Starting MemShell REPL...$(NC)"
	./bin/memsh

examples: build ## Run example files
	@echo "$(BLUE)Running examples...$(NC)"
	@echo "$(YELLOW)Available examples:$(NC)"
	@ls -1 examples/*.js | sed 's/^/  /'
	@echo ""
	@echo "$(YELLOW)Run with: node examples/<filename>$(NC)"

##@ Release

version-patch: ## Bump patch version (0.0.x)
	@echo "$(BLUE)Bumping patch version...$(NC)"
	npm version patch
	@echo "$(GREEN)✓ Version bumped$(NC)"

version-minor: ## Bump minor version (0.x.0)
	@echo "$(BLUE)Bumping minor version...$(NC)"
	npm version minor
	@echo "$(GREEN)✓ Version bumped$(NC)"

version-major: ## Bump major version (x.0.0)
	@echo "$(BLUE)Bumping major version...$(NC)"
	npm version major
	@echo "$(GREEN)✓ Version bumped$(NC)"

prepublish: clean build test ## Prepare for publishing (clean, build, test)
	@echo "$(GREEN)✓ Ready to publish$(NC)"
	@echo "$(YELLOW)Run 'npm publish' to publish the package$(NC)"

publish: prepublish ## Publish to npm
	@echo "$(BLUE)Publishing to npm...$(NC)"
	npm publish
	@echo "$(GREEN)✓ Published!$(NC)"

##@ Utilities

tree: ## Show project structure
	@echo "$(BLUE)Project structure:$(NC)"
	@tree -L 2 -I 'node_modules|.git|lib|coverage' . || ls -R

info: ## Show project information
	@echo "$(BLUE)Project Information:$(NC)"
	@echo "  Name:        $$(node -p "require('./package.json').name")"
	@echo "  Version:     $$(node -p "require('./package.json').version")"
	@echo "  Description: $$(node -p "require('./package.json').description")"
	@echo ""
	@echo "$(BLUE)Statistics:$(NC)"
	@echo "  Source files:     $$(find src -name '*.ts' | wc -l | xargs)"
	@echo "  Test files:       $$(find test -name '*.js' | wc -l | xargs)"
	@echo "  Example files:    $$(find examples -name '*.js' | wc -l | xargs)"
	@echo ""
	@echo "$(BLUE)Dependencies:$(NC)"
	@echo "  Production:  $$(node -p "Object.keys(require('./package.json').dependencies || {}).length")"
	@echo "  Development: $$(node -p "Object.keys(require('./package.json').devDependencies || {}).length")"

verify: ## Verify project setup
	@echo "$(BLUE)Verifying project setup...$(NC)"
	@echo -n "  Node.js:     "
	@node --version
	@echo -n "  npm:         "
	@npm --version
	@echo -n "  TypeScript:  "
	@npx tsc --version
	@echo ""
	@echo "$(BLUE)Checking required files...$(NC)"
	@test -f package.json && echo "  $(GREEN)✓$(NC) package.json" || echo "  $(RED)✗$(NC) package.json"
	@test -f tsconfig.json && echo "  $(GREEN)✓$(NC) tsconfig.json" || echo "  $(RED)✗$(NC) tsconfig.json"
	@test -f index.js && echo "  $(GREEN)✓$(NC) index.js" || echo "  $(RED)✗$(NC) index.js"
	@test -d src && echo "  $(GREEN)✓$(NC) src/" || echo "  $(RED)✗$(NC) src/"
	@test -d test && echo "  $(GREEN)✓$(NC) test/" || echo "  $(RED)✗$(NC) test/"
	@test -d bin && echo "  $(GREEN)✓$(NC) bin/" || echo "  $(RED)✗$(NC) bin/"
	@echo "$(GREEN)✓ Verification complete$(NC)"

##@ Quick Commands

all: clean install build test ## Run full build pipeline (clean, install, build, test)
	@echo "$(GREEN)✓ Full build pipeline complete!$(NC)"

ci: clean build test ## CI/CD pipeline (clean, build, test)
	@echo "$(GREEN)✓ CI pipeline complete!$(NC)"

quick: build test-unit ## Quick build and test
	@echo "$(GREEN)✓ Quick build complete!$(NC)"
