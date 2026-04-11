
import relationship from 'relationship.js';

const normalizeGender = (g) => {
    if (!g) return 'male';
    const s = String(g).toLowerCase();
    if (s === 'female' || s === '0' || s === '女' || s === '妇') return 'female';
    return 'male';
};

const TOKEN_MAP = {
    f: '爸爸', m: '妈妈', h: '老公', w: '老婆', s: '儿子', d: '女儿',
    xb: '哥哥', ob: '弟弟', xs: '姐姐', os: '妹妹'
};

function getMumuyPath(vId, tId, members) {
    const queue = [{ id: vId, path: [] }];
    const visited = new Set([vId]);
    
    while (queue.length > 0) {
        const { id, path } = queue.shift();
        if (id === tId) return path.map(t => TOKEN_MAP[t] || t).join('的');
        
        const node = members.find(m => m.id === id);
        if (!node) continue;
        const adj = [];
        
        // Up
        if (node.father_id) adj.push({ id: node.father_id, t: 'f' });
        if (node.mother_id) adj.push({ id: node.mother_id, t: 'm' });
        
        // Spouse
        if (node.spouse_id) adj.push({ id: node.spouse_id, t: normalizeGender(node.gender) === 'female' ? 'h' : 'w' });
        
        // Children
        const kids = members.filter(m => m.father_id === id || m.mother_id === id);
        kids.forEach(k => adj.push({ id: k.id, t: normalizeGender(k.gender) === 'female' ? 'd' : 's' }));
        
        // Siblings (Logic match kinshipBridge)
        const fId = node.father_id;
        const mId = node.mother_id;
        if (fId || mId) {
            const sibs = members.filter(m => (fId && m.father_id === fId) || (mId && m.mother_id === mId));
            sibs.forEach(sib => {
                if (sib.id === id) return;
                // Only consider full siblings for simplified token
                const isFull = (fId && sib.father_id === fId) && (mId && sib.mother_id === mId);
                if (isFull) {
                    const isF = normalizeGender(sib.gender) === 'female';
                    const token = isF ? (sib.id < node.id ? 'xs' : 'os') : (sib.id < node.id ? 'xb' : 'ob');
                    adj.push({ id: sib.id, t: token });
                }
            });
        }

        for (const next of adj) {
            if (!visited.has(next.id)) {
                visited.add(next.id);
                queue.push({ id: next.id, path: [...path, next.t] });
            }
        }
    }
    return null;
}

const members = [
    { id: 1, name: "本人(男)", gender: "male", father_id: 10, mother_id: 11 },
    { id: 10, name: "爸爸", gender: "male", father_id: 20, mother_id: 21 },
    { id: 11, name: "妈妈", gender: "female", father_id: 30, mother_id: 31 },
    { id: 20, name: "爷爷", gender: "male" },
    { id: 21, name: "奶奶", gender: "female", father_id: 50, mother_id: 51 },
    { id: 30, name: "外公", gender: "male", father_id: 40, mother_id: 41 },
    { id: 31, name: "外婆", gender: "female" },
    { id: 40, name: "外曾祖父", gender: "male" },
    { id: 41, name: "外曾祖母", gender: "female" },
    { id: 32, name: "外公的亲兄弟", gender: "male", father_id: 40, mother_id: 41 },
    { id: 33, name: "堂舅 (目标A)", gender: "male", father_id: 32 },
    { id: 50, name: "太外公", gender: "male" },
    { id: 51, name: "太外婆", gender: "female" },
    { id: 22, name: "奶奶的亲兄弟", gender: "male", father_id: 50, mother_id: 51 },
    { id: 23, name: "表姑 (目标B)", gender: "female", father_id: 22 }
];

console.log("🚀 COMPLEX KINSHIP STRESS TEST (堂舅/表姑妈)\n");

const runTest = (vId, tId, label) => {
    const v = members.find(m => m.id === vId);
    const t = members.find(m => m.id === tId);
    const chain = getMumuyPath(vId, tId, members);
    if (!chain) {
        console.log(`[${label}] 路径未找到！`);
        return;
    }
    try {
        const results = relationship({ text: chain, sex: normalizeGender(v.gender) === 'female' ? 0 : 1 });
        console.log(`[${label}]`);
        console.log(`视角: ${v.name} -> ${t.name}`);
        console.log(`路径: ${chain}`);
        console.log(`结果: ${results.length > 0 ? results.join(' / ') : '无法识别'}`);
        
        const revChain = getMumuyPath(tId, vId, members);
        const revResults = relationship({ text: revChain, sex: normalizeGender(t.gender) === 'female' ? 0 : 1 });
        console.log(`反向视角: ${t.name} -> ${v.name}`);
        console.log(`反向路径: ${revChain}`);
        console.log(`反向结果: ${revResults.length > 0 ? revResults.join(' / ') : '无法识别'}`);
    } catch (e) {
        console.error(`[${label}] ERROR:`, e.message, "Chain was:", chain);
    }
    console.log("-" .repeat(40));
};

runTest(1, 33, "CASE 1: 堂舅 (母之堂兄弟)");
runTest(1, 23, "CASE 2: 表姑妈 (父之表姐妹)");
runTest(33, 1, "CASE 3: 堂外甥");
runTest(23, 1, "CASE 4: 表侄子");
