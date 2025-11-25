NIP-XX
======

Encrypted Notifications
-----------------------

`draft` `optional`

This NIP defines a standard for sending encrypted, push-style notifications over Nostr.

## Abstract

Applications often need to send notifications to users (alerts, reminders, status updates) without requiring interactive messages. This NIP defines a standardized event kind and payload format for encrypted notifications that can be displayed by supporting clients.

## Motivation

While NIP-04 encrypted direct messages work for conversations, they lack:
- Standardized metadata (priority, topic, actions)
- Clear distinction between messages and notifications
- Support for notification-specific features (urgency, topics, actions)

This NIP provides a dedicated notification format compatible with modern notification systems.

## Event Structure

Notifications use **parameterized replaceable events** (kind `30078`) with NIP-44 encryption.

### Event Kind

- `30078`: Encrypted Notification

### Tags

Required tags:
- `p`: Recipient's public key (hex)
- `d`: Unique identifier (recommended: timestamp + random)

Optional tags:
- `relay`: Suggested relay for recipient
- `expiration`: Unix timestamp when notification expires (NIP-40)

### Content

The `content` field contains a NIP-44 encrypted JSON payload with the following structure:

```json
{
  "version": "1.0",
  "title": "Notification Title",
  "message": "Notification body text",
  "priority": "default",
  "timestamp": 1234567890,
  "topic": "optional-topic",
  "tags": ["tag1", "tag2"],
  "click": "https://example.com/action",
  "icon": "https://example.com/icon.png",
  "actions": [
    {
      "label": "View",
      "url": "https://example.com/view",
      "method": "view"
    }
  ]
}
```

### Payload Fields

#### Required Fields

- `version` (string): Payload version, currently `"1.0"`
- `message` (string): Main notification body text

#### Optional Fields

- `title` (string): Notification title/subject
- `priority` (string): Notification priority level
  - `"urgent"`: Critical notifications requiring immediate attention
  - `"high"`: Important notifications
  - `"default"`: Normal notifications (default if omitted)
  - `"low"`: Low priority, can be deferred
  - `"min"`: Minimal priority, silent notifications
- `timestamp` (number): Unix timestamp of notification creation
- `topic` (string): Category or channel identifier
- `tags` (array): Array of string tags for filtering/categorization
- `click` (string): URL to open when notification is clicked
- `icon` (string): URL to notification icon image
- `actions` (array): Array of action buttons (see Actions below)

#### Actions

Action objects support interactive notifications:

```json
{
  "label": "Button text",
  "url": "https://example.com/action",
  "method": "view"
}
```

- `label` (string): Button text displayed to user
- `url` (string): URL to execute when action is triggered
- `method` (string): Action type
  - `"view"`: Open URL in browser/client
  - `"http"`: Make HTTP POST request to URL

## Implementation

### Sending Notifications

1. Create notification payload as JSON
2. Encrypt payload using NIP-44 with recipient's public key
3. Create kind `30078` event with:
   - Encrypted payload as `content`
   - Recipient pubkey in `p` tag
   - Unique identifier in `d` tag
4. Sign and publish event to relays

### Receiving Notifications

1. Subscribe to kind `30078` events with filter: `{"kinds": [30078], "#p": [<user_pubkey>]}`
2. Decrypt `content` using NIP-44
3. Parse JSON payload
4. Display notification according to client capabilities
5. Handle priority levels appropriately
6. Support click actions and interactive buttons if capable

## Examples

### Basic Notification

```json
{
  "kind": 30078,
  "pubkey": "sender_pubkey_hex",
  "created_at": 1234567890,
  "tags": [
    ["p", "recipient_pubkey_hex"],
    ["d", "1234567890-abc123"]
  ],
  "content": "encrypted_payload",
  "id": "event_id",
  "sig": "signature"
}
```

Decrypted payload:
```json
{
  "version": "1.0",
  "title": "Server Alert",
  "message": "Database backup completed successfully",
  "priority": "default",
  "timestamp": 1234567890
}
```

### Urgent Notification with Topic

```json
{
  "version": "1.0",
  "title": "Critical: Service Down",
  "message": "Production API is not responding",
  "priority": "urgent",
  "topic": "infrastructure",
  "tags": ["production", "api", "downtime"],
  "timestamp": 1234567890,
  "click": "https://status.example.com"
}
```

### Notification with Actions

```json
{
  "version": "1.0",
  "title": "Deployment Ready",
  "message": "Version 2.0.1 is ready to deploy",
  "priority": "high",
  "topic": "deployments",
  "timestamp": 1234567890,
  "actions": [
    {
      "label": "Deploy Now",
      "url": "https://deploy.example.com/v2.0.1",
      "method": "http"
    },
    {
      "label": "View Changes",
      "url": "https://github.com/example/repo/releases/v2.0.1",
      "method": "view"
    }
  ]
}
```

### Silent Notification (Minimal Priority)

```json
{
  "version": "1.0",
  "message": "Daily backup completed",
  "priority": "min",
  "topic": "backups",
  "timestamp": 1234567890
}
```

## Client Behavior

### Priority Handling

Clients SHOULD implement priority levels as follows:

- `urgent`: Show immediately, bypass Do Not Disturb, sound alert, require interaction
- `high`: Show prominently with sound alert
- `default`: Normal notification behavior
- `low`: Silent notification, may be collapsed or delayed
- `min`: Silent notification, minimal UI presence, can be batched

### Topics and Filtering

Clients MAY implement:
- Topic-based filtering (show only specific topics)
- Per-topic notification settings
- Topic muting/blocking

### Deduplication

Clients SHOULD deduplicate notifications by:
- Event ID (primary deduplication)
- `d` tag value (secondary, for replacements)

### Expiration

Clients SHOULD respect NIP-40 expiration tags and not display expired notifications.

### Privacy Considerations

- Notifications are end-to-end encrypted via NIP-44
- Relays cannot read notification content
- Metadata (tags, event kind) is visible to relays
- Recipients' public keys are visible in `p` tags
- Senders MAY use ephemeral keys for additional anonymity

## Security Considerations

### Spam Prevention

Implementations SHOULD provide:
- Allowlist/blocklist for sender public keys
- Topic-based filtering
- Rate limiting per sender
- Automatic blocking of abusive senders

### Malicious Content

Clients MUST:
- Sanitize notification text before display
- Validate URLs before opening
- Warn users about external HTTP actions
- Prevent code execution from notification content

### Key Management

- Senders MAY use ephemeral keys (generated per-notification)
- Senders MAY use persistent keys (for authenticated notifications)
- Recipients MUST protect private keys used for decryption

## Implementation Status

This NIP is currently implemented by:
- `nstrfy.sh` - Bash CLI tool using nak
- `nostr-notify` - Go CLI tool
- `nostr-notify-web` - Web client (JavaScript)
- `nostr-notify-android` - Mobile app (Kotlin)

## Rationale

### Why Kind 30078?

- Uses parameterized replaceable events for potential future updates
- In the range allocated for custom application events
- Distinct from existing message/chat event kinds

### Why NIP-44 Instead of NIP-04?

- NIP-44 is more secure and properly specified
- NIP-04 has known implementation issues (broken in nak 0.16.1)
- Better forward secrecy and security properties
- NIP-44 is the recommended standard for new applications

### Why Not Use Kind 4 (Direct Messages)?

- Conceptual clarity: notifications are not conversational messages
- Allows separate filtering and handling by clients
- Enables notification-specific features (priority, topics, actions)
- Prevents mixing of chat UI and notification UI

## Future Extensions

Possible future additions:
- Multi-recipient notifications (encrypt separately for each)
- Delivery receipts (NIP-65 style acknowledgments)
- Read receipts
- Notification grouping/threading
- Rich media attachments
- Scheduled/delayed notifications
- Geographic targeting

## Backwards Compatibility

Clients not implementing this NIP will ignore kind `30078` events. No breaking changes to existing NIPs.

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-44: Encrypted Payloads (Versioned)](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-33: Parameterized Replaceable Events](https://github.com/nostr-protocol/nips/blob/master/33.md)
- [NIP-40: Expiration Timestamp](https://github.com/nostr-protocol/nips/blob/master/40.md)

## License

Public Domain

## Changelog

- 2024-11-25: Initial draft
- 2024-11-25: Updated to use NIP-44 instead of NIP-04
