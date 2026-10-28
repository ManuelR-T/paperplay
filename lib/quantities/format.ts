/** Reading precision only. Scientific inputs, checksums and exports retain the original numeric value. */
export function formatScientificNumber(value:number){return Number(value.toPrecision(12)).toString();}
