const { assert } = require('chai');
const { EventRouter } = require('../index');

describe('EventRouter Test', () => {
    it('should be able to emit and receive event', (done) => {
        let g = new EventRouter();
        g.registerEvents(["HELLO"]);
        g.enableHello(e => {
            assert.equal(e, "World");
            done();
        });
        g.hello("World");
    });
});