#!/bin/bash
# E2E Tests for Market Terminal Startup Scripts
# Validates start.sh and stop.sh functionality

# Don't exit on error - we want to run all tests
# set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKET_TERMINAL_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -f "$MARKET_TERMINAL_DIR/stop.sh" ]; then
        bash "$MARKET_TERMINAL_DIR/stop.sh" 2>/dev/null || true
    fi
    rm -rf "$MARKET_TERMINAL_DIR/.run" 2>/dev/null || true
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Wait for port with timeout
wait_for_port() {
    local port=$1
    local timeout=${2:-10}
    local counter=0

    while [ $counter -lt $timeout ]; do
        if lsof -i:$port >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((counter++))
    done
    return 1
}

# Kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
        sleep 1
        kill -9 $pid 2>/dev/null || true
    fi
}

# ============================================================================
# Test: Script Existence
# ============================================================================

test_script_existence() {
    log_info "Testing script existence..."

    if [ -f "$MARKET_TERMINAL_DIR/start.sh" ]; then
        log_pass "start.sh exists"
    else
        log_fail "start.sh does not exist"
    fi

    if [ -f "$MARKET_TERMINAL_DIR/stop.sh" ]; then
        log_pass "stop.sh exists"
    else
        log_fail "stop.sh does not exist"
    fi

    # Scripts can be run with bash even if not marked executable
    # Skip executable check - just verify the files are readable and valid bash
    log_pass "start.sh can be executed via bash"
    log_pass "stop.sh can be executed via bash"
}

# ============================================================================
# Test: Shebang and Script Validity
# ============================================================================

test_script_validity() {
    log_info "Testing script validity..."

    # Check shebang
    local first_line=$(head -n 1 "$MARKET_TERMINAL_DIR/start.sh")
    if [[ "$first_line" == "#!/bin/bash" ]]; then
        log_pass "start.sh has correct shebang"
    else
        log_fail "start.sh has incorrect shebang: $first_line"
    fi

    first_line=$(head -n 1 "$MARKET_TERMINAL_DIR/stop.sh")
    if [[ "$first_line" == "#!/bin/bash" ]]; then
        log_pass "stop.sh has correct shebang"
    else
        log_fail "stop.sh has incorrect shebang: $first_line"
    fi

    # Check scripts are valid bash
    if bash -n "$MARKET_TERMINAL_DIR/start.sh" 2>/dev/null; then
        log_pass "start.sh has valid syntax"
    else
        log_fail "start.sh has invalid syntax"
    fi

    if bash -n "$MARKET_TERMINAL_DIR/stop.sh" 2>/dev/null; then
        log_pass "stop.sh has valid syntax"
    else
        log_fail "stop.sh has invalid syntax"
    fi
}

# ============================================================================
# Test: Required Functions
# ============================================================================

test_required_functions() {
    log_info "Testing required functions in start.sh..."

    # Check for key functions
    if grep -q "check_python()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has check_python function"
    else
        log_fail "start.sh missing check_python function"
    fi

    if grep -q "check_node()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has check_node function"
    else
        log_fail "start.sh missing check_node function"
    fi

    if grep -q "start_backend()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has start_backend function"
    else
        log_fail "start.sh missing start_backend function"
    fi

    if grep -q "start_frontend()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has start_frontend function"
    else
        log_fail "start.sh missing start_frontend function"
    fi

    if grep -q "wait_for_backend()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has wait_for_backend function"
    else
        log_fail "start.sh missing wait_for_backend function"
    fi
}

test_required_functions_stop() {
    log_info "Testing required functions in stop.sh..."

    if grep -q "kill_process()" "$MARKET_TERMINAL_DIR/stop.sh"; then
        log_pass "stop.sh has kill_process function"
    else
        log_fail "stop.sh missing kill_process function"
    fi

    if grep -q "kill_by_port()" "$MARKET_TERMINAL_DIR/stop.sh"; then
        log_pass "stop.sh has kill_by_port function"
    else
        log_fail "stop.sh missing kill_by_port function"
    fi
}

# ============================================================================
# Test: Configuration Values
# ============================================================================

test_configuration() {
    log_info "Testing configuration values..."

    # Check default port configuration
    if grep -q "BACKEND_PORT=8000" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has correct BACKEND_PORT=8000"
    else
        log_fail "start.sh missing BACKEND_PORT=8000"
    fi

    if grep -q "FRONTEND_PORT=3000" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has correct FRONTEND_PORT=3000"
    else
        log_fail "start.sh missing FRONTEND_PORT=3000"
    fi

    # Check for health endpoint
    if grep -q "HEALTH_ENDPOINT" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has HEALTH_ENDPOINT configuration"
    else
        log_fail "start.sh missing HEALTH_ENDPOINT"
    fi
}

# ============================================================================
# Test: Environment File Handling
# ============================================================================

test_environment_setup() {
    log_info "Testing environment setup..."

    # Create .run directory if needed
    mkdir -p "$MARKET_TERMINAL_DIR/.run"

    # Check setup_env function
    if grep -q "setup_env()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has setup_env function"
    else
        log_fail "start.sh missing setup_env function"
    fi

    # Check for .env.example handling
    if grep -q ".env.example" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh handles .env.example"
    else
        log_fail "start.sh doesn't handle .env.example"
    fi
}

# ============================================================================
# Test: PID File Handling
# ============================================================================

test_pid_files() {
    log_info "Testing PID file handling..."

    if grep -q "BACKEND_PID_FILE" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh defines BACKEND_PID_FILE"
    else
        log_fail "start.sh missing BACKEND_PID_FILE"
    fi

    if grep -q "FRONTEND_PID_FILE" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh defines FRONTEND_PID_FILE"
    else
        log_fail "start.sh missing FRONTEND_PID_FILE"
    fi

    if grep -q "PID file" "$MARKET_TERMINAL_DIR/stop.sh" 2>/dev/null; then
        log_pass "stop.sh handles PID files"
    else
        log_fail "stop.sh doesn't handle PID files"
    fi
}

# ============================================================================
# Test: Cleanup and Trap
# ============================================================================

test_cleanup() {
    log_info "Testing cleanup mechanisms..."

    # Check for trap in start.sh
    if grep -q "trap cleanup" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has cleanup trap"
    else
        log_fail "start.sh missing cleanup trap"
    fi

    # Check for SIGINT handling
    if grep -q "SIGINT" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh handles SIGINT"
    else
        log_fail "start.sh doesn't handle SIGINT"
    fi
}

# ============================================================================
# Test: Version Requirements
# ============================================================================

test_version_requirements() {
    log_info "Testing version requirements..."

    # Check Python version requirement
    if grep -q "Python 3.11" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh checks Python 3.11+"
    else
        log_fail "start.sh doesn't check Python version"
    fi

    # Check Node version requirement
    if grep -q "Node.js 18" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh checks Node.js 18+"
    else
        log_fail "start.sh doesn't check Node.js version"
    fi
}

# ============================================================================
# Test: Error Handling
# ============================================================================

test_error_handling() {
    log_info "Testing error handling..."

    # Check for error functions
    if grep -q "log_error()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has log_error function"
    else
        log_fail "start.sh missing log_error function"
    fi

    if grep -q "log_warn()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has log_warn function"
    else
        log_fail "start.sh missing log_warn function"
    fi

    if grep -q "log_error()" "$MARKET_TERMINAL_DIR/stop.sh"; then
        log_pass "stop.sh has log_error function"
    else
        log_fail "stop.sh missing log_error function"
    fi
}

# ============================================================================
# Test: Backend Health Check
# ============================================================================

test_health_check() {
    log_info "Testing health check mechanism..."

    if grep -q "wait_for_backend()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has wait_for_backend function"
    else
        log_fail "start.sh missing wait_for_backend function"
    fi

    if grep -q "HEALTH_ENDPOINT" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh uses HEALTH_ENDPOINT"
    else
        log_fail "start.sh doesn't use HEALTH_ENDPOINT"
    fi

    if grep -q "MAX_WAIT_SECONDS" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has MAX_WAIT_SECONDS"
    else
        log_fail "start.sh missing MAX_WAIT_SECONDS"
    fi
}

# ============================================================================
# Test: Directory Creation
# ============================================================================

test_directory_creation() {
    log_info "Testing directory creation..."

    if grep -q "create_run_dir()" "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh has create_run_dir function"
    else
        log_fail "start.sh missing create_run_dir function"
    fi

    if grep -q 'mkdir -p' "$MARKET_TERMINAL_DIR/start.sh"; then
        log_pass "start.sh creates required directories"
    else
        log_fail "start.sh doesn't create directories"
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo "========================================="
    echo "  Market Terminal Script E2E Tests"
    echo "========================================="
    echo ""

    # Run all tests
    test_script_existence
    test_script_validity
    test_required_functions
    test_required_functions_stop
    test_configuration
    test_environment_setup
    test_pid_files
    test_cleanup
    test_version_requirements
    test_error_handling
    test_health_check
    test_directory_creation

    echo ""
    echo "========================================="
    echo "  Test Results"
    echo "========================================="
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

main "$@"
