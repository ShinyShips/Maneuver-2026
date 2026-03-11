export interface DistributedColorOptions {
    baseHue?: number;
    saturation?: number;
    lightness?: number;
}

const GOLDEN_ANGLE_DEGREES = 137.508;

// Spread hues using the golden angle so adjacent series remain visually distinct.
export function getDistributedColor(index: number, options: DistributedColorOptions = {}): string {
    const {
        baseHue = 210,
        saturation = 70,
        lightness = 50,
    } = options;

    const hue = (baseHue + index * GOLDEN_ANGLE_DEGREES) % 360;
    return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
}
