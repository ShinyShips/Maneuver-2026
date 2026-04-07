# Experiment: Spatial vs. Form-Based Scouting Interface

This directory contains the experimental interfaces used in the CS 6795 Cognitive Science term project comparing a spatial map-based scouting interface with a traditional form-based scouting interface.

## Overview

The experiment uses a within-subjects design where participants scout FRC match video clips using both interface types. The application is built with React, TypeScript, and Vite as part of the [Maneuver-2026](https://github.com/ShinyShips/maneuver-2026) scouting platform.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/ShinyShips/maneuver-2026.git
cd maneuver-2026

# Install dependencies
npm install

# Start the development server
npm run dev:vite
```

### Accessing the Experiment Interfaces

Once the development server is running, navigate to the experiment entry point:

```
http://localhost:5173/test
```

This opens the **Experiment Setup** page where you can:

1. Select a counterbalancing group (Group A or Group B)
2. Complete the informed consent process
3. Start a session

### Experiment Flow

The session automatically guides participants through the following pages:

| Route | Page | Description |
|---|---|---|
| `/test` | Experiment Setup | Group selection, consent, session start |
| `/test/interface/visual` | Spatial Interface | Interactive field map for scouting |
| `/test/interface/form` | Form Interface | Traditional form-based scouting |
| `/test/tlx` | NASA-TLX | Cognitive load questionnaire after each block |
| `/test/preferences` | Preference Survey | Interface comparison ratings |
| `/test/answer-key` | Answer Key Builder | Tool for creating ground-truth answer keys |
| `/test/results` | Results + Export | View and export collected experiment data |

### Exporting Data

After sessions are completed, navigate to `/test/results` or use the export buttons on the setup page to download data as CSV or JSON.

## Source Files

The experiment code lives in `src/core/pages/test/`:

- `TestLandingPage.tsx` - Experiment setup and session creation
- `TestVisualScoutingPage.tsx` - Spatial (visual) scouting interface
- `TestFormScoutingPage.tsx` - Form-based scouting interface
- `TestTLXPage.tsx` - NASA-TLX questionnaire
- `TestPreferencePage.tsx` - Post-experiment preference survey
- `TestAnswerKeyPage.tsx` - Answer key creation tool
- `TestResultsPage.tsx` - Results viewer and data export
