export const STUDY_CLIP_IDS = {
  block1: 'clip-1',
  block2: 'clip-2',
} as const;

export const STUDY_CLIP_OPTIONS = [
  { id: STUDY_CLIP_IDS.block1, label: 'Clip 1' },
  { id: STUDY_CLIP_IDS.block2, label: 'Clip 2' },
] as const;

export const AUTO_START_LOCATION_KEYS = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'] as const;

export const AUTO_START_LOCATION_OPTIONS = [
  { value: 'none', label: 'None / Unknown' },
  { value: 'trench1', label: 'Left Trench' },
  { value: 'bump1', label: 'Left Bump' },
  { value: 'hub', label: 'Hub' },
  { value: 'bump2', label: 'Right Bump' },
  { value: 'trench2', label: 'Right Trench' },
] as const;

export const SHOT_GRID_ROW_WEIGHTS = [0.45, 0.55, 0.45, 0.55, 0.45] as const;
export const SHOT_GRID_ROWS = SHOT_GRID_ROW_WEIGHTS.length;
export const SHOT_GRID_COLS = 5;
export const SHOT_GRID_CELL_COUNT = SHOT_GRID_ROWS * SHOT_GRID_COLS;
export const SHOT_GRID_SHOOTABLE_ROWS = [0, 1, 2, 3, 4] as const;

const totalRowWeight = SHOT_GRID_ROW_WEIGHTS.reduce((acc, weight) => acc + weight, 0);

export const SHOT_GRID_ROW_BOUNDARIES = SHOT_GRID_ROW_WEIGHTS.reduce<number[]>((boundaries, weight) => {
  const previous = boundaries[boundaries.length - 1] ?? 0;
  boundaries.push(previous + (weight / totalRowWeight));
  return boundaries;
}, []);

export const SHOT_GRID_CELL_LABELS = Array.from({ length: SHOT_GRID_CELL_COUNT }, (_, index) => {
  const row = Math.floor(index / SHOT_GRID_COLS);
  const col = index % SHOT_GRID_COLS;
  return `${String.fromCharCode(65 + row)}${col + 1}`;
});
