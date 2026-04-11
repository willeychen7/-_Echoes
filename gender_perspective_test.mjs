
import relationship from 'relationship.js';

const members = [
    { id: 1, name: "本人(女)", gender: "female", father_id: 2, generation_num: 30 },
    { id: 2, name: "爸爸", gender: "male", father_id: 3, generation_num: 29 },
    { id: 3, name: "爷爷", gender: "male", generation_num: 28 },
    { id: 4, name: "亲弟弟", gender: "male", father_id: 2, generation_num: 30 },
    { id: 5, name: "侄子 (弟之子)", gender: "male", father_id: 4, generation_num: 31 },
    { id: 10, name: "丈夫", gender: "male", spouse_id: 1, father_id: 20, generation_num: 30 },
    { id: 20, name: "公公", gender: "male", generation_num: 29 },
    { id: 21, name: "小叔子 (夫之弟)", gender: "male", father_id: 20, generation_num: 30 }
];

function getMumuyChain(vId, tId) {
    const queue = [{ id: vId, path: [] }];
    const visited = new Set([vId]);
    while (queue.length > 0) {
        const { id, path } = queue.shift();
        if (id === tId) return path.join('的');
        const node = members.find(m => m.id === id);
        if (!node) continue;
        const adj = [];
        
        // Up
        if (node.father_id) adj.push({ id: node.father_id, t: '爸爸' });
        
        // Spouse
        if (node.spouse_id) {
            const sp = members.find(m => m.id === node.spouse_id);
            adj.push({ id: node.spouse_id, t: sp.gender === 'female' ? '老婆' : '老公' });
        }
        const invSpouse = members.find(m => m.spouse_id === id);
        if (invSpouse) {
            adj.push({ id: invSpouse.id, t: invSpouse.gender === 'female' ? '老婆' : '老公' });
        }

        // Down
        const kids = members.filter(m => m.father_id === id);
        kids.forEach(k => adj.push({ id: k.id, t: k.gender === 'female' ? '女儿' : '儿子' }));

        // Sibling
        if (node.father_id) {
            const sibs = members.filter(m => m.father_id === node.father_id && m.id !== id);
            sibs.forEach(s => adj.push({ id: s.id, t: s.id < id ? '哥哥' : '弟弟' }));
        }

        for (const next of adj) {
            if (!visited.has(next.id)) {
                visited.add(next.id);
                queue.push({ id: next.id, path: [...path, next.t] });
            }
        }
    }
}

console.log("--- 视角测试：本人为女性 (Gender: Female) ---");
const test = (vId, tId, label) => {
    const chain = getMumuyChain(vId, tId);
    if (!chain) { console.log(`[${label}] 未连接`); return; }
    const result = relationship({text: chain, sex: 0});
    console.log(`[${label}] 路径: ${chain} | 称谓: ${result}`);
};

test(1, 4, "我 -> 弟弟");
test(1, 5, "我 -> 侄子");
test(1, 21, "我 -> 小叔子");
test(1, 20, "我 -> 公公");

console.log("\n--- 对比测试：本人为男性 (Gender: Male) ---");
const testMale = (vId, tId, label) => {
    const chain = getMumuyChain(vId, tId);
    if (!chain) { console.log(`[${label}] 未连接`); return; }
    const result = relationship({text: chain, sex: 1});
    console.log(`[${label}] 路径: ${chain} | 称谓: ${result}`);
};
// Re-linking for male me
members[0].gender = 'male'; 
members[0].name = "本人(男)";
// In male case, spouse is wife
const wife = { id: 101, name: "妻子", gender: "female", spouse_id: 1, father_id: 200 };
const fatherInLaw = { id: 200, name: "岳父", gender: "male" };
members.push(wife, fatherInLaw);

testMale(1, 4, "我 -> 弟弟");
testMale(1, 101, "我 -> 妻子");
testMale(1, 200, "我 -> 岳父");
