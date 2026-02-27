/**
 * TBA (The Blue Alliance) API Components
 * 
 * Year-agnostic components for loading and managing FRC event data from TBA.
 * 
 * Component Organization:
 * - DataManagement: Data loading, display, and operations (match data, teams, validation display)
 * - EventConfiguration: Event setup and configuration (event selector, data type selector)
 * - ProcessingResults: Data processing feedback component
 * 
 * API Configuration:
 * API keys should be configured as server-side env vars (Netlify Functions):
 * - TBA_API_KEY (or TBA_AUTH_KEY)
 * - NEXUS_API_KEY (or NEXUS_AUTH_KEY)
 * 
 * GAME-SPECIFIC (commented out - implement in your game repo):
 * - ValidationTesting: Test data generation and validation testing
 * - ValidationResults: Validation result display components
 */

// Core TBA Components
export { ProcessingResults } from './ProcessingResults';

// GAME-SPECIFIC: Uncomment and implement dependencies in your game repo
// export * from './ValidationTesting';
// export * from './ValidationResults';

// Data Management
export * from './DataManagement';

// Event Configuration
export * from './EventConfiguration';
