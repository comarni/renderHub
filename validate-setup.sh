#!/bin/bash
# Validation script for RenderHub Image-to-3D pipeline
# Tests all three components: Frontend, Backend, TripoSR
# Usage: bash validate-setup.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     RenderHub Image-to-3D Validation Script    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
check_service() {
    local name=$1
    local url=$2
    local retries=${3:-3}
    local delay=${4:-2}
    
    echo -n "Checking $name... "
    
    for i in $(seq 1 $retries); do
        if response=$(curl -s -f "$url" 2>/dev/null); then
            echo -e "${GREEN}✓ OK${NC}"
            echo "  Response: $(echo "$response" | head -c 50)..."
            ((PASS++))
            return 0
        fi
        
        if [ $i -lt $retries ]; then
            echo -n "retry $i/$((retries-1))... "
            sleep $delay
        fi
    done
    
    echo -e "${RED}✗ FAILED${NC}"
    ((FAIL++))
    return 1
}

check_command() {
    local cmd=$1
    local name=$2
    
    echo -n "Checking $name... "
    if command -v "$cmd" &> /dev/null; then
        version=$("$cmd" --version 2>&1 | head -1)
        echo -e "${GREEN}✓${NC} ($version)"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ NOT FOUND${NC}"
        ((FAIL++))
        return 1
    fi
}

check_file() {
    local path=$1
    local name=$2
    
    echo -n "Checking $name... "
    if [ -f "$path" ]; then
        size=$(ls -lh "$path" | awk '{print $5}')
        echo -e "${GREEN}✓${NC} ($size)"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ NOT FOUND${NC}"
        ((FAIL++))
        return 1
    fi
}

# Tests
echo -e "${YELLOW}[1/5] System Dependencies${NC}"
echo "─────────────────────────────────────"
check_command "node" "Node.js"
check_command "python3" "Python 3"
check_command "python" "Python (alias)"
echo ""

echo -e "${YELLOW}[2/5] Project Files${NC}"
echo "─────────────────────────────────────"
check_file "./ai-server/server.js" "ai-server/server.js"
check_file "./ai-server/tripo-sr-wrapper/app.py" "TripoSR wrapper (app.py)"
check_file "./3d-editor/app.js" "3D Editor (app.js)"
check_file "./ai-server/.env.example" ".env.example"
echo ""

echo -e "${YELLOW}[3/5] Backend Health (Node.js)${NC}"
echo "─────────────────────────────────────"
check_service "AI Server" "http://127.0.0.1:8787/api/ai/health" 3 2
echo ""

echo -e "${YELLOW}[4/5] TripoSR Service (Python)${NC}"
echo "─────────────────────────────────────"
check_service "TripoSR Health" "http://127.0.0.1:9000/api/v1/health" 3 2
check_service "TripoSR Demo Health" "http://127.0.0.1:9000/health" 2 1
echo ""

echo -e "${YELLOW}[5/5] Network Connectivity${NC}"
echo "─────────────────────────────────────"

# Test backend can reach TripoSR
if [ $FAIL -eq 0 ]; then
    echo -n "Testing Backend → TripoSR routing... "
    if response=$(curl -s -f "http://127.0.0.1:8787/api/ai/health"); then
        if echo "$response" | grep -q "upstream\|mock"; then
            echo -e "${GREEN}✓${NC}"
            echo "  Backend mode detected"
            ((PASS++))
        else
            echo -e "${YELLOW}⚠${NC} Backend responding but no mode"
            ((WARN++))
        fi
    else
        echo -e "${RED}✗${NC} Backend not responding"
        ((FAIL++))
    fi
    echo ""
fi

# Summary
echo "─────────────────────────────────────"
echo -e "${BLUE}Summary:${NC}"
echo -e "  ${GREEN}Pass:${NC} $PASS"
echo -e "  ${RED}Fail:${NC} $FAIL"
echo -e "  ${YELLOW}Warn:${NC} $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All systems operational!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open http://localhost:5500 (frontend)"
    echo "  2. Click 'Image→3D AI' or drag an image"
    echo "  3. Wait 15-45 seconds for TripoSR to process"
    echo "  4. View generated 3D model in editor"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. See above.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Terminal 1: cd ai-server && npm run dev"
    echo "  - Terminal 2: cd ai-server/tripo-sr-wrapper && python app.py"
    echo "  - Terminal 3: cd 3d-editor && npx http-server . -p 5500"
    echo ""
    exit 1
fi
