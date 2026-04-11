
const selectedRank = '二';
const connectingRank = null;
const connectorNode = 'sibling';
const currentUser = { ancestralHall: null, ancestral_hall: null };

// Mock parent lookup when adding '二哥', parent might be '陈阿妹的父亲'
// Wait, if parent is not in members array, parent is undefined
let parent = undefined;

const result1 = (
    parent?.ancestralHall ||
    parent?.ancestral_hall ||
    // 堂/表亲：由连接点排行决定房分
    (connectingRank && connectingRank !== '不知道' ? `${connectingRank}房` : null) ||
    // 亲兄弟姐妹：建立自己的房分
    (connectorNode === 'sibling' && selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null) ||
    // 晚辈：继承父辈房分
    (['child_p', 'grandchild_p'].includes(connectorNode) ? (currentUser.ancestralHall || currentUser.ancestral_hall) : null) ||
    // 其它情况：回退到选择排行
    (selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null)
);

console.log("Result when parent is undefined:", result1);

parent = { ancestral_hall: null };
const result2 = (
    parent?.ancestralHall ||
    parent?.ancestral_hall ||
    (connectingRank && connectingRank !== '不知道' ? `${connectingRank}房` : null) ||
    (connectorNode === 'sibling' && selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null) ||
    (['child_p', 'grandchild_p'].includes(connectorNode) ? (currentUser.ancestralHall || currentUser.ancestral_hall) : null) ||
    (selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null)
);

console.log("Result when parent has ancestral_hall = null:", result2);
