
import { getRigorousRelationship } from "./src/lib/relationships.ts";

const members = [
    { id: 1, name: "陈阿妹", gender: "female", relationship: "姑妈", createdByMemberId: null },
    { id: 5, name: "Win仔", gender: "female", relationship: "女儿", createdByMemberId: 1 },
    { id: 6, name: "K仔", gender: "female", relationship: "侄女", createdByMemberId: 1 },
];

const viewer = { memberId: 6, name: "K仔" };
const target = { id: 5, name: "Win仔" };

const rel = getRigorousRelationship(viewer, target, members);
console.log(`K仔 (ID 6) 看 Win仔 (ID 5): ${rel}`);

const kToMa = getRigorousRelationship(viewer, { id: 1 }, members);
console.log(`K仔 (ID 6) 看 陈阿妹 (ID 1): ${kToMa}`);
