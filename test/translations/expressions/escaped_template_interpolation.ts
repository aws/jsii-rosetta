const str = 'problematic!';
console.log(`Simple Template without escapes`);
console.log(`Simple Template with simple escapes: ${10}`);
console.log(`\${Template with Terraform Escape sequence: ${str}!}`);
console.log(`\$\{Template with more escaped Terraform Escape sequence: ${str}!\}`);
console.log(`$\{Template with differently escaped Terraform Escape sequence: ${str}!\}`);
console.log(`prefix \${literal} ${str} suffix`);
console.log(`prefix \\\${literal} ${str} suffix`);
console.log(`\${foo}`);
console.log(`
\${escaped}
${str}
`);
