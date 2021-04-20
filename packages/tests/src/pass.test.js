const test = require("./_adapter");

test("collapse style-only expression", `
  const props = do {
    color: red;
  }
`);

test("pass SpreadElement-do to element", `
  () => do {
    foo: {
      background: blue;
    }
    
    <foo {...do {
      color: red;
    }} />
  }
`)