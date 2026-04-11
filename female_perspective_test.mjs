
import relationship from 'relationship.js';

const members = [
    { id: 1, name: "本人(女)", gender: "female", father_id: 2 },
    { id: 2, name: "爸", gender: "male", father_id: 3 },
    { id: 3, name: "爷", gender: "male" },
    { id: 4, name: "弟", gender: "male", father_id: 2 },
    { id: 5, name: "弟的孩子", gender: "male", father_id: 4 },
    { id: 10, name: "老公", gender: "male", spouse_id: 1 },
    { id: 11, name: "老公的弟", gender: "male", father_id: 12 },
    { id: 12, name: "公公", gender: "male" }
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
        if (node.spouse_id) adj.push({ id: node.spouse_id, t: node.gender === 'female' ? '老公' : '老婆' });
        const invSpouse = members.find(m => m.spouse_id === id);
        if (invSpouse) adj.push({ id: invSpouse.id, t: node.gender === 'female' ? '老公' : '老婆' });

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
    console.log(`[${label}] 路径: ${chain} | 称谓: ${relationship({text: chain, sex: 0})}`);
};

test(1, 4, "我 -> 弟弟");
test(1, 5, "我 -> 侄子");
test(1, 11, "我 -> 老公的弟弟 (小叔子)");
test(1, 12, "我 -> 公公");

console.log("\n--- 对比测试：如果我是男性 (Gender: Male) ---");
const testMale = (vId, tId, label) => {
    const chain = getMumuyChain(vId, tId);
    console.log(`[${label}] 路径: ${chain} | 称谓: ${relationship({text: chain, sex: 1})}`);
};
testMale(1, 11, "我(男) -> 老公的弟弟 (逻辑上不存在，除非同性)");
