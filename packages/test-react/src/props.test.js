const test = require("./_adapter");

test("will convert `./../file.ext` to require", `
  () => do {
    <img src="./logo.svg">
      This should be a require-sourced file!
    </img>
  }
`);