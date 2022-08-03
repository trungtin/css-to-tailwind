const { parseCss: _parseCss } = require('./parsers');
const _normalizer = require('./normalizer');
const { getOptions } = require('./options');
const memoizeOne = require('memoize-one/dist/memoize-one.cjs.js');

const { conditions } = require('./tailwind-core');

function filterTailwind(inputNormalized, selector) {
    const cssMap = inputNormalized[selector];

    const keys = Object.keys(cssMap);
    const results = [];
    const missing = [];
    for (const key of keys) {
        let last = conditions[key];
        if (last && cssMap[key] in last) {
            last = last[cssMap[key]];
        }

        const tw = last?.tailwind;
        if (typeof tw === 'function') {
            results.push(tw({ value: cssMap[key] }));
        } else if (tw) {
            results.push(tw);
        } else {
            missing.push([key, cssMap[key]]);
        }
    }

    return [results, missing];
    // const matches = Object.entries(tailwindNormalized).filter(([twClass, value]) => isSubset(cssMap, value));

    // const pairs = [];

    // for (let i = 0; i < matches.length; i++) {
    //     for (let j = 0; j < i; j++) {
    //         pairs.push([i, j], [j, i]);
    //     }
    // }

    // const dropped = new Set();

    // // compares all result classes with each other, to remove redundancies
    // // for example "mt-20, mr-20, mb-20, ml-20" are all redundant if m-20 is also a result
    // pairs.forEach(([aIndex, bIndex]) => {
    //     if (dropped.has(bIndex)) {
    //         return;
    //     }

    //     if (isRedundant(matches[aIndex][1], matches[bIndex][1])) {
    //         dropped.add(bIndex);
    //     }
    // });

    // const filtered = matches.filter((_, index) => !dropped.has(index))

    // return Object.fromEntries(filtered);
}

function transformRule(variant, inputNormalized) {
    return Object.keys(inputNormalized).map((selector) => {
        const [resultTailwind, missing] = filterTailwind(inputNormalized, selector);

        // const tailwindClassesOrder = Object.fromEntries(
        //     Object.keys(tailwindNormalized).map((twClass, index) => [twClass, index]),
        // );

        // const resultArray = Object.keys(resultTailwind).sort(
        //     (a, z) => tailwindClassesOrder[a] - tailwindClassesOrder[z],
        // );

        const resultArray = resultTailwind;

        const tailwind = resultArray.join(' ');

        return {
            selector,
            tailwind,
            missing: missing.length
                ? {
                      [variant]: missing,
                  }
                : {},
        };
    });
}

const parseInputCss = memoizeOne(_parseCss);

// need different instances, because they are running together
const normalizer2 = memoizeOne(_normalizer);

async function transform(inputCss) {
    // `options` only used for cache invalidation here
    const options = getOptions();
    const inputNormalized = normalizer2(await parseInputCss(inputCss), options);
    const variantsMerged = Object.entries(inputNormalized)
        .flatMap(([variant, inputNormalized]) => {
            return transformRule(variant, inputNormalized);
        })
        .reduce((acc, curr) => {
            if (!acc[curr.selector]) {
                acc[curr.selector] = [];
            }
            acc[curr.selector].push(curr);
            return acc;
        }, {});

    return Object.values(variantsMerged).map((results) => {
        return results.reduce((acc, curr) => {
            return {
                selector: curr.selector,
                tailwind: acc.tailwind ? acc.tailwind.concat(' ', curr.tailwind).trim() : curr.tailwind,
                missing: acc.missing ? { ...acc.missing, ...curr.missing } : curr.missing,
            };
        });
    });
}

module.exports = transform;
