const testData = require('../fixtures/test-data');
const transform = require('./transform');

async function noop(what) {
    return Promise.resolve(what);
}

test('transform should work', async () => {
    const transformed = await transform(testData.plainCss);

    expect(transformed).toMatchSnapshot();
});
