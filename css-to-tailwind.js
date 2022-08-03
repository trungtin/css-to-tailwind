const transform = require('./lib/transform');
const { setOptions } = require('./lib/options');

async function cssToTailwind(inputCss, _options) {
    // TODO: handle provided tailwind config
    const { TAILWIND_CONFIG, PREPROCESSOR_INPUT } = setOptions(_options)

    return transform(inputCss);
}

module.exports = cssToTailwind;
