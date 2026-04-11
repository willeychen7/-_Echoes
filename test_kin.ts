import { computeKinshipViaMumuy } from './src/lib/kinshipBridge';

const viewer = { id: 1, gender: 'male' };
const target = { id: 2, gender: 'male', relationship: '哥哥', sibling_order: 1 };
const members = [viewer, target];

// Mock for relationship.js if needed, or just let it fail and see
console.log("Result for Cousin (explicit):", computeKinshipViaMumuy({ id: 3, gender: 'male', father_id: 10, sibling_order: 1 }, { id: 1, father_id: 11, gender: 'male' }, [{id: 1, father_id: 11}, {id: 3, father_id: 10}, {id: 10, father_id: 100}, {id: 11, father_id: 100}]));
