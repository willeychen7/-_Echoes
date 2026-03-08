import { computeKinshipViaMumuy } from './src/lib/kinshipBridge.ts';

// 模拟节点构造器
const createNode = (id, name, gender, g, h, s, spouseId = null, fatherId = null, mId = null) => ({
    id, name, gender,
    generation_num: g,
    ancestral_hall: h,
    sibling_order: s,
    spouse_id: spouseId,
    father_id: fatherId,
    mother_id: mId
});

/**
 * 💡 终极深度测试场景 (52.0+ 亲家识别模式):
 * 1. 父系: 爷爷 (g1) + 奶奶 (g1w) -> 爸爸 (f1)
 * 2. 母系: 外公 (mg) + 外婆 (mgw) -> 妈妈 (m1)
 * 3. 联姻: 爸爸 (f1) + 妈妈 (m1) 是夫妻
 * 4. 目标: 爷爷 看 外公 应该是 "亲家公"
 */

// G28
const g1 = createNode(281, "爷爷 (老大)", "male", 28, "大房", 1);
const g1w = createNode(282, "奶奶", "female", 28, "大房", 1, 281);
g1.spouse_id = 282;

const mg = createNode(287, "外公", "male", 28, "外家房", 1);
const mgw = createNode(288, "外婆", "female", 28, "外家房", 1, 287);
mg.spouse_id = 288;

// G29
const f1 = createNode(291, "爸爸", "male", 29, "大房", 1, null, 281, 282);
const m1 = createNode(299, "妈妈", "female", 29, "大房", 1, 291, 287, 288);
f1.spouse_id = 299;

// G30
const s1 = createNode(301, "我", "male", 30, "大房", 1, null, 291, 299);

const allMembers = [g1, g1w, mg, mgw, f1, m1, s1];

function runTest(viewer, title) {
    console.log(`\n--- 🚀 视角: ${title} (${viewer.name}, G${viewer.generation_num}) ---`);
    allMembers.filter(m => m.id !== viewer.id).forEach(target => {
        const res = computeKinshipViaMumuy(target, viewer, allMembers);
        console.log(`我 看 [${target.name}] -> ${res}`);
    });
}

runTest(g1, "爷爷");
runTest(mg, "外公");
runTest(s1, "User (我)");
