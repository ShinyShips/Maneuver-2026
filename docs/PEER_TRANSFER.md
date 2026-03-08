# Peer Transfer (WebRTC WiFi Transfer)

**Framework Component - Game-Agnostic**

Real-time data transfer between devices over WiFi using WebRTC peer-to-peer connections.

## Overview

The Peer Transfer system enables lead scouts to push or request data from connected scout devices without requiring internet connectivity - just a local WiFi network.

### Key Features

- **Real-time Transfer**: Instant data sync between devices
- **No Internet Required**: Works on local WiFi networks
- **Multiple Data Types**: Scouting, pit scouting, match schedules, scout profiles
- **Push & Pull**: Lead can push data to scouts or request data from them
- **Conflict Resolution**: Smart merge with duplicate detection

### ⚠️ Network Requirements

> **Important:** All devices must be on the **same local WiFi network**.

WebRTC establishes a direct peer-to-peer connection between devices. This requires:

1. **Same Network**: Devices must share the same WiFi access point (e.g., venue WiFi, mobile hotspot)
2. **No NAT Traversal**: Unlike internet-based WebRTC (video calls), this system does **not** use TURN servers for relay
3. **Local IP Visibility**: Devices exchange local IP addresses to connect directly

**Why it won't work over long distance:**
- Different WiFi networks = different IP address spaces
- Firewalls and NAT prevent cross-network P2P connections
- The signaling server only exchanges connection info; it doesn't relay data

**At competitions:**
- ✅ All devices on venue WiFi → Works
- ✅ All devices on team's mobile hotspot → Works
- ❌ Lead on venue WiFi, scouts on cellular → Won't connect
- ❌ Devices on different hotspots → Won't connect

For transfers across different networks, use [JSON file export](./JSON_DATA_TRANSFER.md) or [QR codes](./DATA_TRANSFER.md) instead.

## Architecture

```
┌─────────────────┐         Netlify Functions          ┌─────────────────┐
│   Lead Device   │ ←──── Signaling Server ────→ │  Scout Device   │
│                 │         (Room Codes)               │                 │
└────────┬────────┘                                    └────────┬────────┘
         │                                                      │
         └──────────── WebRTC Data Channel ────────────────────┘
                    (Direct P2P Connection)
```

### Core Files

| File | Purpose |
|------|---------|
| `src/core/contexts/WebRTCContext.tsx` | WebRTC connection state and methods |
| `src/core/hooks/usePeerTransferPush.ts` | Push data to connected scouts |
| `src/core/hooks/usePeerTransferImport.ts` | Auto-import received data |
| `src/core/pages/PeerTransferPage.tsx` | Main WiFi transfer page |
| `src/core/components/peer-transfer/` | UI components |
| `netlify/functions/webrtc-signal.ts` | Signaling server for room codes |

## Data Format

All transferred data uses a **wrapped format** with metadata:

```typescript
{
  entries: ScoutingEntryBase[],  // The actual data
  version: '3.0-maneuver-core',  // Schema version
  exportedAt: 1704153600000      // Timestamp
}
```

### Data Types

| Type | Format | Description |
|------|--------|-------------|
| `scouting` | `{ entries, version, exportedAt }` | Match scouting data |
| `pit-scouting` | `{ entries, version, exportedAt }` | Pit scouting entries |
| `match` | `{ matches }` | Match schedule |
| `scout` | `{ scouts, predictions, achievements }` | Scout profiles |
| `combined` | `{ entries, scoutProfiles, metadata }` | Scouting + profiles |

## Usage

### Lead Scout Mode

1. Navigate to **Settings → WiFi Transfer**
2. Select **Lead Scout** mode
3. Create a room (generates 6-digit code)
4. Share code with scouts
5. Once connected:
   - **Push**: Send your data to all scouts
   - **Request**: Pull data from scouts

### Scout Mode

1. Navigate to **Settings → WiFi Transfer**
2. Select **Scout** mode
3. Enter the room code from lead
4. Accept/decline pushed data when prompted

## Components

### `LeadScoutMode`
Main interface for lead scout with connected scout list and data controls.

### `ScoutMode`
Scout interface showing connection status and push notifications.

### `RoomCodeConnection`
Handles room creation (lead) and room joining (scout).

### `ConnectedScoutCard`
Individual scout card with push/request/disconnect actions.

### `WebRTCPushedDataDialog`
Popup shown to scouts when lead pushes data.

### `DataTransferControls`
Data type selector dropdown.

## Hooks

### `usePeerTransferPush`
```typescript
const { pushData, loadDataByType } = usePeerTransferPush({
  addToReceivedData,
  pushDataToAll
});

// Push scouting data to all connected scouts
await pushData('scouting', connectedScounts);
```

### `usePeerTransferImport`
```typescript
const {
  showConflictDialog,
  currentConflicts,
  handleConflictResolution
} = usePeerTransferImport();

// Auto-imports received data with conflict detection
```

## Netlify Functions Setup

The signaling server requires Netlify Functions:

### `netlify.toml`
```toml
[functions]
  directory = "netlify/functions"

[dev]
  command = "npm run dev:vite"
  port = 8888
  targetPort = 5173
```

### Development
```bash
# Install netlify-cli (v17.37.10 recommended)
npm install -D netlify-cli@17.37.10

# Run with Netlify dev server
npm run dev
```

## Related Documentation

- [DATA_TRANSFER.md](./DATA_TRANSFER.md) - QR code fountain transfer
- [JSON_DATA_TRANSFER.md](./JSON_DATA_TRANSFER.md) - File import/export
- [DATABASE.md](./DATABASE.md) - Data structures and storage
