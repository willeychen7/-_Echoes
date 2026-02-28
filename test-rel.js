import { getRelativeRelationship, deduceRole } from "./src/lib/relationships.js";
console.log("son -> 舅舅:", deduceRole("son", "舅舅"));
console.log("uncle_m from father POV:", getRelativeRelationship("father", "uncle_m", "fallback_uncle"));
console.log("son -> grandfather_p POV:", getRelativeRelationship("son", "grandfather_p", "fallback"));
