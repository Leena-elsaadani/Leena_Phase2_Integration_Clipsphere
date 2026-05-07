const { start } = require("../cmd/main");

if (require.main === module) {
  start();
}

module.exports = { start };
