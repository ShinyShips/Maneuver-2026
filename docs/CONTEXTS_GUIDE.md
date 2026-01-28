# Contexts Guide

This guide covers all the React contexts provided by the maneuver-core framework for state management and cross-component communication.

## Table of Contents

- [GameContext](#gamecontext)
- [ScoutContext](#scoutcontext)
- [NotificationContext](#notificationcontext)
- [SettingsContext](#settingscontext)
- [DataSyncContext](#datasynccontext)

---

## GameContext

Provides access to game-specific implementations of the framework interfaces.

### Setup

```tsx
import { GameProvider } from '@maneuver-core/contexts';
import { gameConfig, scoring, validation, analysis, uiComponents } from './game-2025';

function App() {
  return (
    <GameProvider
      config={gameConfig}
      scoring={scoring}
      validation={validation}
      analysis={analysis}
      ui={uiComponents}
    >
      <YourApp />
    </GameProvider>
  );
}
```

### Usage

```tsx
import { useGame } from '@maneuver-core/contexts';

function MyComponent() {
  const { config, scoring, validation, analysis, ui } = useGame();
  
  // Use game-specific logic
  const totalPoints = scoring.calculateTotalPoints(entry);
  const isValid = validation.validateEntry(entry);
  
  return <div>Score: {totalPoints}</div>;
}
```

### Context Value

```typescript
interface GameContextValue {
  config: GameConfig;                    // Game metadata & constants
  scoring: ScoringCalculations;          // Point calculations
  validation: ValidationRules;           // Match validation
  analysis: StrategyAnalysis;            // Team statistics
  ui: UIComponents;                      // Game-specific UI screens
}
```

---

## ScoutContext

Manages the current scout profile and scouts list across the application. Provides reactive state management for scout selection, eliminating the need for localStorage polling or page refreshes.

### Setup

Already set up in App.tsx - wraps the entire application:

```tsx
import { ScoutProvider } from '@/core/contexts/ScoutContext';

function App() {
  return (
    <ScoutProvider>
      <YourApp />
    </ScoutProvider>
  );
}
```

### Usage

```tsx
import { useScout } from '@/core/contexts/ScoutContext';

function MyComponent() {
  const { currentScout, currentScoutStakes, scoutsList, addScout, removeScout } = useScout();
  
  // Display current scout
  if (!currentScout) {
    return <div>Please select a scout</div>;
  }
  
  // Add a new scout
  const handleAddScout = async () => {
    await addScout('Riley Davis');
  };
  
  return (
    <div>
      <p>Scouting as: {currentScout}</p>
      <p>Stakes: {currentScoutStakes}</p>
    </div>
  );
}
```

### Context Value

```typescript
interface ScoutContextType {
  currentScout: string;                  // Current scout name
  currentScoutStakes: number;            // Current scout's stakes
  scoutsList: string[];                  // All available scouts
  isLoading: boolean;                    // Initial loading state
  setCurrentScout: (name: string) => Promise<void>;  // Set current scout
  addScout: (name: string) => Promise<void>;         // Add new scout
  removeScout: (name: string) => Promise<void>;      // Remove scout
  refreshScout: () => Promise<void>;                 // Refresh scout data
}
```

### Benefits

- **Reactive Updates**: Scout changes propagate immediately to all components
- **No Polling**: No need to check localStorage repeatedly
- **Type Safety**: Full TypeScript support
- **Offline First**: Works seamlessly offline, syncs with IndexedDB
- **Event Driven**: Listens for `scoutChanged` and `scoutDataCleared` events

### When to Use

Use ScoutContext when you need to:
- Display current scout name (e.g., in headers, forms)
- Validate that a scout is selected before actions
- Show scout stakes or achievements
- Allow scout selection/switching

**Don't use** ScoutContext for:
- One-time scout reads during page load (still OK to use, but context adds overhead)
- Components that never change based on scout

---

## NotificationContext

Centralized toast notification system for displaying messages, alerts, and confirmations.

### Setup

```tsx
import { NotificationProvider, Toaster } from '@maneuver-core';

function App() {
  return (
    <NotificationProvider
      defaultDuration={5000}  // 5 seconds
      maxNotifications={5}
    >
      <YourApp />
      <Toaster position="bottom-right" />
    </NotificationProvider>
  );
}
```

### Usage

```tsx
import { useNotifications } from '@maneuver-core/contexts';

function MyComponent() {
  const notifications = useNotifications();
  
  // Convenience methods
  notifications.success('Data saved successfully!');
  notifications.error('Failed to connect to server');
  notifications.warning('You have unsaved changes');
  notifications.info('New update available');
  
  // Custom notification
  notifications.showNotification({
    type: 'success',
    title: 'Upload Complete',
    message: 'Successfully uploaded 50 entries',
    duration: 3000,
    action: {
      label: 'View',
      onClick: () => navigate('/data')
    }
  });
  
  // Manual dismiss
  const id = notifications.info('Processing...');
  setTimeout(() => notifications.dismissNotification(id), 2000);
  
  return <button onClick={() => notifications.success('Clicked!')}>Click</button>;
}
```

### API Reference

```typescript
interface NotificationContextValue {
  notifications: Notification[];                      // Current notifications
  showNotification: (notification) => string;         // Returns notification ID
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  
  // Convenience methods
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;  // 0 = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Toaster Component

```tsx
<Toaster 
  position="bottom-right"  // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  maxWidth="384px"
/>
```

---

## SettingsContext

User preferences and app configuration with localStorage persistence.

### Setup

```tsx
import { SettingsProvider } from '@maneuver-core/contexts';

function App() {
  return (
    <SettingsProvider
      storageKey="app-settings"
      defaults={{ theme: 'dark', compactMode: true }}
    >
      <YourApp />
    </SettingsProvider>
  );
}
```

### Usage

```tsx
import { useSettings } from '@maneuver-core/contexts';

function SettingsPage() {
  const { settings, updateSettings, resetSettings, isDarkMode } = useSettings();
  
  return (
    <div>
      {/* Theme */}
      <select
        value={settings.theme}
        onChange={(e) => updateSettings({ theme: e.target.value })}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      
      {/* Accessibility */}
      <label>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
        />
        Reduce motion
      </label>
      
      {/* Reset */}
      <button onClick={resetSettings}>Reset to Defaults</button>
    </div>
  );
}
```

### Settings Interface

```typescript
interface AppSettings {
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // Notifications
  enableNotifications: boolean;
  soundEnabled: boolean;
  
  // Data
  autoSync: boolean;
  syncInterval: number;  // minutes
  confirmBeforeDelete: boolean;
  
  // UI Preferences
  compactMode: boolean;
  showDebugInfo: boolean;
}
```

### API Reference

```typescript
interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Convenience getters
  isDarkMode: boolean;
  isCompactMode: boolean;
  shouldReduceMotion: boolean;
}
```

---

## DataSyncContext

Manages the state of data synchronization operations (QR codes, WebRTC, API sync).

### Setup

```tsx
import { DataSyncProvider } from '@maneuver-core/contexts';

function App() {
  return (
    <DataSyncProvider maxHistory={50}>
      <YourApp />
    </DataSyncProvider>
  );
}
```

### Usage

```tsx
import { useDataSync } from '@maneuver-core/contexts';

function QRTransferPage() {
  const {
    isSyncing,
    lastSyncTime,
    startSync,
    updateSync,
    completeSync,
    getTotalRecordsSynced
  } = useDataSync();
  
  const handleQRScan = async (data: string) => {
    const syncId = startSync('qr', 100);  // 100 records to transfer
    
    try {
      // Process data...
      updateSync(syncId, { recordsTransferred: 50 });  // Update progress
      
      // Complete
      completeSync(syncId, 100);  // Success: 100 records transferred
    } catch (error) {
      completeSync(syncId, 0, error.message);  // Error
    }
  };
  
  return (
    <div>
      {isSyncing && <p>Syncing...</p>}
      {lastSyncTime && <p>Last sync: {new Date(lastSyncTime).toLocaleString()}</p>}
      <p>Total records synced: {getTotalRecordsSynced()}</p>
    </div>
  );
}
```

### API Reference

```typescript
interface DataSyncContextValue {
  operations: SyncOperation[];          // History of sync operations
  isSyncing: boolean;                   // Any active syncs?
  lastSyncTime: number | null;         // Timestamp of last successful sync
  
  startSync: (method: SyncMethod, totalRecords?: number) => string;  // Returns sync ID
  updateSync: (id: string, update: Partial<SyncOperation>) => void;
  completeSync: (id: string, recordsTransferred: number, error?: string) => void;
  clearHistory: () => void;
  
  getTotalRecordsSynced: () => number;
  getLastSuccessfulSync: () => SyncOperation | null;
}

interface SyncOperation {
  id: string;
  method: 'qr' | 'webrtc' | 'api' | 'manual';
  status: 'idle' | 'syncing' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  recordsTransferred: number;
  totalRecords?: number;
  error?: string;
}
```

---

## Combining Contexts

Wrap your app with multiple providers:

```tsx
import {
  GameProvider,
  NotificationProvider,
  SettingsProvider,
  DataSyncProvider
} from '@maneuver-core/contexts';
import { Toaster } from '@maneuver-core/components';

function App() {
  return (
    <SettingsProvider>
      <NotificationProvider>
        <DataSyncProvider>
          <GameProvider {...gameImplementation}>
            <YourApp />
            <Toaster />
          </GameProvider>
        </DataSyncProvider>
      </NotificationProvider>
    </SettingsProvider>
  );
}
```

---

## Best Practices

1. **NotificationContext:**
   - Use `success` for positive actions (save, delete, create)
   - Use `error` for failures (no auto-dismiss by default)
   - Use `warning` for non-critical issues
   - Use `info` for neutral information
   - Always place `<Toaster />` at the root level

2. **SettingsContext:**
   - Provide sensible defaults for all settings
   - Use `updateSettings` to update multiple settings at once
   - Persist critical settings to localStorage automatically
   - Use convenience getters (`isDarkMode`) instead of checking settings directly

3. **DataSyncContext:**
   - Always call `startSync` before beginning a sync operation
   - Update progress frequently for better UX
   - Always call `completeSync` (even on error)
   - Use `isSyncing` to disable UI during sync

4. **GameContext:**
   - Only use `useGame` in components that need game-specific logic
   - Don't destructure all fields if you only need one
   - Game implementations should validate their implementations match the interfaces

---

**Framework Philosophy:** Contexts provide global state for cross-cutting concerns. Keep context values focused and use multiple contexts instead of one giant context.
