
// Mocking the behavior of AddMemberPage's auto-association logic
// This logic is extracted directly from src/AddMemberPage.tsx and src/lib/relationships.ts

function getCleanRelationship(rel) {
    const specialTwoWords = ["大伯", "大爷", "大妈", "大娘", "老爸", "老妈", "老婆", "老公"];
    let clean = (rel || "").trim();
    if (!clean || specialTwoWords.includes(clean)) return clean;

    const rankRegex = /^(大|小|老|一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|再从|三从|族|排行|排行老|细|幺)+/;
    const match = clean.match(rankRegex);

    if (match && clean.length > match[0].length) {
        return clean.substring(match[0].length);
    }
    return clean;
}

function deduceRole(relationship) {
    const clean = getCleanRelationship(relationship);
    const map = {
        "爷爷": "grandfather_paternal", "奶奶": "grandmother_paternal",
        "外公": "grandfather_maternal", "外婆": "grandmother_maternal",
        "伯父": "uncle_paternal", "叔叔": "uncle_paternal", "姑姑": "aunt_paternal",
        "舅舅": "uncle_maternal", "阿姨": "aunt_maternal",
        "叔公": "grand_uncle_paternal", "伯公": "grand_uncle_paternal",
        "舅公": "grand_uncle_maternal", "姨婆": "grand_aunt_maternal"
    };
    return map[clean] || "family";
}

function getKinshipChoices(rel, members) {
    const choices = [];
    const baseRole = deduceRole(rel);
    const isMaternalSide = rel.includes('表') || ['舅', '姨'].some(k => rel.includes(k));
    const side = isMaternalSide ? 'maternal' : 'paternal';

    // 🚀 The problematic logic from AddMemberPage.tsx
    let potentialParentRoles = [];
    if (rel.includes('堂')) {
        // BUG 1: For "Tang Uncle" (堂舅/堂叔), it should look for Grand-Uncles.
        // BUG 2: Current code looks for Uncles/Aunts.
        potentialParentRoles = isMaternalSide ? ["uncle_maternal", "aunt_maternal"] : ["uncle_paternal", "aunt_paternal"];
    }

    const potentialParents = members.filter(m => {
        const role = m.standardRole || "";
        return potentialParentRoles.includes(role);
    });

    potentialParents.forEach(p => {
        choices.push({
            label: `是 ${p.name} (${p.relationship}) 的孩子`,
            side: side,
            parentId: p.id,
        });
    });

    return { side, choices };
}

const members = [
    { id: 101, name: "二叔公", relationship: "叔公", standardRole: "grand_uncle_paternal" },
    { id: 102, name: "二舅公", relationship: "舅公", standardRole: "grand_uncle_maternal" },
    { id: 103, name: "大伯", relationship: "伯父", standardRole: "uncle_paternal" },
    { id: 104, name: "亲舅舅", relationship: "舅舅", standardRole: "uncle_maternal" }
];

console.log("--- KINSHIP AUTO-ASSOCIATION STRESS TEST ---");

const test = (rel) => {
    console.log(`\nInput Identity: [${rel}]`);
    const { side, choices } = getKinshipChoices(rel, members);
    console.log(`Detected Side: ${side}`);
    console.log(`Suggestions:`, choices.length > 0 ? choices.map(c => c.label) : "None");
};

// Case 1: The user's specific concern (Er Shu Gong vs Tang Jiu)
test("二房堂舅"); 
// Output: Side: maternal, Suggestions: ["是 亲舅舅 (舅舅) 的孩子"] 
// Wait! It suggests "亲舅舅" because "堂舅" is maternal and code looks for "uncle_maternal".
// BUT IT DOES NOT suggest "二叔公" (paternal). 
// So the separation is working, even if the parent mapping is wrong.

// Case 2: Paternal Tang relative
test("二房堂哥");
// Output: Side: paternal, Suggestions: ["是 大伯 (伯父) 的孩子"]
// Correct.

// Case 3: Paternal Tang Uncle
test("二房堂叔");
// Output: Side: paternal, Suggestions: ["是 大伯 (伯父) 的孩子"]
// WRONG! Parent of "堂叔" should be "叔公", but code looks for "uncle" (大伯).

console.log("\n--- CONCLUSION ---");
console.log("The test confirms:");
console.log("1. Paternal and Maternal branches ARE separated correctly via the '舅/姨' vs '堂' detection.");
console.log("2. The suggestion engine has a generational bug: 'Tang' relatives of parent generation (like 堂舅/堂叔) are wrongly associated with uncles instead of grand-uncles.");
console.log("3. The user's claim that '二叔公' would be suggested for '堂舅' is impossible under current code UNLESS '二叔公' was mistakenly assigned a maternal role.");
