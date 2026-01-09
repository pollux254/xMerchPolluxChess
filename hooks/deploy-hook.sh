#!/bin/bash

# Xahau Hook Deployment Script
# Deploys chess-wagering.wasm to Xahau network

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HOOK_WASM_FILE="${1:-chess-wagering.wasm}"
NETWORK="${2:-testnet}"  # testnet or mainnet
HOOK_ACCOUNT="${HOOK_ACCOUNT:-}"
HOOK_SECRET="${HOOK_SECRET:-}"

echo -e "${BLUE}🚀 Xahau Chess Hook Deployment${NC}"
echo "=================================="

# Validate inputs
if [ ! -f "$HOOK_WASM_FILE" ]; then
    echo -e "${RED}❌ Error: WASM file not found: $HOOK_WASM_FILE${NC}"
    echo "Run 'make all' first to compile the Hook"
    exit 1
fi

if [ -z "$HOOK_ACCOUNT" ]; then
    echo -e "${RED}❌ Error: HOOK_ACCOUNT environment variable not set${NC}"
    echo "Set your Hook account address:"
    echo "export HOOK_ACCOUNT='rYourHookAccountAddress...'"
    exit 1
fi

if [ -z "$HOOK_SECRET" ]; then
    echo -e "${RED}❌ Error: HOOK_SECRET environment variable not set${NC}"
    echo "Set your Hook account secret:"
    echo "export HOOK_SECRET='sYourHookAccountSecret...'"
    echo -e "${YELLOW}⚠️  Keep your secret secure and never commit it to git!${NC}"
    exit 1
fi

# Network configuration
if [ "$NETWORK" = "mainnet" ]; then
    XAHAU_SERVER="wss://xahau.network"
    echo -e "${YELLOW}⚠️  Deploying to MAINNET - this will cost real XAH!${NC}"
elif [ "$NETWORK" = "testnet" ]; then
    XAHAU_SERVER="wss://xahau-test.net"
    echo -e "${GREEN}✅ Deploying to testnet${NC}"
else
    echo -e "${RED}❌ Error: Invalid network '$NETWORK'. Use 'testnet' or 'mainnet'${NC}"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  WASM File: $HOOK_WASM_FILE"
echo "  Network: $NETWORK"
echo "  Server: $XAHAU_SERVER"
echo "  Hook Account: $HOOK_ACCOUNT"
echo ""

# Check file size
WASM_SIZE=$(stat -c%s "$HOOK_WASM_FILE")
echo "WASM file size: $WASM_SIZE bytes"

if [ $WASM_SIZE -gt 65536 ]; then
    echo -e "${YELLOW}⚠️  Warning: WASM file is large (>64KB). This may increase deployment cost.${NC}"
fi

# Confirm deployment
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}📦 Preparing Hook deployment...${NC}"

# Convert WASM to hex
echo "Converting WASM to hex..."
WASM_HEX=$(xxd -p "$HOOK_WASM_FILE" | tr -d '\n')
echo "Hex length: ${#WASM_HEX} characters"

# Check if xrpl-cli is available
if ! command -v xrpl-cli &> /dev/null; then
    echo -e "${YELLOW}⚠️  xrpl-cli not found. Using manual deployment method...${NC}"
    
    # Create deployment transaction JSON
    cat > hook-deploy.json << EOF
{
  "TransactionType": "SetHook",
  "Account": "$HOOK_ACCOUNT",
  "Hooks": [
    {
      "Hook": {
        "CreateCode": "$WASM_HEX",
        "HookOn": "0000000000000000",
        "HookNamespace": "0000000000000000000000000000000000000000000000000000000000000000",
        "HookApiVersion": 0
      }
    }
  ],
  "NetworkID": $([ "$NETWORK" = "mainnet" ] && echo "21337" || echo "21338"),
  "Fee": "1000000"
}
EOF

    echo ""
    echo -e "${GREEN}✅ Deployment transaction created: hook-deploy.json${NC}"
    echo ""
    echo "Manual deployment steps:"
    echo "1. Sign the transaction in hook-deploy.json with your Hook account"
    echo "2. Submit to $XAHAU_SERVER"
    echo "3. Wait for confirmation"
    echo ""
    echo "Or use a tool like xrpl-py or xrpl-js to submit the transaction."
    
else
    # Use xrpl-cli for deployment
    echo -e "${BLUE}🚀 Deploying Hook with xrpl-cli...${NC}"
    
    xrpl-cli hook set \
        --account "$HOOK_ACCOUNT" \
        --secret "$HOOK_SECRET" \
        --wasm "$HOOK_WASM_FILE" \
        --server "$XAHAU_SERVER" \
        --network-id $([ "$NETWORK" = "mainnet" ] && echo "21337" || echo "21338")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Hook deployed successfully!${NC}"
    else
        echo -e "${RED}❌ Hook deployment failed${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🎉 Deployment process complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait for transaction confirmation"
echo "2. Update .env.local with Hook account address:"
echo "   NEXT_PUBLIC_HOOK_ADDRESS=\"$HOOK_ACCOUNT\""
echo "3. Test Hook functionality with frontend"
echo "4. Monitor Hook state and transactions"
echo ""
echo "Useful commands:"
echo "  # Check Hook state"
echo "  xrpl-cli account info --account $HOOK_ACCOUNT --server $XAHAU_SERVER"
echo ""
echo "  # Monitor Hook transactions"
echo "  xrpl-cli account tx --account $HOOK_ACCOUNT --server $XAHAU_SERVER"
echo ""

# Clean up
if [ -f "hook-deploy.json" ]; then
    echo "Deployment file saved: hook-deploy.json"
    echo -e "${YELLOW}⚠️  This file contains your Hook code. Keep it secure.${NC}"
fi

echo -e "${BLUE}🏁 Hook deployment script finished${NC}"