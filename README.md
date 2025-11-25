# nstrfy.sh - Nostr Notifications

**VIBECODED FOR NOW. manual intervention forthcoming**.

Send and receive encrypted notifications over Nostr using simple bash scripts powered by `nak`.

## Overview

`nstrfy.sh` is a lightweight, bash-based notification system that uses the Nostr protocol for decentralized, end-to-end encrypted notifications. It's perfect for server monitoring, CI/CD alerts, backup notifications, and any scenario where you need reliable push notifications without centralized infrastructure.

## Features

- **End-to-end encrypted** using NIP-44
- **Decentralized** - uses public Nostr relays
- **Zero dependencies** except `nak` and `jq`
- **Simple CLI** - works like `curl` or `ntfy`
- **Priority levels** - urgent, high, default, low, min
- **Topics and tags** - organize your notifications
- **$0 infrastructure cost** - no servers needed

## Quick Start

```unset
./nstrfy.sh generate
✓ nak found: /opt/homebrew/bin/nak
ℹ Generating new private key...

✓ Key generated!
Private key (hex): e9279cf0e7f49246861f93f460cc63d7076fe26a3d4d32b3ccfe4959ee696e06
Public key (hex):  cf0c3edb6ef6c01ca4f519c207f82dbfe9ab7b59b6d8a6dbf82b3e2089c7c535
Public key (npub): npub1euxrakmw7mqpef84r8pq07pdhl56k76ekmv2dklc9vlzpzw8c56skl3r04
```

```
./nstrfy.sh listen --key e9279cf0e7f49246861f93f460cc63d7076fe26a3d4d32b3ccfe4959ee696e06
```

```
./nstrfy.sh send --to npub1euxrakmw7mqpef84r8pq07pdhl56k76ekmv2dklc9vlzpzw8c56skl3r04 --title "NoTiFiCaTiOns" --message "Hey you should read this" --priority normal
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
./nostr-notify-test.sh generate

# Output:
# Private key (hex): d3d3c043fced10f33dd3dcd8eedc4aa96021200fa3a994af057452d94861f14b
# Public key (hex):  4b39fbe6174dea5ad1454d75d618c1603e52f80d1d4c01fde06cc2ccfd42c48b
# Public key (npub): npub1fvulheshfh494529f46avxxpvql997qdr4xqrl0qdnpvel2zcj9slg55al

# Save your private key securely!
```

### Listen for Notifications

```bash
# In terminal 1
./nostr-notify-test.sh listen --key <your_private_key_hex>
```

### Send a Notification

```bash
# In terminal 2
./nostr-notify-test.sh send \
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
./nostr-notify-test.sh generate
```

#### `send`
Send a notification:
```bash
./nostr-notify-test.sh send \
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
./nostr-notify-test.sh listen \
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
    ./nostr-notify-test.sh send \
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
    ./nostr-notify-test.sh send \
      --to "$RECIPIENT" \
      --title "Backup Complete" \
      --message "Daily backup completed successfully" \
      --priority low \
      --tags "backup,success"
else
    ./nostr-notify-test.sh send \
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
    ./nostr-notify-test.sh send \
      --to ${{ secrets.NOSTR_RECIPIENT }} \
      --title "Deployment ${{ job.status }}" \
      --message "Version ${{ github.sha }} deployed to production" \
      --priority high \
      --topic deployments
```

#### Cron Jobs
```cron
# Daily report at 8 AM
0 8 * * * /usr/local/bin/nostr-notify-test.sh send --to npub1... --title "Daily Report" --message "All systems operational"

# Check website every 5 minutes
*/5 * * * * curl -s https://mysite.com > /dev/null || /usr/local/bin/nostr-notify-test.sh send --to npub1... --priority urgent --title "Website Down" --message "Site is not responding"
```

## Default Relays

By default, the script uses these public Nostr relays:
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`

You can override with the `--relays` flag.

## How It Works

1. **Sender** creates a JSON notification payload with title, message, priority, etc.
2. **Encryption** happens using NIP-44 (modern, secure encryption standard)
3. **Publishing** sends the encrypted event (kind 30078) to Nostr relays
4. **Receiver** subscribes to events tagged with their public key
5. **Decryption** happens automatically when notifications arrive
6. **Display** shows the notification with formatting based on priority

## Protocol

This tool implements a draft NIP (Nostr Implementation Possibility) for encrypted notifications. See [NIP-DRAFT.md](NIP-DRAFT.md) for the full specification.

**Key Details:**
- Event Kind: `30078` (parameterized replaceable)
- Encryption: NIP-44 (NIP-04 is deprecated/broken in nak)
- Tags: `p` (recipient pubkey), `d` (unique ID)
- Content: Encrypted JSON with version, title, message, priority, etc.

## Comparison to ntfy

| Feature | ntfy | nstrfy.sh |
|---------|------|-----------|
| Architecture | Centralized | Decentralized |
| Encryption | Optional | Always E2E |
| Infrastructure | Self-host required | Free relays |
| Censorship | Can be blocked | Resistant |
| Privacy | Server sees metadata | Fully encrypted |
| Cost | Server/hosting costs | $0 |
| Installation | Server setup | Single script |

## Security

- **End-to-end encryption**: All notifications are encrypted with NIP-44
- **No metadata leakage**: Message content is never visible to relays
- **Ephemeral keys**: Optional anonymous sending with auto-generated keys
- **Persistent keys**: Optional authenticated notifications with reusable keys
- **Key storage**: Keep your private keys secure (`chmod 600`)

## Receivers

You can receive notifications in multiple ways:

1. **Bash script** (this project) - Terminal-based listener
2. **Web app** - Browser-based receiver with desktop notifications
3. **Android app** - Native mobile app with background service
4. **Custom client** - Build your own using the NIP specification

## Troubleshooting

### Notifications not arriving
- Check your private key is correct
- Verify relays are accessible
- Ensure listener is running
- Try with `-v` flag for verbose output

### NIP-04 vs NIP-44
This tool uses NIP-44 because NIP-04 is broken in nak 0.16.1. The web and Android clients have been updated to support both.

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

## Credits

Built with:
- [nak](https://github.com/fiatjaf/nak) by @fiatjaf - Nostr CLI Swiss Army knife
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) - Decentralized social protocol
- Inspired by [ntfy](https://ntfy.sh/) - Simple notification service

## Support

- 🐛 Issues: GitHub Issues
- 💬 Questions: GitHub Discussions
- 📖 Docs: This README and [NIP-DRAFT.md](NIP-DRAFT.md)
