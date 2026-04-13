NIP-XX
======

Encrypted Notifications
-----------------------

`draft` `optional`

This NIP defines a standard for sending encrypted, push-style notifications over Nostr.

## Abstract

Applications often need to send notifications to users (alerts, reminders, status updates) without requiring interactive messages. This NIP defines a standardized event kind and payload format for encrypted or public notifications that can be displayed by supporting clients.

## Motivation

While NIP-17 encrypted direct messages work for conversations, they lack:
- Standardized metadata (priority, topic, actions)
- Clear distinction between messages and notifications
- Support for notification-specific features (urgency, topics, actions)

This NIP provides a dedicated notification format compatible with modern notification systems.

## Event Structure

Notifications use **kind `7741`** regular events with optional NIP-44 encryption and NIP-40 expiration.

### Event Kind

- `7741`: Notification

### Modes

- **Encrypted (inbox)**: Content is NIP-44 encrypted to a specific recipient. Event includes `#p` tag with recipient's pubkey.
- **Public**: Content is plain JSON. No `#p` tag. Anyone subscribed to the topic can read it.

### Tags

Required tags:
- `d`: Unique identifier (recommended: timestamp + random)

Conditional tags:
- `p`: Recipient's public key (hex) — required for encrypted notifications, omitted for public

Recommended tags:
- `expiration`: Unix timestamp when notification expires (NIP-40). Default: 1 hour from creation.

### Content

For **encrypted** notifications, the `content` field contains a NIP-44 encrypted JSON payload.

For **public** notifications, the `content` field contains plain JSON.

Payload structure:

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
- `topic` (string): Category or channel identifier. Topic matching is done client-side after decryption — relay-level topic filtering is not possible.
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

### Sending Encrypted Notifications

1. Create notification payload as JSON
2. Encrypt payload using NIP-44 with recipient's public key
3. Create kind `7741` event with:
   - Encrypted payload as `content`
   - Recipient pubkey in `p` tag
   - Unique identifier in `d` tag
   - Expiration timestamp in `expiration` tag (NIP-40)
4. Sign and publish event to relays

### Sending Public Notifications

1. Create notification payload as JSON
2. Create kind `7741` event with:
   - Plain JSON payload as `content`
   - Unique identifier in `d` tag
   - Expiration timestamp in `expiration` tag (NIP-40)
   - No `p` tag
3. Sign and publish event to relays

### Receiving Notifications

1. Subscribe to kind `7741` events with filters:
   - Inbox: `{"kinds": [7741], "#p": [<user_pubkey>]}`
   - Public: `{"kinds": [7741]}` (optionally filtered by `authors`)
2. For events with `#p` tag: decrypt `content` using NIP-44
3. For events without `#p` tag: parse `content` as plain JSON
4. Match `topic` field against subscribed topics (client-side)
5. Display notification according to client capabilities
6. Check sender against per-topic allowlists (spam protection)

## Examples

### Encrypted Notification

```json
{
  "kind": 7741,
  "pubkey": "sender_pubkey_hex",
  "created_at": 1234567890,
  "tags": [
    ["p", "recipient_pubkey_hex"],
    ["d", "1234567890-abc123"],
    ["expiration", "1234571490"]
  ],
  "content": "nip44_encrypted_payload",
  "id": "event_id",
  "sig": "signature"
}
```

### Public Notification

```json
{
  "kind": 7741,
  "pubkey": "sender_pubkey_hex",
  "created_at": 1234567890,
  "tags": [
    ["d", "1234567890-abc123"],
    ["expiration", "1234571490"]
  ],
  "content": "{\"version\":\"1.0\",\"title\":\"Deploy Complete\",\"message\":\"v2.0 is live\",\"priority\":\"high\",\"topic\":\"deploys\",\"timestamp\":1234567890}",
  "id": "event_id",
  "sig": "signature"
}
```

### Decrypted Payload Examples

Basic:
```json
{
  "version": "1.0",
  "title": "Server Alert",
  "message": "Database backup completed successfully",
  "priority": "default",
  "timestamp": 1234567890
}
```

Urgent with topic and actions:
```json
{
  "version": "1.0",
  "title": "Critical: Service Down",
  "message": "Production API is not responding",
  "priority": "urgent",
  "topic": "infrastructure",
  "tags": ["production", "api", "downtime"],
  "timestamp": 1234567890,
  "click": "https://status.example.com",
  "actions": [
    {
      "label": "View Status",
      "url": "https://status.example.com",
      "method": "view"
    }
  ]
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

- Topic is a client-side field in the payload, not a nostr tag
- Nostr's namespace is global — anyone can post with any topic value
- Per-topic sender allowlists are the primary spam protection
- Clients MAY implement topic-based muting, priority overrides, and auto-delete

### Deduplication

Clients SHOULD deduplicate notifications by event ID.

### Expiration

- Senders SHOULD include NIP-40 `expiration` tags (recommended: 1 hour)
- Relays supporting NIP-40 will auto-delete expired events
- Clients SHOULD NOT display expired notifications
- The `since` filter parameter can prevent historical replay on reconnect

### External Signer Support

Clients supporting NIP-55 external signers (e.g., Amber on Android):
- SHOULD use the ContentProvider channel for silent background decryption
- SHOULD queue encrypted events for foreground decryption when background access is unavailable
- SHOULD display a generic notification ("New encrypted notification") for queued events

### Privacy Considerations

- Encrypted notifications are end-to-end encrypted via NIP-44
- Relays cannot read encrypted notification content
- Metadata (tags, event kind) is visible to relays
- Recipients' public keys are visible in `p` tags for encrypted notifications
- Public notifications are readable by anyone
- Senders MAY use ephemeral keys for additional anonymity

## Security Considerations

### Spam Prevention

Implementations SHOULD provide:
- Per-topic sender allowlists (npub whitelist)
- Automatic discarding of events from unknown senders (when whitelist is enabled)
- Rate limiting per sender

### Key Management

- Senders MAY use ephemeral keys (generated per-notification) for anonymous sending
- Senders MAY use persistent keys for authenticated notifications
- Recipients using external signers (NIP-55) never expose private keys to the notification client

## Implementation Status

This NIP is currently implemented by:
- `nstrfy.sh` - Bash CLI tool using nak (https://github.com/vcavallo/nstrfy.sh)
- `nstrfy-android` - Android app with Amber signer support (https://github.com/vcavallo/nstrfy-android)

## Rationale

### Why Kind 7741?

- Regular event kind (stored by relays for offline delivery)
- Not in any reserved/allocated NIP range
- Combined with NIP-40 expiration to prevent unbounded storage
- Distinct from kind 30078 (application-specific data) which is a crowded namespace used by many apps

### Why NIP-44 Instead of NIP-04?

- NIP-44 is more secure and properly specified
- Better security properties
- NIP-44 is the recommended standard for new applications

### Why Not Use Kind 4 or Kind 14 (Direct Messages)?

- Conceptual clarity: notifications are not conversational messages
- Allows separate filtering and handling by clients
- Enables notification-specific features (priority, topics, actions)
- Prevents mixing of chat UI and notification UI

## Future Extensions

Possible future additions:
- Group notifications via NIP-17 pattern (per-recipient encryption)
- Delivery receipts
- Notification grouping/threading
- Rich media attachments

## Backwards Compatibility

Clients not implementing this NIP will ignore kind `7741` events. No breaking changes to existing NIPs.

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-44: Encrypted Payloads (Versioned)](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-40: Expiration Timestamp](https://github.com/nostr-protocol/nips/blob/master/40.md)
- [NIP-55: Android Signer Application](https://github.com/nostr-protocol/nips/blob/master/55.md)
- [NIP-65: Relay List Metadata](https://github.com/nostr-protocol/nips/blob/master/65.md)

## License

WTFPL - Do What the Fuck You Want to Public License

## Changelog

- 2024-11-25: Initial draft (kind 30078, NIP-44 encryption)
- 2025-04-13: v2.0 — Changed to kind 7741, added public (unencrypted) mode, NIP-40 expiration, NIP-55 signer support, per-topic allowlists
