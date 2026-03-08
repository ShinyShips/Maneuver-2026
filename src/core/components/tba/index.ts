/**
 * TBA (The Blue Alliance) API Components
 * 
 * Year-agnostic components for loading and managing FRC event data from TBA.
 * 
 * Component Organization:
 * - DataManagement: Data loading, display, and operations (match data, teams, validation display)
 * - EventConfiguration: Event setup and configuration (event selector, data type selector)
 * - MatchSelector: Generic match selection component
 * - ProcessingResults: Data processing feedback component
 * 
 * API Configuration:
 * API keys are configured via environment variables in .env file:
 * - VITE_TBA_API_KEY: The Blue Alliance API key
 * - VITE_NEXUS_API_KEY: Nexus Stats API key (optional, for pit data)
 * 
 * GAME-SPECIFIC (commented out - implement in your game repo):
 * - ValidationTesting: Test data generation and validation testing
 * - ValidationResults: Validation result display components
 */

// Core TBA Components
export { MatchSelector } from './MatchSelector';
export { ProcessingResults } from './ProcessingResults';

// GAME-SPECIFIC: Uncomment and implement dependencies in your game repo
// export * from './ValidationTesting';
// export * from './ValidationResults';

// Data Management
export * from './DataManagement';

// Event Configuration
export * from './EventConfiguration';
