"use strict";

class NodeVM {
  constructor() {}
  run() {
    throw new Error("vm2 NodeVM is disabled in the web build");
  }
}

module.exports = { NodeVM };

