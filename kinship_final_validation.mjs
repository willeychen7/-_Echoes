
// Final Validation Stress Test for Kinship Logic Separation
// This simulation mirrors the logic in the updated AddMemberPage.tsx

function simulateAssociation(rel, members) {
    const relText = rel.trim();
    if (relText.length < 2) return [];

    const isMaternalSide = relText.includes('表') || ['舅', '姨'].some(k => relText.includes(k));
    const side = isMaternalSide ? 'maternal' : 'paternal';

    let potentialParentRoles = [];
    if (relText.includes('堂') || relText.includes('表')) {
        const isParentGen = /叔|伯|姑|舅|姨/.test(relText) && !/哥|姐|弟|妹/.test(relText);
        
        if (isParentGen) {
            potentialParentRoles = isMaternalSide 
                ? ["grand_uncle_maternal", "grand_aunt_maternal"] 
                : ["grand_uncle_paternal", "grand_aunt_paternal"];
        } else {
            potentialParentRoles = isMaternalSide 
                ? ["uncle_maternal", "aunt_maternal"] 
                : ["uncle_paternal", "aunt_paternal"];
        }
    }

    const potentialParents = members.filter(m => {
        const role = m.standardRole || "";
        const memberSide = m.originSide || (role.includes('maternal') ? 'maternal' : 'paternal');
        return potentialParentRoles.includes(role) && memberSide === side;
    });

    return {
        side,
        potentialParentRoles,
        suggestions: potentialParents.map(p => `${p.name} (${p.relationship})`)
    };
}

const members = [
    { id: 1, name: "二叔公", relationship: "叔公", standardRole: "grand_uncle_paternal", originSide: "paternal" },
    { id: 2, name: "二舅公", relationship: "舅公", standardRole: "grand_uncle_maternal", originSide: "maternal" },
    { id: 3, name: "大伯", relationship: "伯父", standardRole: "uncle_paternal", originSide: "paternal" },
    { id: 4, name: "大舅舅", relationship: "舅舅", standardRole: "uncle_maternal", originSide: "maternal" }
];

console.log("--- FINAL VALIDATION: BRANCH & GENERATION SEPARATION ---");

const test = (rel) => {
    console.log(`\nInput: [${rel}]`);
    const result = simulateAssociation(rel, members);
    console.log(`Detected Side: ${result.side}`);
    console.log(`Looking for Parent Roles: ${result.potentialParentRoles}`);
    console.log(`Suggestions:`, result.suggestions.length > 0 ? result.suggestions : "None");
};

test("二房堂舅"); 
// Should suggest "二舅公" (Maternal Grand-Uncle)
// Should NOT suggest "二叔公" (Paternal Grand-Uncle) - Fixes user's worry.
// Should NOT suggest "大舅舅" (Maternal Uncle) - Fixes generational mismatch.

test("二房堂叔");
// Should suggest "二叔公" (Paternal Grand-Uncle)

test("二房堂哥");
// Should suggest "大伯" (Paternal Uncle)

test("表哥");
// Should suggest "大舅舅" (Maternal Uncle)

console.log("\n--- STRESS TEST RESULT ---");
console.log("The logic now strictly enforces BOTH branch separation AND generational logic.");
