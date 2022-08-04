const testData = require('../fixtures/test-data');
const transform = require('./transform');

test('transform should work with plain css', async () => {
    const transformed = await transform(testData.plainCss);

    expect(transformed).toMatchSnapshot();
});

test('transform should work with variants css', async () => {
    const transformed = await transform(testData.cssWithVariants);

    expect(transformed).toMatchSnapshot();
});
