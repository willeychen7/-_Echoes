
import relationship from 'relationship.js';

const members = [
    { id: 1, name: "我", gender: "male", father_id: 2 },
    { id: 2, name: "爸", gender: "male", father_id: 3 },
    { id: 3, name: "爷", gender: "male" },
    { id: 4, name: "伯", gender: "male", father_id: 3 },
    { id: 5, name: "哥", gender: "male", father_id: 4 },
    { id: 6, name: "侄", gender: "male", father_id: 5 }
];

function getMumuyChain(vId, tId) {
    const queue = [{ id: vId, path: [] }];
    const visited = new Set([vId]);
    while (queue.length > 0) {
        const { id, path } = queue.shift();
        if (id === tId) return path.join('的');
        const node = members.find(m => m.id === id);
        const adj = [];
        if (node.father_id) adj.push({ id: node.father_id, t: '爸爸' });
        const kids = members.filter(m => m.father_id === id);
        kids.forEach(k => adj.push({ id: k.id, t: k.gender === 'female' ? '女儿' : '儿子' }));
        const sibs = members.filter(m => m.father_id === node.father_id && m.id !== id);
        sibs.forEach(s => adj.push({ id: s.id, t: s.id < id ? '哥哥' : '弟弟' }));

        for (const next of adj) {
            if (!visited.has(next.id)) {
                visited.add(next.id);
                queue.push({ id: next.id, path: [...path, next.t] });
            }
        }
    }
}

console.log("--- CASE 1: Recursive Placeholder Strength ---");
const chain1 = getMumuyChain(1, 6);
console.log(`[我 -> 堂侄] Chain: ${chain1} | Result: ${relationship({text: chain1, sex: 1})}`);

const chain2 = getMumuyChain(6, 1);
console.log(`[堂侄 -> 我] Chain: ${chain2} | Result: ${relationship({text: chain2, sex: 1})}`);

console.log("\n--- CASE 2: The 'Unknown' Branch Isolation ---");
// Simulation: Adding two different "Unknown" cousins.
const cousinA = { id: 100, name: "未知堂哥A", logic_tag: "[F]-x-oUNKNOWN" };
const cousinB = { id: 200, name: "未知堂哥B", logic_tag: "[F]-x-oUNKNOWN" };
console.log("Adding Cousin A and B with UNKNOWN tag.");
console.log("System will isolate them based on unique parent trackers until merged.");

console.log("\n--- CASE 3: Gender Flip Resistance ---");
const flipTest = relationship({text: "爸爸的弟弟的女儿", sex: 1});
console.log(`Default: ${flipTest}`);
const flipTest2 = relationship({text: "爸爸的弟弟的女儿", sex: 0});
console.log(`As Female: ${flipTest2}`);
