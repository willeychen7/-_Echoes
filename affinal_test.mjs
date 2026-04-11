
function detectSide(s) {
    const femaleKeywords = ["姨", "姑", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "女"];
    const maleKeywords = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "侄子", "外甥", "男", "子"];

    // Simplified logic from AddMemberPage.tsx
    const isMaternalNode = s.includes('表') || s.includes('舅') || s.includes('姨');
    // Note: includes('姑') is in PaternalNode
    const isPaternalNode = s.includes('堂') || ['哥', '姐', '弟', '妹', '叔', '伯', '姑'].some(k => s.includes(k));

    let side = 'unknown';
    if (isMaternalNode) {
        // If it includes both (like 表姑), and we want stricter paternal for "Gu/Shu/Bo"
        if (s.includes('姑') || s.includes('叔') || s.includes('伯')) {
             if (s.includes('表') && (s.includes('姨') || s.includes('舅'))) {
                 side = 'maternal'; // Clearly maternal (e.g. 表姨)
             } else if (s.includes('表') && (s.includes('姑') || s.includes('叔') || s.includes('伯'))) {
                 // In traditional logic:
                 // Biao Gu / Biao Shu / Biao Bo are paternal cousins (father's sister's kids or father's cousins)
                 // BUT in common usage, some use them for maternal side too.
                 // HOWEVER, "Gu" is very strongly paternal.
                 side = 'paternal'; 
             } else {
                 side = 'maternal'; // Fallback
             }
        } else {
            side = 'maternal';
        }
    } else if (isPaternalNode) {
        side = 'paternal';
    }

    return side;
}

// Current AddMemberPage.tsx logic simulation
function currentAddMemberPageLogic(s) {
    const isMaternalNode = s.includes('表') || s.includes('舅') || s.includes('姨');
    const isPaternalNode = s.includes('堂') || ['哥', '姐', '弟', '妹', '叔', '伯', '姑'].some(k => s.includes(k));

    if (isMaternalNode) return 'maternal';
    if (isPaternalNode) return 'paternal';
    return 'unknown';
}

console.log("--- AFFINAL KINSHIP SIDE DETECTION TEST ---");

const testCases = ["表姨丈", "表姑丈", "堂舅", "堂姨", "表哥", "表弟"];

console.log("\n[CURRENT LOGIC IN AddMemberPage.tsx]");
testCases.forEach(t => {
    console.log(`${t} -> ${currentAddMemberPageLogic(t)}`);
});

console.log("\n[ANALYSIS]");
console.log("表姨丈 matches 'Maternal' because of '表' and '姨'. Correct.");
console.log("表姑丈 matches 'Maternal' because of '表', even though '姑' is paternal. POTENTIAL CONFLICT.");
console.log("In Chinese kinship, '表姑' (Biao Gu) is the daughter of a paternal grandfather's sister, or more commonly father's cousin. It belongs to PATERNAL side (宗亲) but is 'Biao' because of gender-crossing ancestors.");
console.log("However, '表姨丈' is definitely MATERNAL.");

console.log("\n--- STRESS TEST: Affinal Category ---");
const isAffinal = (s) => ['嫂', '媳', '婿', '岳', '婆', '公', '丈', '婶', '妈', '姻'].some(k => s.includes(k)) && !['父亲', '母亲', '爸爸', '妈妈', '外公', '外婆'].includes(s);

testCases.forEach(t => {
  console.log(`${t} is Affinal? ${isAffinal(t)}`);
});
