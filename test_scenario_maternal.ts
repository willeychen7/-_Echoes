
import { computeKinshipViaMumuy } from "./src/lib/kinshipBridge.ts";

function createNode(id: number, name: string, gender: string, g: number, h: string, s: number, spouse_id: number | null = null, fId: number | null = null, mId: number | null = null) {
    return {
        id,
        name,
        gender,
        generation_num: g,
        ancestral_hall: h,
        sibling_order: s,
        spouse_id,
        father_id: fId,
        mother_id: mId
    };
}

const members: any[] = [];

// 曾祖辈 (Gen 17)
const wg_papa = createNode(12, "外公的父亲", "male", 17, "大房", 1);
const ww_mama = createNode(14, "外婆的母亲", "female", 17, "外家房", 1);
members.push(wg_papa, ww_mama);

// 祖辈 (Gen 18)
const wg = createNode(1, "外公", "male", 18, "大房", 1, 4, 12);
const ww = createNode(4, "外婆", "female", 18, "根房", 1, 1, null, 14);
const wb = createNode(2, "二叔公", "male", 18, "大房", 2, null, 12);
const a3 = createNode(3, "三姨奶", "female", 18, "大房", 3, null, 12);
const ww_sis = createNode(5, "小姨婆", "female", 18, "外家房", 2, null, null, 14);
members.push(wg, ww, wb, a3, ww_sis);

// 母辈 (Gen 19)
const mom = createNode(10, "大姨 (妈妈)", "female", 19, "大房", 1, null, 1, 4);
const uncle2 = createNode(11, "二舅", "male", 19, "大房", 2, 110, 1, 4);
const aunt_in_law = createNode(110, "舅妈", "female", 19, "舅妈房", 1, 11);
const aunt3 = createNode(13, "三姨 (母亲)", "female", 19, "大房", 3, null, 1, 4);
members.push(mom, uncle2, aunt_in_law, aunt3);

// 我辈 (Gen 20)
const me = createNode(21, "我", "male", 20, "我的房", 2, null, null, 10);
const brother = createNode(22, "哥哥", "male", 20, "我的房", 1, null, null, 10);
const c1 = createNode(31, "舅舅的大女儿 (姐姐)", "female", 20, "大房", 1, null, 11, 110);
const c2 = createNode(32, "舅舅的小儿子 (弟弟)", "male", 20, "大房", 2, null, 11, 110);
const a3c1 = createNode(40, "三姨的大姐", "female", 20, "大房", 1, null, null, 13);
const a3c2 = createNode(41, "三姨的二哥", "male", 20, "大房", 2, null, null, 13);
const a3c3 = createNode(42, "三姨的三妹", "female", 20, "大房", 3, null, null, 13);
members.push(me, brother, c1, c2, a3c1, a3c2, a3c3);

// 孙辈 (Gen 21)
const a3c1_d = createNode(50, "三姨大女儿的女儿", "female", 21, "孙房", 1, null, null, 40);
members.push(a3c1_d);

console.log("\n--- 视角: 三姨的大女 (a3c1) ---");
const targets = [
    { n: wg, d: "外公" },
    { n: ww, d: "外婆" },
    { n: wb, d: "二叔公 (外公二弟)" },
    { n: a3, d: "三姨奶 (外公三妹)" },
    { n: ww_sis, d: "小姨婆 (外婆妹妹)" },
    { n: mom, d: "大姨 (妈妈)" },
    { n: uncle2, d: "二舅" },
    { n: aunt3, d: "三姨 (母亲)" },
    { n: me, d: "我 (表弟)" },
    { n: c2, d: "舅舅的孩子 (表弟)" },
    { n: a3c1_d, d: "女儿" }
];

targets.forEach(t => {
    const rel = computeKinshipViaMumuy(t.n, a3c1, members);
    console.log(`[${a3c1.name}] 看 [${t.d}]: ${rel}`);
});

console.log("\n--- 视角: 二舅 (uncle2) ---");
const u2targets = [
    { n: a3c1, d: "三姨的大姐" },
    { n: a3c2, d: "三姨的二哥" },
    { n: a3c3, d: "三姨的三妹" },
    { n: a3c1_d, d: "三姨大女儿的女儿" },
    { n: me, d: "我 (Viewer)" },
    { n: wg, d: "外公" },
    { n: wb, d: "外公的二弟 (二舅爷)" }
];
u2targets.forEach(t => {
    const rel = computeKinshipViaMumuy(t.n, uncle2, members);
    console.log(`[${uncle2.name}] 看 [${t.d}]: ${rel}`);
});

console.log("\n--- 视角: 三姨 (aunt3) ---");
const a3targets = [
    { n: c1, d: "二舅的姐姐" },
    { n: c2, d: "二舅的弟弟" },
    { n: me, d: "我 (Viewer)" },
    { n: wg, d: "外公" },
    { n: wb, d: "外公的二弟 (二舅爷)" },
    { n: ww_sis, d: "外婆的妹妹 (小姨婆)" }
];
a3targets.forEach(t => {
    const rel = computeKinshipViaMumuy(t.n, aunt3, members);
    console.log(`[${aunt3.name}] 看 [${t.d}]: ${rel}`);
});
