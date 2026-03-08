import { computeKinshipViaMumuy } from './src/lib/kinshipBridge.ts';

// 节点构造器
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
 * 💡 终极实战验证: 上下五代 (+/- 5 Gen) + 左右五房
 * 从 User (G31) 向上追溯到高曾祖, 向下扩展到来孙
 */

const allMembers = [];

// 1. 建立纵向主轴 (直系, 亲系)
// G26 (高高曾祖) 到 G31 (我)
const root = createNode(260, "高高祖 (G26)", "male", 26, "根房", 1);
const g27 = createNode(270, "高祖 (G27)", "male", 27, "根房", 1, null, 260);
const g28 = createNode(280, "太祖 (G28)", "male", 28, "根房", 1, null, 270);
const g29 = createNode(290, "高爷爷 (G29)", "male", 29, "大房", 1, null, 280);
const g30 = createNode(300, "爷爷 (G30)", "male", 30, "大房", 1, null, 290);
const g31 = createNode(310, "爸爸 (G31)", "male", 31, "大房", 1, null, 300);
const user = createNode(320, "User (我)", "male", 32, "大房", 1, null, 310);

// 2. 建立横向房分 (左右五房)
// G29 辈分的其他房分 (堂爷爷们)
const g29_h2 = createNode(292, "二房高爷爷", "male", 29, "二房", 2, null, 280);
const g29_h5 = createNode(295, "五房高爷爷", "male", 29, "五房", 5, null, 280);

// 3. 建立母系表亲 (妈妈系)
const mg = createNode(307, "外公", "male", 30, "外家", 1);
const m1 = createNode(317, "妈妈", "female", 31, "外家", 1, 310, 307);
user.mother_id = 317;
g31.spouse_id = 317;

// 4. 建立向下五代 (直系孙代)
const child = createNode(330, "儿子", "male", 33, "大房", 1, null, 320);
const grand = createNode(340, "孙子", "male", 34, "大房", 1, null, 330);
const gen_3 = createNode(350, "曾孙", "male", 35, "大房", 1, null, 340);
const gen_4 = createNode(360, "玄孙", "male", 36, "大房", 1, null, 350);
const gen_5 = createNode(370, "来孙 (G37)", "male", 37, "大房", 1, null, 360);

// 5. 加入复杂的堂/表关系
// 二房高爷爷的孙子 (与爸爸同辈)
const cousin_f1 = createNode(312, "二房堂哥 (父系)", "male", 31, "二房", 1, null, 302); // 假设 302 是二房高爷爷的儿子
const g302 = createNode(302, "二房伯公", "male", 30, "二房", 1, null, 292);

allMembers.push(root, g27, g28, g29, g30, g31, user, g29_h2, g29_h5, mg, m1, child, grand, gen_3, gen_4, gen_5, cousin_f1, g302);

function runDeepTest(viewer, title) {
    console.log(`\n--- 🚀 视角: ${title} (${viewer.name}, G${viewer.generation_num}) ---`);
    allMembers.filter(m => m.id !== viewer.id).forEach(target => {
        const res = computeKinshipViaMumuy(target, viewer, allMembers);
        console.log(`我 看 [${target.name}] -> ${res}`);
    });
}

runDeepTest(user, "User (我)");
runDeepTest(root, "高高祖 (G26)");
runDeepTest(gen_5, "来孙 (G37)");
