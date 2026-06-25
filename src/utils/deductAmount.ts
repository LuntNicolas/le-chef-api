import {unitEnum} from "../db/schema.ts";

type UnitEnumValue = typeof unitEnum.enumValues[number];

function toBase(quantity: number, unit: string): number {
    switch (unit.toLowerCase()) {
        case "kg":
            return quantity * 1000;   // → g
        case "l":
            return quantity * 1000;   // → ml
        default:
            return quantity;           // g, ml, stück etc. bleiben
    }
}

function toBaseUnit(unit: string): UnitEnumValue {
    switch (unit.toLowerCase()) {
        case "kg":
            return "g";
        case "l":
            return "ml";
        case "stück":
        case "packung":
        case "flasche":
        case "glas":
        case "dose":
            return "stück";
        default:
            return unit.toLowerCase() as UnitEnumValue;
    }
}

export function deductAmount(
    fridgeQuantity: number,
    fridgeUnit: string,
    recipeQuantity: number,
    recipeUnit: string,
): { remaining: number; unit: string } | null {
    const fridgeBase = toBase(fridgeQuantity, fridgeUnit);
    const recipeBase = toBase(recipeQuantity, recipeUnit);
    const baseUnit = toBaseUnit(fridgeUnit);

    // Inkompatible Units (z.B. ml vs g) – nicht abziehen
    if (toBaseUnit(fridgeUnit) !== toBaseUnit(recipeUnit)) return null;

    const remaining = fridgeBase - recipeBase;
    return {remaining, unit: baseUnit};
}