# Xahau Hook Makefile
# Compiles chess-wagering.c to WebAssembly

# Hook development tools (install these first)
HOOK_TOOLCHAIN ?= /opt/hook-toolchain
CLANG = $(HOOK_TOOLCHAIN)/bin/clang
WASM_LD = $(HOOK_TOOLCHAIN)/bin/wasm-ld

# Compiler flags
CFLAGS = -O3 -std=c99 -Wno-unknown-warning-option -Wno-format \
         -Wno-deprecated-declarations -Wno-format-security \
         -fno-jump-tables -fno-common -fno-stack-protector \
         --target=wasm32 -nostdlib -fvisibility=hidden \
         -I$(HOOK_TOOLCHAIN)/include

# Linker flags
LDFLAGS = -O3 --no-entry --import-undefined --export-dynamic \
          --allow-undefined --compress-relocations \
          --strip-debug --gc-sections \
          -L$(HOOK_TOOLCHAIN)/lib

# Source files
SOURCES = chess-wagering.c chess-logic.c
TARGET = chess-wagering.wasm

# Default target
all: $(TARGET)

# Build the Hook WASM file

$(TARGET): $(SOURCES)
	@echo "🔨 Compiling Hook to WebAssembly..."
	$(CLANG) $(CFLAGS) -c chess-wagering.c -o chess-wagering.o
	$(CLANG) $(CFLAGS) -c chess-logic.c -o chess-logic.o
	$(WASM_LD) $(LDFLAGS) chess-wagering.o chess-logic.o -o $(TARGET)
	@echo "✅ Hook compiled successfully: $(TARGET)"
	@ls -la $(TARGET)

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -f *.o *.wasm
	@echo "✅ Clean complete"

# Install Hook development tools (Ubuntu/Debian)
install-tools:
	@echo "📦 Installing Hook development tools..."
	@echo "⚠️  This requires manual setup. Please follow these steps:"
	@echo ""
	@echo "1. Download Hook toolchain from Xahau documentation"
	@echo "2. Extract to /opt/hook-toolchain/"
	@echo "3. Ensure clang and wasm-ld are available"
	@echo ""
	@echo "Alternative: Use Docker container with Hook tools pre-installed"

# Validate Hook WASM file
validate: $(TARGET)
	@echo "🔍 Validating Hook WASM file..."
	@if [ -f $(TARGET) ]; then \
		echo "✅ WASM file exists: $(TARGET)"; \
		file $(TARGET); \
		wasm-objdump -h $(TARGET) 2>/dev/null || echo "⚠️  wasm-objdump not available"; \
	else \
		echo "❌ WASM file not found"; \
		exit 1; \
	fi

# Deploy Hook (requires Hook account and tools)
deploy: $(TARGET)
	@echo "🚀 Deploying Hook to Xahau..."
	@echo "⚠️  Manual deployment required. See ../docs/HOOK_DEPLOYMENT.md"
	@echo ""
	@echo "Quick deploy command:"
	@echo "./deploy-hook.sh $(TARGET)"

# Development server (for testing Hook logic)
dev:
	@echo "🔧 Development mode not implemented yet"
	@echo "Use Xahau testnet for Hook testing"

# Help
help:
	@echo "Xahau Chess Hook Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all          - Build Hook WASM file (default)"
	@echo "  clean        - Remove build artifacts"
	@echo "  validate     - Check WASM file integrity"
	@echo "  deploy       - Deploy Hook to Xahau"
	@echo "  install-tools- Install development tools"
	@echo "  help         - Show this help"
	@echo ""
	@echo "Requirements:"
	@echo "  - Hook toolchain installed in /opt/hook-toolchain/"
	@echo "  - Xahau account with XAH balance for deployment"
	@echo ""
	@echo "Example usage:"
	@echo "  make clean && make all && make validate"

.PHONY: all clean install-tools validate deploy dev help