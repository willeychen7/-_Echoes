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
 * 💡 终极深度测试场景 (40.0+ 宗法&姻亲全模型):
 * 1. 父系 (Patrilineal): 
 *    G27: 曾祖父(gRoot)
 *    G28: 爷爷(g1), 奶奶(g1w), 二叔公(g2), 二婶婆(g2w)...
 *    G29: 爸爸(f1), 妈妈(m1), 二叔(f2), 小姑(f3)...
 *    G30: 我(User/s2), 亲哥(s1)
 * 2. 母系 (Matrilineal):
 *    G28: 外公(mg), 外婆(mgw) -> 妈妈(m1) 的父母
 */

const gRoot = createNode(270, "曾祖父", "male", 27, "根房", 1);

// G28 - 祖辈
const g1 = createNode(281, "爷爷 (老大)", "male", 28, "大房", 1, null, 270);
const g1w = createNode(282, "奶奶 (大房母)", "female", 28, "大房", 1, 281);
g1.spouse_id = 282;

const g2 = createNode(283, "二叔公 (老二)", "male", 28, "二房", 2, null, 270);
const g2w = createNode(284, "二婶婆 (二房母)", "female", 28, "二房", 2, 283);
g2.spouse_id = 284;

const mg = createNode(287, "外公", "male", 28, "外家房", 1);
const mgw = createNode(288, "外婆", "female", 28, "外家房", 1, 287);
mg.spouse_id = 288;

// G29 - 父亲辈
const f1 = createNode(291, "爸爸 (老大)", "male", 29, "大房", 1, null, 281, 282);
const m1 = createNode(299, "妈妈", "female", 29, "大房", 1, 291, 287, 288); // 妈妈的父母是外公外婆
f1.spouse_id = 299;

const f2 = createNode(292, "二叔 (老二)", "male", 29, "大房", 2, null, 281, 282);
const f3 = createNode(293, "小姑 (老三)", "female", 29, "大房", 3, null, 281, 282);

// G30 - 孙辈
const s1 = createNode(301, "亲哥哥", "male", 30, "大房", 1, null, 291, 299);
const s2 = createNode(302, "我 (User)", "male", 30, "大房", 2, null, 291, 299);

const allMembers = [gRoot, g1, g1w, g2, g2w, mg, mgw, f1, m1, f2, f3, s1, s2];

function runTest(viewer, title) {
    console.log(`\n--- 🚀 视角: ${title} (${viewer.name}, G${viewer.generation_num}) ---`);
    allMembers.filter(m => m.id !== viewer.id).forEach(target => {
        const res = computeKinshipViaMumuy(target, viewer, allMembers);
        console.log(`我 看 [${target.name || target.id}] -> ${res}`);
    });
}

runTest(mg, "外公");
runTest(mgw, "外婆");
runTest(m1, "妈妈 (姻亲/母系)");
runTest(s2, "User (我)");
