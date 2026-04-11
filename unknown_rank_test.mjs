
import relationship from 'relationship.js';

function normalizeGender(g) {
    if (!g) return 'male';
    const s = String(g).toLowerCase();
    if (s === 'female' || s === '0' || s === '女' || s === '妇') return 'female';
    return 'male';
}

function getLogicTag(side, connector, rank) {
    const s = side === 'paternal' ? '[F]' : '[M]';
    const paths = {
        father: 'f', grandfather: 'f,f', sibling: 'sib', self_p: 'x', self_m: 'x,m',
        paternal_cousin_elder: 'f,f,b', mother: 'm'
    };
    const path = paths[connector] || 'unknown';
    let r = '';
    if (rank && rank !== '不知道') {
        r = `-o${rank}`;
    } else if (rank === '不知道') {
        r = `-oUNKNOWN`;
    }
    return `${s}-${path}${r}`;
}

const members = [
  { id: 1, name: "本人", gender: "male", father_id: 10, generation_num: 30 },
  { id: 10, name: "父亲", gender: "male", father_id: 20, generation_num: 29 },
  { id: 20, name: "爷爷", gender: "male", generation_num: 28 },
];

console.log("--- UNKNOWN RANK STRESS TEST ---");

// Helper to simulate "Finding or Creating" a virtual parent
const getOrCreateVirtualParent = (childName, rel, gender, side, connector, rank, gen) => {
    const tag = getLogicTag(side, connector, rank);
    let parent = members.find(m => m.logic_tag === tag);
    if (!parent) {
        const isUnknown = !rank || rank === '不知道';
        const pName = isUnknown ? `${childName}的父辈(待定)` : `${rank}房伯叔`;
        parent = { id: Date.now() + Math.random(), name: pName, gender, logic_tag: tag, generation_num: gen - 1 };
        members.push(parent);
    }
    return parent;
};

// 1. Add Cousin A (Unknown Branch)
console.log("Adding Cousin A (Unknown Rank)...");
const pA = getOrCreateVirtualParent("堂哥A", "父亲", "male", "paternal", "paternal_cousin_elder", "不知道", 30);
members.push({ id: 101, name: "堂哥A", father_id: pA.id, logic_tag: "[F]-x-oUNKNOWN", generation_num: 30 });

// 2. Add Cousin B (Unknown Branch)
console.log("Adding Cousin B (Unknown Rank)...");
const pB = getOrCreateVirtualParent("堂姐B", "父亲", "male", "paternal", "paternal_cousin_elder", "不知道", 30);
members.push({ id: 102, name: "堂姐B", father_id: pB.id, logic_tag: "[F]-x-oUNKNOWN", generation_num: 30 });

// 3. Add Cousin C (Big Branch)
console.log("Adding Cousin C (Big Branch)...");
const pC = getOrCreateVirtualParent("堂弟C", "父亲", "male", "paternal", "paternal_cousin_elder", "大", 30);
members.push({ id: 103, name: "堂弟C", father_id: pC.id, logic_tag: "[F]-x-o大", generation_num: 30 });

console.log("\nFinal Family Structure Check:");
members.forEach(m => {
    if (m.father_id) {
        const father = members.find(f => f.id === m.father_id);
        console.log(`${m.name} -> Father: ${father ? father.name : 'Unknown'} (${m.logic_tag})`);
    } else if (m.logic_tag && m.name.includes("父辈")) {
        console.log(`Virtual Node: ${m.name} [Tag: ${m.logic_tag}]`);
    }
});
