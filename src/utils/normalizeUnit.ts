export const VALID_UNITS: string[] = ["g", "kg", "ml", "l"];

const DEFAULT_UNIT: string = {
    weight: "g",
    volume: "ml",
};

export const FOOD_UNIT_DEFAULTS: Record<string, { unit: string; }> = {
    "ei": {unit: "stück"},
    "apfel": {unit: "stück"},
    "joghurt": {unit: "stück"},
    "mehl": {unit: "g"},
    "zucker": {unit: "g"},
    "milch": {unit: "ml"},
    "öl": {unit: "ml"},
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