
import relationship from 'relationship.js';

const normalizeGender = (g) => {
    if (!g) return 'male';
    const s = String(g).toLowerCase();
    if (s === 'female' || s === '0' || s === '女' || s === '妇') return 'female';
    return 'male';
};

// 模拟数据库中的成员
const members = [
    { id: 1, name: "本人(男)", gender: "male", father_id: 10, mother_id: 11, generation_num: 30 },
    { id: 10, name: "爸爸", gender: "male" },
    { id: 11, name: "亲妈", gender: "female" },
    { id: 12, name: "后妈", gender: "female" },
    // 亲弟弟：同父同母，ID 较大，判定为弟弟
    { id: 2, name: "亲弟弟", gender: "male", father_id: 10, mother_id: 11, generation_num: 30 },
    // 同父异母弟弟：同父不同母，ID 较大，判定为弟弟
    { id: 3, name: "同父异母弟弟", gender: "male", father_id: 10, mother_id: 12, generation_num: 30 }
];

function getMumuyChain(vId, tId) {
    const queue = [{ id: vId, path: [] }];
    const visited = new Set([vId]);
    
    const TOKEN_MAP = {
        f: '爸爸', m: '妈妈', h: '老公', w: '老婆', s: '儿子', d: '女儿',
        xb: '哥哥', ob: '弟弟', xs: '姐姐', os: '妹妹'
    };

    while (queue.length > 0) {
        const { id, path } = queue.shift();
        if (id === tId) return path.map(t => TOKEN_MAP[t] || t).join('的');
        
        const node = members.find(m => m.id === id);
        if (!node) continue;
        
        const adj = [];
        if (node.father_id) adj.push({ id: node.father_id, t: 'f' });
        
        // 模拟最新的 kinshipBridge 逻辑：统一使用 xb/ob
        const fId = node.father_id;
        const mId = node.mother_id;
        if (fId || mId) {
            const potentialSibs = members.filter(m => (fId && m.father_id === fId) || (mId && m.mother_id === mId));
            for (const sib of potentialSibs) {
                if (sib.id === id) continue;
                
                // 统一赋予长幼 token
                const isF = sib.gender === 'female';
                const token = isF ? (sib.id < node.id ? 'xs' : 'os') : (sib.id < node.id ? 'xb' : 'ob');
                adj.push({ id: sib.id, t: token });
            }
        }
        
        // 子嗣路径
        const kids = members.filter(m => m.father_id === id || m.mother_id === id);
        kids.forEach(k => adj.push({ id: k.id, t: k.gender === 'female' ? 'd' : 's' }));

        for (const next of adj) {
            if (!visited.has(next.id)) {
                visited.add(next.id);
                queue.push({ id: next.id, path: [...path, next.t] });
            }
        }
    }
    return null;
}

console.log("🚀 FIXED HALF-SIBLING LOGIC TEST\n");

const check = (vId, tId, label) => {
    const chain = getMumuyChain(vId, tId);
    const result = relationship({ text: chain, sex: 1 });
    console.log(`[${label}] 路径: ${chain} | 结果: ${result[0] || '?'}`);
};

check(1, 2, "我 -> 亲弟弟");
check(1, 3, "我 -> 同父异母弟弟");
check(3, 1, "同父异母弟弟 -> 我");
check(1, 12, "我 -> 后妈"); // 顺便测一下由于路径打通后的姻亲
