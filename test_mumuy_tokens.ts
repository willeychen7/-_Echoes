import relationship from 'relationship.js';
console.log("Tokens f,s:", relationship({ text: 'f,s', sex: 1 }));
console.log("Tokens 爸爸,儿子:", relationship({ text: '爸爸的儿子', sex: 1 }));
console.log("Tokens 爸,哥:", relationship({ text: '爸的哥', sex: 1 }));
