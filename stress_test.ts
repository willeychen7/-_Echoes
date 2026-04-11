import { computeKinshipViaMumuy } from './src/lib/kinshipBridge';
import { normalizeGender } from './src/lib/utils';

// 模拟成员列表生成器
function generateMockTree() {
    const members: any[] = [];
    
    // 0. 本人 (基准 G30)
    const self = { id: 'self', name: '本人', gender: 'male', generation_num: 30 };
    members.push(self);

    // 1. 直系上五代 (G29 - G25)
    let lastFatherId = 'self';
    const ancestorNames = ['父亲', '爷爷', '曾祖父', '高祖父', '天祖父'];
    for (let i = 1; i <= 5; i++) {
        const id = `anc_${i}`;
        const node = { 
            id, 
            name: ancestorNames[i-1], 
            gender: 'male', 
            generation_num: 30 - i,
            relationship: ancestorNames[i-1]
        };
        members.push(node);
        // 设置父子连线
        const child = members.find(m => m.id === lastFatherId);
        if (child) child.father_id = id;
        lastFatherId = id;
    }

    // 2. 直系下五代 (G31 - G35)
    let lastParentId = 'self';
    const descendantNames = ['儿子', '孙子', '曾孙', '玄孙', '来孙'];
    for (let i = 1; i <= 5; i++) {
        const id = `desc_${i}`;
        const node = { 
            id, 
            name: descendantNames[i-1], 
            gender: 'male', 
            generation_num: 30 + i,
            father_id: lastParentId,
            relationship: descendantNames[i-1]
        };
        members.push(node);
        lastParentId = id;
    }

    // 3. 旁系五代 (以爷爷的兄弟为例 - 伯公/叔公的一支)
    // 爷爷 (anc_2) 的兄弟
    const grandUncle = { 
        id: 'grand_uncle', 
        name: '伯公', 
        gender: 'male', 
        generation_num: 28, 
        father_id: 'anc_3', // 曾祖父的孩子
        sibling_order: 1 
    };
    members.push(grandUncle);
    
    // 伯公的后代 (堂伯 -> 堂哥 -> 堂侄 -> 堂孙)
    const mockCousinLine = [
        { id: 'c_1', name: '堂伯', gen: 29, fid: 'grand_uncle' },
        { id: 'c_2', name: '堂哥', gen: 30, fid: 'c_1', order: 1 },
        { id: 'c_3', name: '堂侄', gen: 31, fid: 'c_2' },
        { id: 'c_4', name: '堂孙', gen: 32, fid: 'c_3' }
    ];
    mockCousinLine.forEach(c => {
        members.push({
            id: c.id,
            name: c.name,
            gender: 'male',
            generation_num: c.gen,
            father_id: c.fid,
            sibling_order: c.order || 2
        });
    });

    // 4. 母系 (外公 -> 舅舅 -> 表哥)
    const gMother = { id: 'g_mother', name: '母亲', gender: 'female', generation_num: 29 };
    const selfNode = members.find(m => m.id === 'self');
    selfNode.mother_id = 'g_mother';
    
    const mGrandFather = { id: 'm_gf', name: '外公', gender: 'male', generation_num: 28 };
    gMother.father_id = 'm_gf';
    
    const mUncle = { id: 'm_uncle', name: '舅舅', gender: 'male', generation_num: 29, father_id: 'm_gf', sibling_order: 1 };
    const mCousin = { id: 'm_cousin', name: '表哥', gender: 'male', generation_num: 30, father_id: 'm_uncle', sibling_order: 1 };
    
    members.push(gMother, mGrandFather, mUncle, mCousin);

    return { self, members };
}

const { self, members } = generateMockTree();

console.log("=== 岁月留声 宗法引擎 [上下五代 + 左右五代] 压力测试报告 ===");
console.log("测试视角: 本人 (男, G30)\n");

const tests = [
    { id: 'anc_1', label: '父亲 (G29)' },
    { id: 'anc_2', label: '爷爷 (G28)' },
    { id: 'anc_3', label: '曾祖父 (G27)' },
    { id: 'anc_4', label: '高祖父 (G26)' },
    { id: 'anc_5', label: '天祖父 (G25)' },
    { id: 'desc_1', label: '儿子 (G31)' },
    { id: 'desc_2', label: '孙子 (G32)' },
    { id: 'desc_3', label: '曾孙 (G33)' },
    { id: 'desc_4', label: '玄孙 (G34)' },
    { id: 'desc_5', label: '来孙 (G35)' },
    { id: 'grand_uncle', label: '爷爷的哥哥 (G28)' },
    { id: 'c_1', label: '堂伯 (G29)' },
    { id: 'c_2', label: '堂哥 (G30)' },
    { id: 'c_3', label: '堂侄 (G31)' },
    { id: 'c_4', label: '堂孙 (G32)' },
    { id: 'm_gf', label: '妈妈的爸爸 (G28)' },
    { id: 'm_uncle', label: '妈妈的哥哥 (G29)' },
    { id: 'm_cousin', label: '舅舅的孩子 (G30)' }
];

tests.forEach(t => {
    const target = members.find(m => m.id === t.id);
    const result = computeKinshipViaMumuy(target, self, members);
    console.log(`[测试项]: ${t.label.padEnd(15)} | 预期方向: 准确 | 引擎输出: ${result}`);
    
    // 反向测试
    const reverseResult = computeKinshipViaMumuy(self, target, members);
    console.log(`   <反向视角>: ${target.name || '某人'} 看我 -> ${reverseResult}`);
});

