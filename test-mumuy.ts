
import relationship from 'relationship.js';

console.log("Input: 哥哥, reverse: true, sex: 1 (male)");
const r1 = relationship({
    text: "哥哥",
    reverse: true,
    sex: 1
});
console.log(r1);

console.log("\nInput: 哥哥, reverse: true, sex: 0 (female)");
const r2 = relationship({
    text: "哥哥",
    reverse: true,
    sex: 0
});
console.log(r2);
