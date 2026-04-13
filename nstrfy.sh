#!/bin/bash
# nstrfy - Send push notifications over Nostr
# Requires: nak (https://github.com/fiatjaf/nak)
# Usage: ./nstrfy.sh [command] [options]

set -e

VERSION="2.0"
EVENT_KIND=7741
DEFAULT_RELAYS="wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band"
DEFAULT_EXPIRATION=3600  # 1 hour

# Colors for output
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if nak is installed
check_nak() {
    if ! command -v nak &> /dev/null; then
        error "nak is not installed"
        echo ""
        echo "Install nak from: https://github.com/fiatjaf/nak"
        echo ""
        echo "Quick install:"
        echo "  go install github.com/fiatjaf/nak@latest"
        echo ""
        exit 1
    fi
    success "nak found: $(which nak)"
}

# Generate a new private key
generate_key() {
    info "Generating new private key..."
    local privkey=$(nak key generate)
    local pubkey=$(nak key public "$privkey")
    local npub=$(nak encode npub "$pubkey")

    echo ""
    success "Key generated!"
    echo "Private key (hex): $privkey"
    echo "Public key (hex):  $pubkey"
    echo "Public key (npub): $npub"
    echo ""
    warn "Save your private key securely!"
}

# Create notification payload
create_payload() {
    local title="$1"
    local message="$2"
    local priority="${3:-default}"
    local topic="${4:-}"
    local tags="${5:-}"

    local timestamp=$(date +%s)

    # Build JSON payload
    local payload=$(cat <<EOF
{
  "version": "1.0",
  "title": "$title",
  "message": "$message",
  "priority": "$priority",
  "timestamp": $timestamp
EOF
)

    # Add optional fields
    if [ -n "$topic" ]; then
        payload="$payload,\n  \"topic\": \"$topic\""
    fi

    if [ -n "$tags" ]; then
        # Convert comma-separated tags to JSON array
        local tags_array=$(echo "$tags" | awk -F',' '{printf "["} {for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?", ":"")} {printf "]"}')
        payload="$payload,\n  \"tags\": $tags_array"
    fi

    payload="$payload\n}"

    echo -e "$payload"
}

# Generate a unique d tag without openssl dependency
generate_d_tag() {
    local timestamp=$(date +%s)
    local random=$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')
    echo "${timestamp}-${random}"
}

# Send notification (encrypted to recipient, or public)
send_notification() {
    local recipient="$1"
    local title="$2"
    local message="$3"
    local priority="${4:-default}"
    local topic="${5:-}"
    local tags="${6:-}"
    local privkey="${7:-}"
    local relays="${8:-$DEFAULT_RELAYS}"
    local expiration="${9:-$DEFAULT_EXPIRATION}"

    # Generate ephemeral key if not provided
    if [ -z "$privkey" ]; then
        info "Generating ephemeral key for sending..."
        privkey=$(nak key generate)
    fi

    local sender_pubkey=$(nak key public "$privkey")

    # Create payload
    info "Creating notification payload..."
    local payload=$(create_payload "$title" "$message" "$priority" "$topic" "$tags")

    echo ""
    info "Payload:"
    echo "$payload" | jq '.' 2>/dev/null || echo "$payload"
    echo ""

    # Generate unique d tag and expiration
    local d_tag=$(generate_d_tag)
    local expiration_ts=$(($(date +%s) + expiration))

    if [ -n "$recipient" ]; then
        # Encrypted mode: NIP-44 encrypt + #p tag
        # Convert npub to hex if needed
        if [[ "$recipient" == npub* ]]; then
            info "Converting npub to hex..."
            recipient=$(nak decode "$recipient" -p)
        fi

        info "Encrypting payload with NIP-44..."
        local encrypted=$(nak encrypt --sec "$privkey" -p "$recipient" "$payload")

        if [ -z "$encrypted" ]; then
            error "Encryption failed"
            exit 1
        fi

        success "Payload encrypted"
        info "Publishing event to relays..."

        nak event \
            --kind $EVENT_KIND \
            --content "$encrypted" \
            -t "p=$recipient" \
            -t "d=$d_tag" \
            -t "expiration=$expiration_ts" \
            --sec "$privkey" \
            $(echo "$relays" | tr ',' ' ')

        if [ $? -eq 0 ]; then
            echo ""
            success "Encrypted notification sent!"
            echo "Recipient: $(nak encode npub $recipient)"
            echo "Relays: $relays"
            echo "Priority: $priority"
            [ -n "$topic" ] && echo "Topic: $topic"
            echo "Expires: $(date -d @$expiration_ts 2>/dev/null || date -r $expiration_ts 2>/dev/null || echo "in ${expiration}s")"
        else
            error "Failed to send notification"
            exit 1
        fi
    else
        # Public mode: plain JSON content, no #p tag, no encryption
        info "Publishing public event to relays..."

        nak event \
            --kind $EVENT_KIND \
            --content "$payload" \
            -t "d=$d_tag" \
            -t "expiration=$expiration_ts" \
            --sec "$privkey" \
            $(echo "$relays" | tr ',' ' ')

        if [ $? -eq 0 ]; then
            echo ""
            success "Public notification sent!"
            echo "Sender: $(nak encode npub $sender_pubkey)"
            echo "Relays: $relays"
            echo "Priority: $priority"
            [ -n "$topic" ] && echo "Topic: $topic"
            echo "Expires: $(date -d @$expiration_ts 2>/dev/null || date -r $expiration_ts 2>/dev/null || echo "in ${expiration}s")"
            echo ""
            warn "This is a public notification — anyone subscribed to topic '$topic' (with whitelist disabled) can see it."
            echo "Sender pubkey: $sender_pubkey"
            echo "(Add this pubkey to the topic's allowlist if whitelist is enabled)"
        else
            error "Failed to send notification"
            exit 1
        fi
    fi
}

# Listen for notifications
listen() {
    local privkey="$1"
    local relays="${2:-$DEFAULT_RELAYS}"

    # Get public key
    local pubkey=$(nak key public "$privkey")
    local npub=$(nak encode npub "$pubkey")

    info "Listening for notifications..."
    echo "Your npub: $npub"
    echo "Relays: $relays"
    echo ""
    success "Waiting for notifications... (Press Ctrl+C to stop)"
    echo ""

    # Subscribe to events
    nak req \
        -k $EVENT_KIND \
        -p "$pubkey" \
        --stream \
        $(echo "$relays" | tr ',' ' ') | \
    while IFS= read -r line; do
        # Try to parse as JSON
        if echo "$line" | jq empty 2>/dev/null; then
            local content=$(echo "$line" | jq -r '.content // empty')
            local sender=$(echo "$line" | jq -r '.pubkey // empty')
            local created_at=$(echo "$line" | jq -r '.created_at // empty')

            if [ -n "$content" ] && [ -n "$sender" ]; then
                # Try to decrypt
                local decrypted=$(nak decrypt --sec "$privkey" -p "$sender" "$content" 2>/dev/null)

                if [ $? -eq 0 ] && [ -n "$decrypted" ]; then
                    # Parse notification
                    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                    echo -e "${BLUE}📬 New Notification${NC}"
                    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

                    local title=$(echo "$decrypted" | jq -r '.title // "Notification"')
                    local message=$(echo "$decrypted" | jq -r '.message // ""')
                    local priority=$(echo "$decrypted" | jq -r '.priority // "default"')
                    local topic=$(echo "$decrypted" | jq -r '.topic // ""')
                    local tags=$(echo "$decrypted" | jq -r '.tags // [] | join(", ")')

                    # Priority emoji
                    case "$priority" in
                        urgent) echo -e "🔴 ${RED}URGENT${NC}" ;;
                        high)   echo -e "🟠 ${YELLOW}HIGH${NC}" ;;
                        low)    echo -e "🟣 LOW" ;;
                        min)    echo -e "⚫ MIN" ;;
                        *)      echo -e "🔵 DEFAULT" ;;
                    esac

                    echo ""
                    echo -e "${BLUE}Title:${NC} $title"
                    echo -e "${BLUE}Message:${NC} $message"
                    [ -n "$topic" ] && echo -e "${BLUE}Topic:${NC} $topic"
                    [ -n "$tags" ] && echo -e "${BLUE}Tags:${NC} $tags"
                    echo -e "${BLUE}From:${NC} $(nak encode npub $sender)"
                    echo -e "${BLUE}Time:${NC} $(date -d @$created_at 2>/dev/null || date -r $created_at)"
                    echo ""
                fi
            fi
        fi
    done
}

# Show help
show_help() {
    cat <<EOF
${BLUE}nstrfy${NC} - Send push notifications over Nostr
Version: $VERSION

${YELLOW}USAGE:${NC}
  $0 [command] [options]

${YELLOW}COMMANDS:${NC}
  ${GREEN}generate${NC}                  Generate a new private key

  ${GREEN}send${NC} [options]            Send a notification
    --to <npub/hex>           Recipient's public key (omit for public notification)
    --title <text>            Notification title (required)
    --message <text>          Notification message (required)
    --priority <level>        Priority: urgent|high|default|low|min (default: default)
    --topic <text>            Notification topic/channel
    --tags <tag1,tag2>        Comma-separated tags
    --key <hex>               Sender's private key (generates ephemeral if omitted)
    --relays <urls>           Comma-separated relay URLs (default: $DEFAULT_RELAYS)
    --expiration <seconds>    Event expiration in seconds (default: $DEFAULT_EXPIRATION)

  ${GREEN}listen${NC} [options]          Listen for notifications
    --key <hex>               Your private key (required)
    --relays <urls>           Comma-separated relay URLs (default: $DEFAULT_RELAYS)

  ${GREEN}help${NC}                      Show this help message

${YELLOW}EXAMPLES:${NC}
  # Generate a new key
  $0 generate

  # Send a public notification (no encryption, anyone on the topic can see it)
  $0 send \\
    --title "Deploy complete" \\
    --message "v2.4.1 is live" \\
    --topic deploys

  # Send an encrypted notification to a specific npub
  $0 send \\
    --to npub1abc123... \\
    --title "Server Down" \\
    --message "Production API is not responding" \\
    --priority urgent \\
    --topic infrastructure

  # Send with tags and custom relays
  $0 send \\
    --to npub1abc123... \\
    --title "Backup Complete" \\
    --message "Daily backup finished successfully" \\
    --tags "backup,success,daily" \\
    --relays "wss://relay.damus.io,wss://nos.lol"

  # Listen for notifications
  $0 listen --key <your_private_key_hex>

${YELLOW}EVENT FORMAT:${NC}
  Kind: $EVENT_KIND (regular event, stored by relays)
  Encryption: NIP-44 (when --to is specified)
  Expiration: NIP-40 (default ${DEFAULT_EXPIRATION}s / $(( DEFAULT_EXPIRATION / 60 )) minutes)
  Payload: JSON with version, title, message, priority, timestamp, topic, tags

${YELLOW}COMPANION APP:${NC}
  nstrfy Android: https://github.com/vcavallo/nstrfy-android

${YELLOW}REQUIREMENTS:${NC}
  - nak (https://github.com/fiatjaf/nak)
  - jq (https://stedolan.github.io/jq/) (for listen command)

${YELLOW}LICENSE:${NC}
  WTFPL - Do What the Fuck You Want to Public License
EOF
}

# Parse command
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
    generate)
        check_nak
        generate_key
        ;;

    send)
        check_nak

        # Parse arguments
        TO=""
        TITLE=""
        MESSAGE=""
        PRIORITY="default"
        TOPIC=""
        TAGS=""
        KEY=""
        RELAYS="$DEFAULT_RELAYS"
        EXPIRATION="$DEFAULT_EXPIRATION"

        while [[ $# -gt 0 ]]; do
            case $1 in
                --to)
                    TO="$2"
                    shift 2
                    ;;
                --title)
                    TITLE="$2"
                    shift 2
                    ;;
                --message)
                    MESSAGE="$2"
                    shift 2
                    ;;
                --priority)
                    PRIORITY="$2"
                    shift 2
                    ;;
                --topic)
                    TOPIC="$2"
                    shift 2
                    ;;
                --tags)
                    TAGS="$2"
                    shift 2
                    ;;
                --key)
                    KEY="$2"
                    shift 2
                    ;;
                --relays)
                    RELAYS="$2"
                    shift 2
                    ;;
                --expiration)
                    EXPIRATION="$2"
                    shift 2
                    ;;
                *)
                    error "Unknown option: $1"
                    echo "Run '$0 help' for usage information"
                    exit 1
                    ;;
            esac
        done

        # Validate required arguments
        if [ -z "$TITLE" ] || [ -z "$MESSAGE" ]; then
            error "Missing required arguments"
            echo ""
            echo "Required: --title, --message"
            echo "Optional: --to (omit for public notification)"
            echo "Run '$0 help' for usage information"
            exit 1
        fi

        send_notification "$TO" "$TITLE" "$MESSAGE" "$PRIORITY" "$TOPIC" "$TAGS" "$KEY" "$RELAYS" "$EXPIRATION"
        ;;

    listen)
        check_nak

        # Parse arguments
        KEY=""
        RELAYS="$DEFAULT_RELAYS"

        while [[ $# -gt 0 ]]; do
            case $1 in
                --key)
                    KEY="$2"
                    shift 2
                    ;;
                --relays)
                    RELAYS="$2"
                    shift 2
                    ;;
                *)
                    error "Unknown option: $1"
                    echo "Run '$0 help' for usage information"
                    exit 1
                    ;;
            esac
        done

        # Validate required arguments
        if [ -z "$KEY" ]; then
            error "Missing required argument: --key"
            echo ""
            echo "Run '$0 help' for usage information"
            exit 1
        fi

        listen "$KEY" "$RELAYS"
        ;;

    help|--help|-h)
        show_help
        ;;

    *)
        error "Unknown command: $COMMAND"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
