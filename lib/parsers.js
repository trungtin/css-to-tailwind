const parseUnit = require('parse-unit');
const postCssSelectorParser = require('postcss-selector-parser');
const postCssSafeParser = require('postcss-safe-parser');
const cssColorConverter = require('css-color-converter');
const { getOptions } = require('./options');

function parseColor(color) {
    const rgba = cssColorConverter(color)?.toRgbaArray();
    if (Array.isArray(rgba) && rgba.length === 4) {
        return rgba;
    }
    return null;
}

function parseSize(val) {
    if (val === '0') {
        return 0;
    }

    const [value, unit] = parseUnit(val);

    const options = getOptions();

    if (unit === 'px') {
        return value;
    } else if (unit === 'rem') {
        return value * options.REM;
    } else if (unit === 'em') {
        return value * options.EM;
    }

    return val;
}

function parseToAltUnits(val) {
    let ret = [];
    if (val == 0) {
        return ret;
    }

    const [value, unit] = parseUnit(val);
    const options = getOptions();

    if (unit === 'px') {
        ret.push(`${value / options.REM}rem`, `${value / options.EM}em`);
    } else if (unit === 'rem') {
        ret.push(`${value * options.REM}px`);
    }

    // TODO: add color units

    return ret;
}

/**
 * parse selector
 * ".foo:focus, .bar:active:hover" -> [[ClassName(".foo"), Pseudo(":focus")], [ClassName(".bar"), Pseudo(":active"), Pseudo(":hover")]]
 */
function parseSelector(selector) {
    const result = [];

    let i = 0;
    postCssSelectorParser((selectors) => {
        selectors.walk((selector) => {
            if (selector.type === 'selector') {
                result[i++] = [];
            } else {
                result[i - 1].push(selector);
            }
        });
    }).processSync(selector, { lossless: false });

    return result;
}

async function parseCss(css) {
    const ast = postCssSafeParser(css);
    const result = [];

    ast.walkRules((rule) => {
        const subResult = {
            selector: rule.selector,
            atRuleName: null,
            atRuleParams: null,
            props: [],
        };

        if (rule.parent?.type === 'atrule') {
            subResult.atRuleName = rule.parent.name;
            subResult.atRuleParams = rule.parent.params;
        }

        rule.walkDecls((decl) => {
            subResult.props.push([decl.prop, decl.value]);
        });

        result.push(subResult);
    });

    return result;
}

module.exports.parseColor = parseColor;
module.exports.parseSize = parseSize;
module.exports.parseToAltUnits = parseToAltUnits;
module.exports.parseCss = parseCss;
module.exports.parseSelector = parseSelector;
