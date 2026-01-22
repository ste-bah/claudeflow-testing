#!/bin/bash
#
# God Agent Backup/Restore Script
# Backs up all God Agent data including SQLite databases and vector embeddings
#
# Usage:
#   ./god-agent-backup.sh backup [archive-name]    # Create backup
#   ./god-agent-backup.sh restore <archive-path>   # Restore from backup
#   ./god-agent-backup.sh list                     # List available backups
#

set -e

# Configuration - Dynamic path detection for portability
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Data directories (all relative to PROJECT_DIR)
GOD_AGENT_DIR="${PROJECT_DIR}/.god-agent"
AGENTDB_DIR="${PROJECT_DIR}/.agentdb"
SWARM_DIR="${PROJECT_DIR}/.swarm"
SERENA_DIR="${PROJECT_DIR}/.serena"
PHD_SESSIONS_DIR="${PROJECT_DIR}/.phd-sessions"
CLAUDE_FLOW_DIR="${PROJECT_DIR}/.claude-flow"
HIVE_MIND_DIR="${PROJECT_DIR}/.hive-mind"

# Vector DB: Check inside project first, then external fallback (dev environment)
if [[ -d "${PROJECT_DIR}/vector_db_1536" ]]; then
    VECTOR_DB_DIR="${PROJECT_DIR}/vector_db_1536"
elif [[ -d "${PROJECT_DIR}/../vector_db_1536" ]]; then
    VECTOR_DB_DIR="$(cd "${PROJECT_DIR}/../vector_db_1536" && pwd)"
else
    VECTOR_DB_DIR="${PROJECT_DIR}/vector_db_1536"  # Will be created if missing
fi

BACKUP_DIR="${PROJECT_DIR}/backups/god-agent"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    echo "God Agent Backup/Restore Script"
    echo ""
    echo "Usage:"
    echo "  $0 backup [archive-name]    Create a backup archive"
    echo "  $0 restore <archive-path>   Restore from a backup archive"
    echo "  $0 list                     List available backups"
    echo "  $0 info <archive-path>      Show contents of a backup"
    echo ""
    echo "Examples:"
    echo "  $0 backup                           # Creates backup with timestamp"
    echo "  $0 backup pre-migration             # Creates god-agent-pre-migration.tar.gz"
    echo "  $0 restore backups/god-agent/god-agent-20231230_143000.tar.gz"
    echo ""
    echo "What gets backed up:"
    echo "  - .god-agent/           SQLite databases (learning.db, events.db, desc.db, etc.)"
    echo "  - .agentdb/             SONA trajectories, GNN weights, capability cache"
    echo "  - .swarm/               Swarm coordination (vectors.db, memory.db, patterns)"
    echo "  - .serena/              Serena MCP project memories"
    echo "  - .phd-sessions/        PhD pipeline session state"
    echo "  - .claude-flow/         Claude Flow memory and metrics"
    echo "  - .hive-mind/           Hive Mind swarm state and sessions"
    echo "  - vector_db_1536/       ChromaDB vector embeddings"
    echo ""
    echo "Note: This script auto-detects the project directory and works"
    echo "      on any GodAgent installation (fresh or development)."
    echo ""
}

check_running_daemons() {
    local daemons_running=0

    if pgrep -f "memory-daemon.ts" > /dev/null 2>&1; then
        log_warn "Memory daemon is running"
        daemons_running=1
    fi

    if pgrep -f "daemon-cli.ts start" > /dev/null 2>&1; then
        log_warn "Core daemon is running"
        daemons_running=1
    fi

    if pgrep -f "ucm-cli.ts start" > /dev/null 2>&1; then
        log_warn "UCM daemon is running"
        daemons_running=1
    fi

    if pgrep -f "chroma" > /dev/null 2>&1; then
        log_warn "ChromaDB is running"
        daemons_running=1
    fi

    return $daemons_running
}

do_backup() {
    local archive_name="${1:-god-agent-${TIMESTAMP}}"
    local archive_path="${BACKUP_DIR}/${archive_name}.tar.gz"

    log_info "Starting God Agent backup..."

    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_DIR}"

    # Check if daemons are running
    if check_running_daemons; then
        log_warn "Daemons are running. For a clean backup, consider stopping them first:"
        echo "  npm run god-agent:stop"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Backup cancelled"
            exit 0
        fi
    fi

    # Validate source directories
    if [[ ! -d "${GOD_AGENT_DIR}" ]]; then
        log_error ".god-agent directory not found at ${GOD_AGENT_DIR}"
        exit 1
    fi

    if [[ ! -d "${AGENTDB_DIR}" ]]; then
        log_warn ".agentdb directory not found at ${AGENTDB_DIR}"
        INCLUDE_AGENTDB=false
    else
        INCLUDE_AGENTDB=true
    fi

    if [[ ! -d "${SWARM_DIR}" ]]; then
        log_warn ".swarm directory not found at ${SWARM_DIR}"
        INCLUDE_SWARM=false
    else
        INCLUDE_SWARM=true
    fi

    if [[ ! -d "${SERENA_DIR}" ]]; then
        log_warn ".serena directory not found at ${SERENA_DIR}"
        INCLUDE_SERENA=false
    else
        INCLUDE_SERENA=true
    fi

    if [[ ! -d "${PHD_SESSIONS_DIR}" ]]; then
        log_warn ".phd-sessions directory not found"
        INCLUDE_PHD_SESSIONS=false
    else
        INCLUDE_PHD_SESSIONS=true
    fi

    if [[ ! -d "${CLAUDE_FLOW_DIR}" ]]; then
        log_warn ".claude-flow directory not found"
        INCLUDE_CLAUDE_FLOW=false
    else
        INCLUDE_CLAUDE_FLOW=true
    fi

    if [[ ! -d "${HIVE_MIND_DIR}" ]]; then
        log_warn ".hive-mind directory not found"
        INCLUDE_HIVE_MIND=false
    else
        INCLUDE_HIVE_MIND=true
    fi

    if [[ ! -d "${VECTOR_DB_DIR}" ]]; then
        log_warn "Vector DB directory not found at ${VECTOR_DB_DIR}"
        INCLUDE_VECTOR_DB=false
    else
        INCLUDE_VECTOR_DB=true
    fi

    # Calculate sizes
    log_info "Calculating backup size..."
    local god_agent_size=$(du -sh "${GOD_AGENT_DIR}" 2>/dev/null | cut -f1)
    log_info "  .god-agent: ${god_agent_size}"

    if [[ "${INCLUDE_AGENTDB}" == "true" ]]; then
        local agentdb_size=$(du -sh "${AGENTDB_DIR}" 2>/dev/null | cut -f1)
        log_info "  .agentdb: ${agentdb_size}"
    fi

    if [[ "${INCLUDE_SWARM}" == "true" ]]; then
        local swarm_size=$(du -sh "${SWARM_DIR}" 2>/dev/null | cut -f1)
        log_info "  .swarm: ${swarm_size}"
    fi

    if [[ "${INCLUDE_SERENA}" == "true" ]]; then
        local serena_size=$(du -sh "${SERENA_DIR}" 2>/dev/null | cut -f1)
        log_info "  .serena: ${serena_size}"
    fi

    if [[ "${INCLUDE_PHD_SESSIONS}" == "true" ]]; then
        local phd_size=$(du -sh "${PHD_SESSIONS_DIR}" 2>/dev/null | cut -f1)
        log_info "  .phd-sessions: ${phd_size}"
    fi

    if [[ "${INCLUDE_CLAUDE_FLOW}" == "true" ]]; then
        local claude_flow_size=$(du -sh "${CLAUDE_FLOW_DIR}" 2>/dev/null | cut -f1)
        log_info "  .claude-flow: ${claude_flow_size}"
    fi

    if [[ "${INCLUDE_HIVE_MIND}" == "true" ]]; then
        local hive_mind_size=$(du -sh "${HIVE_MIND_DIR}" 2>/dev/null | cut -f1)
        log_info "  .hive-mind: ${hive_mind_size}"
    fi

    if [[ "${INCLUDE_VECTOR_DB}" == "true" ]]; then
        local vector_db_size=$(du -sh "${VECTOR_DB_DIR}" 2>/dev/null | cut -f1)
        log_info "  vector_db_1536: ${vector_db_size}"
    fi

    # Create temporary directory for backup structure
    local temp_dir=$(mktemp -d)
    trap "rm -rf ${temp_dir}" EXIT

    log_info "Copying files to staging area..."

    # Copy .god-agent directory
    cp -r "${GOD_AGENT_DIR}" "${temp_dir}/god-agent"

    # Copy .agentdb directory (SONA trajectories, GNN, etc.)
    if [[ "${INCLUDE_AGENTDB}" == "true" ]]; then
        cp -r "${AGENTDB_DIR}" "${temp_dir}/agentdb"
    fi

    # Copy .swarm directory (swarm coordination)
    if [[ "${INCLUDE_SWARM}" == "true" ]]; then
        cp -r "${SWARM_DIR}" "${temp_dir}/swarm"
    fi

    # Copy .serena directory (project memories)
    if [[ "${INCLUDE_SERENA}" == "true" ]]; then
        cp -r "${SERENA_DIR}" "${temp_dir}/serena"
    fi

    # Copy .phd-sessions directory
    if [[ "${INCLUDE_PHD_SESSIONS}" == "true" ]]; then
        cp -r "${PHD_SESSIONS_DIR}" "${temp_dir}/phd-sessions"
    fi

    # Copy .claude-flow directory
    if [[ "${INCLUDE_CLAUDE_FLOW}" == "true" ]]; then
        cp -r "${CLAUDE_FLOW_DIR}" "${temp_dir}/claude-flow"
    fi

    # Copy .hive-mind directory
    if [[ "${INCLUDE_HIVE_MIND}" == "true" ]]; then
        cp -r "${HIVE_MIND_DIR}" "${temp_dir}/hive-mind"
    fi

    # Copy vector DB if it exists
    if [[ "${INCLUDE_VECTOR_DB}" == "true" ]]; then
        cp -r "${VECTOR_DB_DIR}" "${temp_dir}/vector_db_1536"
    fi

    # Create metadata file
    cat > "${temp_dir}/backup-metadata.json" << EOF
{
    "timestamp": "${TIMESTAMP}",
    "created_at": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "directories": {
        "god_agent": "${GOD_AGENT_DIR}",
        "agentdb": "${AGENTDB_DIR}",
        "swarm": "${SWARM_DIR}",
        "serena": "${SERENA_DIR}",
        "phd_sessions": "${PHD_SESSIONS_DIR}",
        "claude_flow": "${CLAUDE_FLOW_DIR}",
        "hive_mind": "${HIVE_MIND_DIR}",
        "vector_db": "${VECTOR_DB_DIR}"
    },
    "included": {
        "god_agent": true,
        "agentdb": ${INCLUDE_AGENTDB},
        "swarm": ${INCLUDE_SWARM},
        "serena": ${INCLUDE_SERENA},
        "phd_sessions": ${INCLUDE_PHD_SESSIONS},
        "claude_flow": ${INCLUDE_CLAUDE_FLOW},
        "hive_mind": ${INCLUDE_HIVE_MIND},
        "vector_db": ${INCLUDE_VECTOR_DB}
    },
    "databases": {
        "learning_db": $(stat -c%s "${GOD_AGENT_DIR}/learning.db" 2>/dev/null || echo 0),
        "events_db": $(stat -c%s "${GOD_AGENT_DIR}/events.db" 2>/dev/null || echo 0),
        "desc_db": $(stat -c%s "${GOD_AGENT_DIR}/desc.db" 2>/dev/null || echo 0),
        "swarm_memory_db": $(stat -c%s "${SWARM_DIR}/memory.db" 2>/dev/null || echo 0),
        "swarm_vectors_db": $(stat -c%s "${SWARM_DIR}/agentdb/vectors.db" 2>/dev/null || echo 0)
    },
    "learning_data": {
        "patterns": $(sqlite3 "${GOD_AGENT_DIR}/learning.db" "SELECT COUNT(*) FROM patterns" 2>/dev/null || echo 0),
        "trajectories": $(sqlite3 "${GOD_AGENT_DIR}/learning.db" "SELECT COUNT(*) FROM trajectory_metadata" 2>/dev/null || echo 0),
        "token_records": $(sqlite3 "${GOD_AGENT_DIR}/learning.db" "SELECT COUNT(*) FROM token_usage" 2>/dev/null || echo 0),
        "events": $(sqlite3 "${GOD_AGENT_DIR}/events.db" "SELECT COUNT(*) FROM events" 2>/dev/null || echo 0),
        "swarm_memories": $(sqlite3 "${SWARM_DIR}/memory.db" "SELECT COUNT(*) FROM memory" 2>/dev/null || echo 0),
        "serena_memories": $(find "${SERENA_DIR}/memories" -type f 2>/dev/null | wc -l || echo 0),
        "phd_sessions": $(find "${PHD_SESSIONS_DIR}" -name "*.json" -type f 2>/dev/null | wc -l || echo 0)
    }
}
EOF

    # Create the archive
    log_info "Creating archive: ${archive_path}"
    tar -czf "${archive_path}" -C "${temp_dir}" .

    # Show archive info
    local archive_size=$(du -sh "${archive_path}" | cut -f1)

    echo ""
    log_success "Backup complete!"
    echo ""
    echo "Archive: ${archive_path}"
    echo "Size: ${archive_size}"
    echo ""
    echo "Contents:"
    tar -tzf "${archive_path}" | head -20
    echo "..."
    echo ""
    echo "To restore: $0 restore ${archive_path}"
}

do_restore() {
    local archive_path="$1"

    if [[ -z "${archive_path}" ]]; then
        log_error "Please specify an archive to restore"
        show_usage
        exit 1
    fi

    if [[ ! -f "${archive_path}" ]]; then
        log_error "Archive not found: ${archive_path}"
        exit 1
    fi

    log_info "Starting God Agent restore from: ${archive_path}"

    # Check if daemons are running
    if check_running_daemons; then
        log_error "Daemons are still running. Please stop them first:"
        echo "  npm run god-agent:stop"
        exit 1
    fi

    # Show what will be restored
    echo ""
    log_warn "This will OVERWRITE the following directories (if present in backup):"
    echo "  - ${GOD_AGENT_DIR}"
    echo "  - ${AGENTDB_DIR}"
    echo "  - ${SWARM_DIR}"
    echo "  - ${SERENA_DIR}"
    echo "  - ${PHD_SESSIONS_DIR}"
    echo "  - ${CLAUDE_FLOW_DIR}"
    echo "  - ${HIVE_MIND_DIR}"
    echo "  - ${VECTOR_DB_DIR}"
    echo ""

    # Check for existing data
    if [[ -d "${GOD_AGENT_DIR}" ]] || [[ -d "${AGENTDB_DIR}" ]] || [[ -d "${SWARM_DIR}" ]] || [[ -d "${VECTOR_DB_DIR}" ]]; then
        read -p "Existing data will be replaced. Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi

    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    trap "rm -rf ${temp_dir}" EXIT

    log_info "Extracting archive..."
    tar -xzf "${archive_path}" -C "${temp_dir}"

    # Check metadata
    if [[ -f "${temp_dir}/backup-metadata.json" ]]; then
        log_info "Backup metadata:"
        cat "${temp_dir}/backup-metadata.json" | jq . 2>/dev/null || cat "${temp_dir}/backup-metadata.json"
        echo ""
    fi

    # Backup current data (just in case)
    if [[ -d "${GOD_AGENT_DIR}" ]]; then
        local pre_restore_backup="${BACKUP_DIR}/pre-restore-${TIMESTAMP}.tar.gz"
        log_info "Creating pre-restore backup: ${pre_restore_backup}"
        mkdir -p "${BACKUP_DIR}"
        tar -czf "${pre_restore_backup}" -C "$(dirname ${GOD_AGENT_DIR})" "$(basename ${GOD_AGENT_DIR})" 2>/dev/null || true
    fi

    # Restore .god-agent
    if [[ -d "${temp_dir}/god-agent" ]]; then
        log_info "Restoring .god-agent directory..."
        rm -rf "${GOD_AGENT_DIR}"
        cp -r "${temp_dir}/god-agent" "${GOD_AGENT_DIR}"
        log_success ".god-agent restored"
    else
        log_warn "No god-agent directory in archive"
    fi

    # Restore .agentdb (SONA trajectories, GNN, etc.)
    if [[ -d "${temp_dir}/agentdb" ]]; then
        log_info "Restoring .agentdb directory..."
        rm -rf "${AGENTDB_DIR}"
        cp -r "${temp_dir}/agentdb" "${AGENTDB_DIR}"
        log_success ".agentdb restored"
    else
        log_warn "No agentdb directory in archive"
    fi

    # Restore .swarm (swarm coordination)
    if [[ -d "${temp_dir}/swarm" ]]; then
        log_info "Restoring .swarm directory..."
        rm -rf "${SWARM_DIR}"
        cp -r "${temp_dir}/swarm" "${SWARM_DIR}"
        log_success ".swarm restored"
    else
        log_warn "No swarm directory in archive"
    fi

    # Restore .serena (project memories)
    if [[ -d "${temp_dir}/serena" ]]; then
        log_info "Restoring .serena directory..."
        rm -rf "${SERENA_DIR}"
        cp -r "${temp_dir}/serena" "${SERENA_DIR}"
        log_success ".serena restored"
    else
        log_warn "No serena directory in archive"
    fi

    # Restore .phd-sessions
    if [[ -d "${temp_dir}/phd-sessions" ]]; then
        log_info "Restoring .phd-sessions directory..."
        rm -rf "${PHD_SESSIONS_DIR}"
        cp -r "${temp_dir}/phd-sessions" "${PHD_SESSIONS_DIR}"
        log_success ".phd-sessions restored"
    else
        log_warn "No phd-sessions directory in archive"
    fi

    # Restore .claude-flow
    if [[ -d "${temp_dir}/claude-flow" ]]; then
        log_info "Restoring .claude-flow directory..."
        rm -rf "${CLAUDE_FLOW_DIR}"
        cp -r "${temp_dir}/claude-flow" "${CLAUDE_FLOW_DIR}"
        log_success ".claude-flow restored"
    else
        log_warn "No claude-flow directory in archive"
    fi

    # Restore .hive-mind
    if [[ -d "${temp_dir}/hive-mind" ]]; then
        log_info "Restoring .hive-mind directory..."
        rm -rf "${HIVE_MIND_DIR}"
        cp -r "${temp_dir}/hive-mind" "${HIVE_MIND_DIR}"
        log_success ".hive-mind restored"
    else
        log_warn "No hive-mind directory in archive"
    fi

    # Restore vector DB
    if [[ -d "${temp_dir}/vector_db_1536" ]]; then
        log_info "Restoring vector_db_1536 directory..."
        rm -rf "${VECTOR_DB_DIR}"
        cp -r "${temp_dir}/vector_db_1536" "${VECTOR_DB_DIR}"
        log_success "vector_db_1536 restored"
    else
        log_warn "No vector_db_1536 directory in archive"
    fi

    echo ""
    log_success "Restore complete!"
    echo ""
    echo "You can now start the daemons:"
    echo "  npm run god-agent:start"
}

do_list() {
    log_info "Available backups in ${BACKUP_DIR}:"
    echo ""

    if [[ ! -d "${BACKUP_DIR}" ]]; then
        echo "  No backups found"
        return
    fi

    ls -lh "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

    if [[ $? -ne 0 ]]; then
        echo "  No backups found"
    fi
}

do_info() {
    local archive_path="$1"

    if [[ -z "${archive_path}" ]]; then
        log_error "Please specify an archive"
        exit 1
    fi

    if [[ ! -f "${archive_path}" ]]; then
        log_error "Archive not found: ${archive_path}"
        exit 1
    fi

    log_info "Archive: ${archive_path}"
    log_info "Size: $(du -sh "${archive_path}" | cut -f1)"
    echo ""

    # Extract and show metadata
    local metadata=$(tar -xzf "${archive_path}" -O ./backup-metadata.json 2>/dev/null)
    if [[ -n "${metadata}" ]]; then
        log_info "Metadata:"
        echo "${metadata}" | jq . 2>/dev/null || echo "${metadata}"
        echo ""
    fi

    log_info "Contents:"
    tar -tzf "${archive_path}"
}

# Main
case "${1:-}" in
    backup)
        do_backup "$2"
        ;;
    restore)
        do_restore "$2"
        ;;
    list)
        do_list
        ;;
    info)
        do_info "$2"
        ;;
    -h|--help|help|"")
        show_usage
        ;;
    *)
        log_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
