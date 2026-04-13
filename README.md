# nstrfy.sh - Nostr Notifications

Send and receive optionally-encrypted notifications over Nostr using simple bash scripts powered by `nak`.

Best paired with [nstrfy android](https://github.com/vcavallo/nstrfy-android).

## Overview

`nstrfy.sh` is a lightweight, bash-based notification system that uses the Nostr protocol for decentralized, end-to-end encrypted notifications.

## Features

- **End-to-end encrypted** using NIP-44 (optional. public is cool, too)
- **Decentralized** - uses Nostr relays
- **Few dependencies:** `nak` and `jq`
- **Simple CLI** - works like `curl` or `ntfy`
- **Priority levels** - urgent, high, default, low, min
- **Topics and tags** - organize your notifications
- **$0 infrastructure cost** - no servers needed

## Quick Start

```unset
./nstrfy.sh send --to npub1euxrakmw7mqpef84r8pq07pdhl56k76ekmv2dklc9vlzpzw8c56skl3r04 --topic "my-topic" --title "NoTiFiCaTiOns" --message "Hey you should read this" --priority normal
```

### Prerequisites

```bash
# Install nak (Nostr Army Knife)
go install github.com/fiatjaf/nak@latest

# Install jq (JSON processor)
brew install jq  # macOS
# or
apt install jq   # Linux
```

### Generate Keys

```bash
./nstrfy.sh generate

# Output:
# Private key (hex): d3d3c043fced10f33dd3dcd8eedc4aa96021200fa3a994af057452d94861f14b
# Public key (hex):  4b39fbe6174dea5ad1454d75d618c1603e52f80d1d4c01fde06cc2ccfd42c48b
# Public key (npub): npub1fvulheshfh494529f46avxxpvql997qdr4xqrl0qdnpvel2zcj9slg55al

# Save your private key securely!
```

### Send a Notification

```bash
./nstrfy.sh send \
  --to npub1... \
  --title "Server Alert" \
  --message "CPU usage is at 95%" \
  --priority urgent \
  --topic monitoring
```

## Usage

### Commands

#### `generate`

Generate a new keypair:

```bash
./nstrfy.sh generate
```

#### `send`

Send a notification:

```bash
./nstrfy.sh send \
  --to <npub|hex>              # Recipient's public key (required)
  --title <text>               # Notification title (required)
  --message <text>             # Notification message (required)
  --priority <level>           # urgent|high|default|low|min (default: default)
  --topic <text>               # Notification topic/category
  --tags <tag1,tag2>           # Comma-separated tags
  --key <hex>                  # Sender's private key (generates ephemeral if omitted)
  --relays <urls>              # Comma-separated relay URLs
```

#### `listen`

Listen for incoming notifications:

```bash
./nstrfy.sh listen \
  --key <hex>                  # Your private key (required)
  --relays <urls>              # Comma-separated relay URLs
```

### Examples

#### Server Monitoring

```bash
#!/bin/bash
RECIPIENT="npub1your_npub..."

# Check CPU usage
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if (( $(echo "$CPU > 90" | bc -l) )); then
    ./nstrfy.sh send \
      --to "$RECIPIENT" \
      --title "High CPU Usage" \
      --message "CPU usage is at ${CPU}%" \
      --priority urgent \
      --topic monitoring
fi
```

#### Backup Notifications

```bash
#!/bin/bash
RECIPIENT="npub1your_npub..."

if ./run-backup.sh; then
    ./nstrfy.sh send \
      --to "$RECIPIENT" \
      --title "Backup Complete" \
      --message "Daily backup completed successfully" \
      --priority low \
      --tags "backup,success"
else
    ./nstrfy.sh send \
      --to "$RECIPIENT" \
      --title "Backup Failed" \
      --message "Daily backup failed - check logs" \
      --priority urgent \
      --tags "backup,failure"
fi
```

#### CI/CD Integration

```yaml
# GitHub Actions
- name: Notify deployment
  if: always()
  run: |
    ./nstrfy.sh send \
      --to ${{ secrets.NOSTR_RECIPIENT }} \
      --title "Deployment ${{ job.status }}" \
      --message "Version ${{ github.sha }} deployed to production" \
      --priority high \
      --topic deployments
```

#### Cron Jobs

(Super nice to use with pi.dev or OpenClaw...)

```cron
# Daily report at 8 AM
0 8 * * * /usr/local/bin/nstrfy.sh send --to npub1... --title "Daily Report" --message "All systems operational"

# Check website every 5 minutes
*/5 * * * * curl -s https://mysite.com > /dev/null || /usr/local/bin/nstrfy.sh send --to npub1... --priority urgent --title "Website Down" --message "Site is not responding"
```

## Default Relays

By default, the script uses these public Nostr relays:

- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`

You can override with the `--relays` flag.

## How It Works

1. **Sender** creates a JSON notification payload with title, message, priority, etc.
2. **Encryption** happens using NIP-44
3. **Publishing** sends the event (kind 7741) to Nostr relays
4. **Receiver** subscribes to events
5. **Decryption** happens automatically when notifications arrive
6. **Display** shows the notification with formatting based on priority

## Protocol

This tool implements a draft NIP (Nostr Implementation Possibility) for encrypted notifications. See [NIP-DRAFT.md](NIP-DRAFT.md) for the full specification.

**Key Details:**

- Event Kind: `7741` (regular event, stored by relays)
- Encryption: NIP-44 (when sending to a specific recipient), or plain JSON (public)
- Expiration: NIP-40 (default 1 hour)
- Tags: `p` (recipient pubkey, for encrypted), `d` (unique ID), `expiration` (NIP-40)
- Content: Encrypted or plain JSON with version, title, message, priority, topic, etc.

## Comparison to ntfy

| Feature | ntfy | nstrfy.sh |
|---------|------|-----------|
| Architecture | Centralized | Decentralized |
| Infrastructure | Self-host required | "Free"" relays |
| Censorship | Can be blocked | Resistant |
| Privacy | Server sees metadata | Fully encrypted |
| Cost | Server/hosting costs | $0 w/ public/free relays |
| Installation | Server setup | Single script |

## Security

- **Ephemeral keys**: Optional anonymous sending with auto-generated keys
- **Persistent keys**: Optional authenticated notifications with reusable keys

## Receivers

You can receive notifications in multiple ways:

1. **Bash script** (this project) - Terminal-based listener
2. **Web app** - Browser-based receiver with desktop notifications
3. **Android app** - <https://github.com/vcavallo/nstrfy-android> - Native mobile app with background service
4. **Custom client** - Build your own using the NIP specification

## Troubleshooting

### Browser notifications not working (web app)

- Grant notification permission when prompted
- Check browser settings allow notifications for localhost
- Some browsers block notifications on HTTP (use HTTPS or localhost)

## Contributing

Contributions welcome! This is a simple bash script that can be extended with:

- Action buttons (HTTP callbacks)
- Image/icon support
- Delivery receipts
- Multi-recipient support
- Config file support

## License

MIT

## Related Projects

- [nak](https://github.com/fiatjaf/nak) - Nostr Army Knife CLI tool
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - JavaScript Nostr library
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) - Main protocol repo
- [ntfy](https://ntfy.sh/) - Centralized notification service (inspiration)

## Support

- Author: npub19ma2w9dmk3kat0nt0k5dwuqzvmg3va9ezwup0zkakhpwv0vcwvcsg8axkl
- Issues: GitHub Issues
- Questions: GitHub Discussions
- Docs: This README and [NIP-DRAFT.md](NIP-DRAFT.md)
