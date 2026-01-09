# Xahau Chess Wagering Hook

This directory contains the Xahau Hook code for the chess wagering system.

## Overview

The chess wagering Hook handles:
- 1v1 tournament entry payments (10 XAH)
- Waiting room management
- Chess move validation
- Prize distribution (85% to winner, 15% rake)
- Game timeouts and forfeits

## Files

- `chess-wagering.c` - Main Hook implementation
- `chess-logic.c` - Chess move validation logic
- `Makefile` - Compilation instructions
- `deploy-hook.sh` - Deployment script

## Quick Start

1. Install Hook development tools
2. Compile: `make chess-wagering.wasm`
3. Deploy: `./deploy-hook.sh`
4. Update frontend with Hook address

See `../docs/HOOK_DEPLOYMENT.md` for detailed instructions.

## State Structure

The Hook uses these namespace keys:
- `0x01` - Active games
- `0x02` - Waiting room
- `0x03` - Player profiles
- `0xFF` - Global statistics

## Transaction Flow

1. Player sends 10 XAH payment with JOIN memo
2. Hook adds player to waiting room
3. When 2 players ready, game starts
4. Players submit moves via Invoke transactions
5. Hook validates moves and updates board
6. On game end, Hook distributes prizes automatically