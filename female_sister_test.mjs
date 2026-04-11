
import relationship from 'relationship.js';

const members = [
    { id: 1, name: "本人(女)", gender: "female", father_id: 2 },
    { id: 2, name: "爸爸", gender: "male" },
    { id: 3, name: "妹妹", gender: "female", father_id: 2 },
    { id: 4, name: "妹妹的儿子", gender: "male", father_id: 5, mother_id: 3 },
    { id: 5, name: "妹夫", gender: "male", spouse_id: 3 }
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
        if (node.father_id) adj.push({ id: node.father_id, t: '爸爸' });
        if (node.mother_id) adj.push({ id: node.mother_id, t: '妈妈' });
        const kids = members.filter(m => m.father_id === id || m.mother_id === id);
        kids.forEach(k => adj.push({ id: k.id, t: k.gender === 'female' ? '女儿' : '儿子' }));
        if (node.father_id || node.mother_id) {
            const sibs = members.filter(m => (m.father_id && m.father_id === node.father_id) || (m.mother_id && m.mother_id === node.mother_id));
            sibs.forEach(s => { if (s.id !== id) adj.push({ id: s.id, t: s.id < id ? '姐姐' : '妹妹' }); });
        }
        for (const next of adj) {
            if (!visited.has(next.id)) {
                visited.add(next.id);
                queue.push({ id: next.id, path: [...path, next.t] });
            }
        }
    }
}

console.log("--- 视角测试：本人为女性 (姊妹家系) ---");
const chain = getMumuyChain(1, 4);
console.log(`[我 -> 妹妹的儿子] 路径: ${chain} | 称谓: ${relationship({text: chain, sex: 0})}`);
