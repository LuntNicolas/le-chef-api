export type UnitType = "count" | "weight" | "volume";

export const VALID_UNITS: Record<UnitType, string[]> = {
    count: ["stück", "packung", "flasche", "glas", "dose"],
    weight: ["g", "kg"],
    volume: ["ml", "l"],
};

const DEFAULT_UNIT: Record<UnitType, string> = {
    count: "stück",
    weight: "g",
    volume: "ml",
};

export const FOOD_UNIT_DEFAULTS: Record<string, { unit: string; unit_type: UnitType }> = {
    "ei": {unit: "stück", unit_type: "count"},
    "apfel": {unit: "stück", unit_type: "count"},
    "joghurt": {unit: "stück", unit_type: "count"},
    "mehl": {unit: "g", unit_type: "weight"},
    "zucker": {unit: "g", unit_type: "weight"},
    "milch": {unit: "ml", unit_type: "volume"},
    "öl": {unit: "ml", unit_type: "volume"},
};

function inferUnitType(rawUnit: string): UnitType {
    const u = rawUnit.toLowerCase().trim();
    if (VALID_UNITS.weight.includes(u)) return "weight";
    if (VALID_UNITS.volume.includes(u)) return "volume";
    return "count";
}

export function normalizeUnit(name: string, aiUnit: string, aiQuantity: number) {
    const key = name.toLowerCase().trim();

    const fallback = FOOD_UNIT_DEFAULTS[key];
    if (fallback) {
        return {unit: fallback.unit, unit_type: fallback.unit_type, quantity: aiQuantity};
    }

    const normalized = (aiUnit ?? "").toLowerCase().trim();   // <- der entscheidende Schritt
    const unit_type = inferUnitType(normalized);

    if (VALID_UNITS[unit_type].includes(normalized)) {
        return {unit: normalized, unit_type, quantity: aiQuantity};
    }

    return {unit: DEFAULT_UNIT[unit_type], unit_type, quantity: aiQuantity};
}