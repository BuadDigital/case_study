# @platform/offline-client

Encrypted IndexedDB store, outbox, and 3-hour offline lease for field inspector / government reviewer flows.

## Stores

- `drafts` — encrypted party submission payloads
- `blobs` — encrypted attachment bytes (`local:<uuid>`)
- `outbox` — ordered replay queue (attachments → save → submit)
- `prefetch` — cached task/PO metadata
- `meta` — lease and misc

## Enable Web Push

1. Generate VAPID keys and set on Platform API:

```json
"WebPush": {
  "Enabled": true,
  "PublicKey": "...",
  "PrivateKey": "...",
  "Subject": "mailto:ops@example.com"
}
```

2. Enable the frontend flag: `NEXT_PUBLIC_FF_webPush=true`
3. Enable SW in development if needed: `NEXT_PUBLIC_ENABLE_SW=true`
4. Apply migration `20260730120000_AddPushSubscriptions`
