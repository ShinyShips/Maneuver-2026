# Data Transfer System - QR Code Fountain Codes

**Framework Component - Game-Agnostic**

This document describes the QR code data transfer system using Luby Transform fountain codes for reliable offline data exchange.

## Overview

The data transfer system consists of:

1. **UniversalFountainGenerator** - Generates QR code sequences with fountain encoding
2. **UniversalFountainScanner** - Scans and reconstructs data from QR codes
3. **compressionUtils** - Generic compression/decompression utilities

## Features

### Fountain Code Technology

- **Luby Transform Encoding**: Breaks large datasets into smaller, manageable QR code segments
- **Scan in Any Order**: Packets don't need to be scanned sequentially
- **Redundancy**: ~30-50% extra packets ensure reliable reconstruction
- **Progressive Decoding**: Automatically completes when enough packets are received

### Smart Compression

- **Automatic Detection**: Compresses data > 10KB automatically
- **pako gzip**: Standard compression for all data types
- **Custom Compression**: Game implementations can provide field-specific compression
- **90% Size Reduction**: Typical compression ratio for scouting data

### User Experience

- **Auto-Cycling**: QR codes automatically cycle at configurable speeds (1-2 per second)
- **Playback Controls**: Pause, skip forward/back, jump to specific packets
- **Progress Tracking**: Real-time reconstruction progress percentage
- **Missing Packets**: Shows which packets still need to be scanned
- **Offline-First**: No internet required - fully offline operation

## Architecture

- `src/core/lib/compressionUtils.ts` (150 lines) - Generic compression utilities
- `src/core/components/data-transfer/UniversalFountainGenerator.tsx` (613 lines) - QR generator component
- `src/core/components/data-transfer/UniversalFountainScanner.tsx` (577 lines) - QR scanner component
- `src/core/components/ui/progress.tsx` (28 lines) - Progress bar UI component
- `src/components/index.ts` - Export updates for data transfer components
- `src/lib/index.ts` - Export updates for compression utilities
- `docs/DATA_TRANSFER.md` (470+ lines) - Comprehensive documentation
- Integration testing validation

## Component: UniversalFountainGenerator

### Props Interface

```typescript
interface UniversalFountainGeneratorProps {
  onBack: () => void;
  onSwitchToScanner?: () => void;
  dataType: string; // e.g., 'scouting', 'match', 'scout-profiles'
  loadData: () => Promise<unknown> | unknown;
  compressData?: (data: unknown, originalJson?: string) => Uint8Array;
  title: string;
  description: string;
  noDataMessage: string;
}
```

### Usage Example

```typescript
import { UniversalFountainGenerator } from '@/core/components/data-transfer/UniversalFountainGenerator';

function MyFountainGenerator() {
  const loadMyData = async () => {
    // Load data from database/API
    return await db.myTable.toArray();
  };

  return (
    <UniversalFountainGenerator
      onBack={() => navigate('/')}
      onSwitchToScanner={() => setMode('scan')}
      dataType="my-data"
      loadData={loadMyData}
      title="Generate My Data QR Codes"
      description="Create multiple QR codes for reliable data transfer"
      noDataMessage="No data found. Create some data first."
    />
  );
}
```

### Custom Compression

Game implementations can provide optimized compression:

```typescript
import { compressScoutingData } from '@/game/compression';

<UniversalFountainGenerator
  dataType="scouting"
  loadData={loadScoutingData}
  compressData={compressScoutingData} // Custom compression function
  // ... other props
/>
```

## Component: UniversalFountainScanner

### Props Interface

```typescript
interface UniversalFountainScannerProps {
  onBack: () => void;
  onSwitchToGenerator?: () => void;
  dataType: string;
  expectedPacketType: string; // e.g., 'scouting_fountain_packet'
  saveData: (data: unknown) => void | Promise<void>;
  validateData: (data: unknown) => boolean;
  getDataSummary: (data: unknown) => string;
  decompressData?: (compressedData: Uint8Array) => unknown;
  title: string;
  description: string;
  completionMessage: string;
}
```

### Usage Example

```typescript
import { UniversalFountainScanner } from '@/core/components/data-transfer/UniversalFountainScanner';

function MyFountainScanner() {
  const saveMyData = async (data: unknown) => {
    // Validate and save to database
    await db.myTable.bulkAdd(data.entries);
  };

  const validateMyData = (data: unknown) => {
    return data && typeof data === 'object' && 'entries' in data;
  };

  const getDataSummary = (data: unknown) => {
    return `${data.entries.length} entries`;
  };

  return (
    <UniversalFountainScanner
      onBack={() => navigate('/')}
      onSwitchToGenerator={() => setMode('generate')}
      dataType="my-data"
      expectedPacketType="my-data_fountain_packet"
      saveData={saveMyData}
      validateData={validateMyData}
      getDataSummary={getDataSummary}
      title="Scan My Data QR Codes"
      description="Point your camera at the QR codes to receive data"
      completionMessage="Data has been successfully reconstructed and saved"
    />
  );
}
```

## Compression Utilities

### shouldUseCompression

```typescript
import { shouldUseCompression } from '@/core/lib/compressionUtils';

const jsonString = JSON.stringify(data);
const useCompression = shouldUseCompression(data, jsonString); // true if > 10KB
```

### compressData / decompressData

```typescript
import { compressData, decompressData } from '@/core/lib/compressionUtils';

// Compress
const compressed = compressData(data);

// Decompress
const original = decompressData<MyDataType>(compressed);
```

### getCompressionStats

```typescript
import { getCompressionStats } from '@/core/lib/compressionUtils';

const stats = getCompressionStats(originalData, compressedData);
console.log(`Compression: ${(100 - stats.compressionRatio * 100).toFixed(1)}%`);
console.log(`QR Codes: ${stats.estimatedQRReduction}`);
```

## Data Flow

### Generation Flow

```
1. Load Data (loadData function)
2. Check Size (shouldUseCompression)
3. Compress (optional - compressData or custom)
4. Encode Binary (TextEncoder)
5. Generate Packets (Luby Transform fountain codes)
6. Display QR Codes (auto-cycling with controls)
```

### Scanning Flow

```
1. Scan QR Code (camera input)
2. Parse Packet (JSON.parse)
3. Validate Type (expectedPacketType)
4. Add to Decoder (Luby Transform decoder)
5. Check Completion (decoder.addBlock returns true)
6. Reconstruct Data (decoder.getDecoded)
7. Decompress (if needed)
8. Validate Data (validateData function)
9. Save Data (saveData function)
10. Show Completion Screen
```

## Packet Structure

```typescript
interface FountainPacket {
  type: string; // "{dataType}_fountain_packet"
  sessionId: string; // Unique session identifier
  packetId: number; // Sequential packet number (0-indexed)
  k: number; // Number of source blocks
  bytes: number; // Size of source data
  checksum: string; // Data integrity check
  indices: number[]; // Block indices used in this packet
  data: string; // Base64 encoded binary data
}
```

## Performance Characteristics

### Compression Ratios

- **Scouting Data**: ~90% reduction (10KB → 1KB typical)
- **Match Schedules**: ~70% reduction
- **Scout Profiles**: ~60% reduction
- **Generic JSON**: ~50-70% reduction

### QR Code Capacity

- **Per QR Code**: ~2000 bytes (QR_CODE_SIZE_BYTES)
- **Block Size**: 200 bytes
- **Typical Dataset**: 50-100 entries = 5-10 QR codes

### Redundancy Factors

- **Small Datasets** (< 20 blocks): 50% redundancy (1.5x packets)
- **Large Datasets** (≥ 20 blocks): 30% redundancy (1.3x packets)

## Testing

### Testing Data Size Requirements

```typescript
const MIN_FOUNTAIN_SIZE_COMPRESSED = 50; // bytes
const MIN_FOUNTAIN_SIZE_UNCOMPRESSED = 100; // bytes
```

Data must meet minimum size requirements for fountain code generation.

### Testing Strategy

1. **Unit Tests**: Test compression/decompression utilities
2. **Integration Tests**: Test packet generation/reconstruction
3. **E2E Tests**: Test complete transfer workflow
4. **Browser Tests**: Test camera QR scanning
5. **Device Tests**: Test on real mobile devices

### Test Data Generation

```typescript
// Generate test data that meets size requirements
const testData = {
  entries: Array.from({ length: 10 }, (_, i) => ({
    id: `test-${i}`,
    field1: `value-${i}`,
    field2: Math.random() * 100,
    // ... more fields to meet size requirement
  }))
};
```

## Browser Support

### Generator

- ✅ Chrome/Edge (Desktop + Mobile)
- ✅ Firefox (Desktop + Mobile)
- ✅ Safari (Desktop + Mobile)

### Scanner

- ✅ Chrome/Edge (Desktop + Mobile) - Camera API
- ✅ Firefox (Desktop + Mobile) - Camera API
- ✅ Safari (iOS 14+) - Camera API
- ⚠️ Safari (iOS <14) - Limited camera access

### Required Features

- JavaScript ES6+
- Web Workers (for compression)
- Canvas API (for QR rendering)
- MediaDevices API (for camera scanning)

## Troubleshooting

### "Data too small for fountain codes"

**Problem**: Dataset doesn't meet minimum size requirement

**Solutions**:
- Add more data entries
- Include additional fields
- Combine multiple datasets
- Use standard JSON export instead

### "QR Scanner not working on iOS"

**Problem**: Safari camera permissions

**Solutions**:
1. Check Settings → Safari → Camera = Allow
2. Use HTTPS (required for camera access)
3. Tap "Allow" on camera permission prompt
4. Reload page after granting permission

### "Packets stuck at 90%"

**Problem**: Missing packets preventing completion

**Solutions**:
1. Check "Missing Packets" indicator
2. Use manual navigation to jump to missing packets
3. Slow down cycle speed for better scanning
4. Ensure good lighting conditions
5. Hold device steady while scanning

### "Compression not working"

**Problem**: Custom compression function not being called

**Solutions**:
1. Ensure data size > COMPRESSION_THRESHOLD (10KB)
2. Provide `compressData` prop to generator
3. Check console for compression logs (dev mode)
4. Verify custom compression function signature

## Security Considerations

### Data Validation

Always validate reconstructed data:

```typescript
const validateData = (data: unknown) => {
  // Check structure
  if (!data || typeof data !== 'object') return false;
  
  // Check required fields
  if (!('entries' in data)) return false;
  
  // Check data types
  if (!Array.isArray(data.entries)) return false;
  
  // Validate each entry
  return data.entries.every(isValidEntry);
};
```

### XSS Prevention

- QR data is JSON-parsed (not eval'd)
- All user input is sanitized
- No HTML injection in data fields

### Data Integrity

- Checksum verification on each packet
- Validation before saving
- Error handling for corrupted data

## Future Enhancements

### Phase 2 (Post-Framework)

- **Progressive Web Workers**: Offload compression to background
- **Batch Import**: Import multiple datasets in sequence
- **QR History**: Track previously scanned QR codes
- **Resume Sessions**: Continue interrupted transfers
- **Data Preview**: Show sample data before importing

### Phase 3 (Advanced Features)

- **WebRTC Integration**: Direct peer-to-peer transfer
- **Bluetooth Transfer**: Alternative to QR codes
- **Cloud Backup**: Optional sync to cloud storage
- **Team Sharing**: Share datasets with team members

## Best Practices

1. **Test on Real Devices**: QR scanning behaves differently on mobile
2. **Good Lighting**: Ensure adequate lighting for camera scanning
3. **Steady Hands**: Hold device steady while scanning
4. **Clean Screen**: Ensure QR code display is clear
5. **Error Handling**: Always validate and handle errors gracefully
6. **User Feedback**: Show clear progress and status indicators
7. **Compression Testing**: Test with real-world dataset sizes
8. **Browser Testing**: Test on target browsers (especially Safari iOS)

## Integration with Game Implementations

Game implementations should:

1. Create wrapper components for specific data types
2. Provide custom compression functions (optional)
3. Implement data validation logic
4. Handle conflict resolution (for duplicate data)
5. Provide user-friendly error messages

Example integration:

```typescript
// Game-specific wrapper
export function ScoutingDataFountainGenerator() {
  return (
    <UniversalFountainGenerator
      dataType="scouting"
      loadData={loadScoutingData}
      compressData={compressScoutingData}
      title="Generate Scouting Data QR Codes"
      description="Transfer scouting data between devices"
      noDataMessage="No scouting data found. Scout some matches first!"
      onBack={() => navigate('/transfer')}
    />
  );
}
```

## Framework Philosophy

**Keep it Generic:**
- No game-specific field names in core components
- All customization via props/callbacks
- Compression is optional and customizable
- Validation is delegated to game implementation

**Make it Reusable:**
- Single generator/scanner for all data types
- Common compression utilities
- Consistent UI patterns
- Clear prop interfaces

**Ensure Reliability:**
- Fountain codes handle packet loss
- Redundancy ensures completion
- Progress tracking shows status
- Error handling at every step

---

**Built for extensibility, designed for simplicity.** 🤖

