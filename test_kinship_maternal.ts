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
 * 💡 深度测试场景: 外系完整版 (Maternal Side Mastery)
 * 1. 外公辈 (G28): 
 *    - 外公 (Rank 1), 老二 (Rank 2, M), 老三 (Rank 3, F)
 *    - 外婆, 外婆的妹妹
 * 2. 妈妈辈 (G29):
 *    - 妈妈 (Rank 1, F)
 *    - 二舅 (Rank 2, M), 舅妈
 *    - 三姨 (Rank 3, F)
 * 3. 孙辈 (G30):
 *    - 亲哥哥 (s1), User (s2)
 *    - 二舅的孩子: 姐姐, 弟弟
 *    - 三姨的孩子: 大姐 (Viewer 1), 二哥, 三妹
 * 4. 曾孙辈 (G31):
 *    - 三姨大姐的女儿
 */

const mgRoot = createNode(270, "外宗曾祖父", "male", 27, "外宗根", 1);

// G28
const mg = createNode(281, "外公 (老大)", "male", 28, "外家房", 1, null, 270);
const mg_b2 = createNode(283, "外二公 (老二)", "male", 28, "外家房", 2, null, 270);
const mg_s3 = createNode(285, "外三姑婆 (老三)", "female", 28, "外家房", 3, null, 270);

const mgw = createNode(282, "外婆", "female", 28, "外家房", 1, 281);
const mgw_s2 = createNode(288, "外婆的妹妹 (姨外婆)", "female", 28, "外婆家", 2);
mg.spouse_id = 282;

// G29
const m1 = createNode(291, "妈妈 (老大)", "female", 29, "外家房", 1, null, 281, 282);
const mu2 = createNode(292, "二舅 (老二)", "male", 29, "外家房", 2, null, 281, 282);
const mu2w = createNode(290, "舅妈", "female", 29, "外家房", 2, 292);
mu2.spouse_id = 290;

const ma3 = createNode(293, "三姨 (老三)", "female", 29, "外家房", 3, null, 281, 282);

// G30
const s1 = createNode(301, "亲哥哥", "male", 30, "大房", 1, null, null, 291);
const s2 = createNode(302, "User (我)", "male", 30, "大房", 2, null, null, 291);

const u2_sis = createNode(311, "二舅的女儿 (姐姐)", "female", 30, "外家房", 1, null, 292, 290);
const u2_bro = createNode(312, "二舅的儿子 (弟弟)", "male", 30, "外家房", 2, null, 292, 290);

const a3_sis1 = createNode(321, "三姨的大姐 (Viewer)", "female", 30, "外家房", 1, null, null, 293);
const a3_bro2 = createNode(322, "三姨的二哥", "male", 30, "外家房", 2, null, null, 293);
const a3_sis3 = createNode(323, "三姨的三妹", "female", 30, "外家房", 3, null, null, 293);

// G31
const a3_s1_d1 = createNode(401, "三姨大姐的女儿", "female", 31, "外家房", 1, null, null, 321);

const allMembers = [
    mgRoot, mg, mg_b2, mg_s3, mgw, mgw_s2,
    m1, mu2, mu2w, ma3,
    s1, s2, u2_sis, u2_bro, a3_sis1, a3_bro2, a3_sis3,
    a3_s1_d1
];

function runTest(viewer, title) {
    console.log(`\n--- 🚀 视角: ${title} (${viewer.name}, G${viewer.generation_num}) ---`);
    allMembers.filter(m => m.id !== viewer.id).forEach(target => {
        const res = computeKinshipViaMumuy(target, viewer, allMembers);
        console.log(`我 看 [${target.name}] -> ${res || 'null'}`);
    });
}

// 目标测试视角
runTest(a3_sis1, "三姨的大女");
runTest(mu2, "二舅");
runTest(ma3, "三姨");
