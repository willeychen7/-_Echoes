
import relationship from 'relationship.js';

function normalizeGender(g) {
    if (!g) return 'male';
    const s = String(g).toLowerCase();
    if (s === 'female' || s === '0' || s === '女' || s === '妇') return 'female';
    return 'male';
}

function getExplicitOrder(node) {
    return node.sibling_order ?? 99;
}

function getMumuyPathTokens(viewer, target, members) {
    if (!viewer || !target || String(viewer.id) === String(target.id)) return null;
    const queue = [{ id: String(viewer.id), path: [] }];
    const visited = new Set([String(viewer.id)]);
    const TOKEN_MAP = { f: '爸爸', m: '妈妈', h: '老公', w: '老婆', s: '儿子', d: '女儿', xb: '哥哥', ob: '弟弟', xs: '姐姐', os: '妹妹' };

    while (queue.length > 0) {
        const { id, path } = queue.shift();
        if (id === String(target.id)) return path.map(t => TOKEN_MAP[t] || t).join('的');
        const node = members.find(m => String(m.id) === id);
        if (!node) continue;
        const adj = [];
        
        // 1. Up
        if (node.father_id) adj.push({ id: node.father_id, token: 'f' });
        if (node.mother_id) adj.push({ id: node.mother_id, token: 'm' });
        
        // 2. Spouse
        if (node.spouse_id) {
            adj.push({ id: node.spouse_id, token: normalizeGender(node.gender) === 'female' ? 'h' : 'w' });
        } else {
             const sp = members.find(m => m.spouse_id === node.id);
             if (sp) adj.push({ id: sp.id, token: normalizeGender(node.gender) === 'female' ? 'h' : 'w' });
        }

        // 3. Down
        const children = members.filter(m => String(m.father_id) === id || String(m.mother_id) === id);
        for (const child of children) adj.push({ id: child.id, token: normalizeGender(child.gender) === 'female' ? 'd' : 's' });
        
        // 4. Siblings
        const fId = node.father_id;
        const mId = node.mother_id;
        if (fId || mId) {
            const sibs = members.filter(m => (fId && String(m.father_id) === String(fId)) || (mId && String(m.mother_id) === String(mId)));
            for (const sib of sibs) {
                if (String(sib.id) === id) continue;
                const isF = normalizeGender(sib.gender) === 'female';
                const sRank = getExplicitOrder(sib);
                const nRank = getExplicitOrder(node);
                const token = isF ? (sRank < nRank ? 'xs' : 'os') : (sRank < nRank ? 'xb' : 'ob');
                adj.push({ id: sib.id, token });
            }
        }

        for (const next of adj) {
            if (!visited.has(String(next.id))) {
                visited.add(String(next.id));
                queue.push({ id: String(next.id), path: [...path, next.token] });
            }
        }
    }
    return null;
}

function computeKinship(viewer, target, members) {
  const chain = getMumuyPathTokens(viewer, target, members);
  if (!chain) return "未连接";
  const results = relationship({ text: chain, sex: normalizeGender(viewer.gender) === 'female' ? 0 : 1 });
  return results[0] || "亲戚";
}

// Comprehensive Test Data
const members = [
  // Generation 1 (Me)
  { id: 1, name: "本人 (男)", gender: "male", father_id: 10, mother_id: 11, sibling_order: 2 },
  { id: 2, name: "堂哥", gender: "male", father_id: 12, sibling_order: 1 },
  // Generation 0 (Parents)
  { id: 10, name: "父亲", gender: "male", father_id: 20, mother_id: 21, sibling_order: 2 },
  { id: 11, name: "母亲", gender: "female", father_id: 30, mother_id: 31 },
  { id: 12, name: "伯父", gender: "male", father_id: 20, mother_id: 21, sibling_order: 1 },
  { id: 13, name: "舅舅", gender: "male", father_id: 30, mother_id: 31 },
  // Generation -1 (Grandparents)
  { id: 20, name: "爷爷", gender: "male" },
  { id: 21, name: "奶奶", gender: "female", father_id: 40 },
  { id: 30, name: "外公", gender: "male", father_id: 50 },
  { id: 31, name: "外婆", gender: "female" },
  // Generation -2 (Great Grandparents / Great Aunts)
  { id: 40, name: "曾祖父 (奶奶的爹)", gender: "male" },
  { id: 41, name: "姨婆 (奶奶的姐妹)", gender: "female", father_id: 40, sibling_order: 1 },
  { id: 21, father_id: 40, sibling_order: 2 }, // Link Granny properly
  { id: 50, name: "外曾祖父 (外公的丈人?)", gender: "male" },
  { id: 51, name: "堂舅 (外公的兄弟的儿子)", gender: "male", father_id: 52 },
  { id: 52, name: "外伯公 (外公的兄弟)", gender: "male", father_id: 50, sibling_order: 1 },
];

console.log("--- ADVANCED KINSHIP STRESS TEST ---");
const test = (vId, tId) => {
  const v = members.find(m => m.id === vId);
  const t = members.find(m => m.id === tId);
  const result = computeKinship(v, t, members);
  console.log(`[${v.name}] -> [${t.name}]: ${result}`);
};

// 1. Common checks
test(1, 2); // 我 -> 堂哥 (Should be 堂哥)
test(2, 1); // 堂哥 -> 我 (Should be 堂弟)
test(1, 13); // 我 -> 舅舅
test(1, 21); // 我 -> 奶奶
test(1, 41); // 我 -> 姨婆 (奶奶的姐妹)
test(41, 1); // 姨婆 -> 我 (Should be 甥孙)
test(1, 51); // 我 -> 堂舅 (Should be 伯表叔/堂舅 -> Mumuy calls it 表舅)
test(51, 1); // 堂舅 -> 我
