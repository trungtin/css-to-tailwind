const resolveConfig = require('tailwindcss/resolveConfig');
const allProperties = require('cssstyle/lib/allProperties');
const { parseColor, parseSelector, parseSize } = require('./parsers');
const { CSSStyleDeclaration } = require('../patched-lib/CSSStyleDeclaration.js');
const { createRounder, getBreakPoints, createTouplesConverter, isVariable } = require('./utils');
const { buildAst: postCssParamsBuildAst } = require('postcss-params');
const { getOptions } = require('./options');
const flow = require('lodash.flow');
const uniq = require('lodash/uniq');
const sortBy = require('lodash/sortBy');

function parseAtruleParam(params) {
    // 'postcss-params' requires all expressions to be wrapped in parens
    // but single identifier expressions without parens are valid CSS

    // "print" -> "(print)"
    // "all and (min-width: 768px)" -> "(all) and (min-width: 768px)"

    const fixed = params.replace(/((?:only\s)?[a-z]+)(\sand|\sor|$)/g, '($1)$2');
    const result = postCssParamsBuildAst(fixed);
    const arr = Array.isArray(result) ? result : [result];
    return arr[0].all ? arr[0].all : arr;
}

const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));

function normalizer(parsedRules) {
    const options = getOptions();
    const resolvedConfig = resolveConfig(options.TAILWIND_CONFIG);

    const normalizeFontSize = createTouplesConverter({
        props: ['font-size'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.fontSize),
        }),
    });

    const normalizeLineHeight = createTouplesConverter({
        props: ['line-height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.lineHeight),
        }),
    });

    const normalizeLetterSpacing = createTouplesConverter({
        props: ['letter-spacing'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.letterSpacing),
        }),
    });

    const normalizeBorderRadius = createTouplesConverter({
        props: ['border-radius'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderRadius).filter((num) => num < 100),
            bailFn: (num) => {
                // this must be a full round value
                if (num > 100) {
                    return options.FULL_ROUND;
                }
            },
        }),
    });

    const normalizeColorValues = createTouplesConverter({
        props: colorProps,
        convertValue: (value) => {
            const rgba = parseColor(value);
            if (rgba !== null) {
                return `rgba(${rgba.join(', ')})`;
            }

            return value;
        },
    });

    const normalizeBorderColorProperties = createTouplesConverter({
        props: ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
        convertProp: () => 'border-color',
    });

    const normalizeBorderStyleProperties = createTouplesConverter({
        props: ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
        convertProp: () => 'border-style',
    });

    const normalizeWidth = createTouplesConverter({
        props: ['width'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.width),
        }),
    });
    const normalizeHeight = createTouplesConverter({
        props: ['height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.height),
        }),
    });
    const normalizeMargin = createTouplesConverter({
        props: ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.margin),
        }),
    });
    const normalizePadding = createTouplesConverter({
        props: ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.padding),
        }),
    });
    const normalizeGap = createTouplesConverter({
        props: ['gap'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.gap),
        }),
    });

    const normalizeBorderWidth = createTouplesConverter({
        props: ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderWidth),
        }),
    });

    const normalizeCssMap = flow([
        normalizeLineHeight,
        normalizeLetterSpacing,
        normalizeFontSize,

        normalizeColorValues,

        normalizeBorderRadius,
        normalizeBorderWidth,
        normalizeBorderColorProperties,
        normalizeBorderStyleProperties,

        normalizeWidth,
        normalizeHeight,
        normalizeMargin,
        normalizePadding,
        normalizeGap,
    ]);

    function normalizeDictOfTouples(dict, fn) {
        return Object.fromEntries(
            Object.entries(dict).map(([twClass, touples]) => {
                return [twClass, fn(touples)];
            }),
        );
    }

    function resolveLocalVariables(touples) {
        const variables = touples.filter(isVariable);

        return touples.map(([prop, value]) => {
            const resolvedValue = variables.reduce((str, [varN, varV]) => str.split(`var(${varN})`).join(varV), value);
            return [prop, resolvedValue];
        });
    }

    function normalizeShorthands(touples) {
        const declaration = new CSSStyleDeclaration();

        touples.forEach(([prop, value]) => {
            declaration.setProperty(prop, value);
        });

        return Object.entries(declaration.getNonShorthandValues());
    }

    const breakpoints = {};

    let screens = parsedRules
        .map(({ selector, atRuleName, atRuleParams, props }) => {
            if (atRuleName !== 'media') return;

            // TODO: add support for media queries with max-width
            // TODO: add support for media queries with multiple breakpoints
            const minWidth = parseAtruleParam(atRuleParams).find((rule) => rule.feature === 'min-width');

            if (!minWidth) return;
            const minWidthValue = parseSize(minWidth.value);

            return minWidthValue;
        })
        .filter(Boolean);
    screens = sortBy(uniq(screens)).filter((value, index, array) => {
        if (index === 0) return true;
        if (value - array[index - 1] < options.SCREEN_GAP) return false;

        return true;
    });

    const screenNames = [
        // sensible naming
        screens[0] <= 640 && 'sm',
        screens[0] <= 768 && 'md',
        screens[0] <= 1024 && 'lg',
        'xl',
    ].filter(Boolean);

    for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        let screenName = screenNames[i];
        if (!screenName) screenName = i - screenNames.length + 2 + 'xl';
        breakpoints[screen] = screenName;
    }

    const roundResponsiveViewBreakpoints = createRounder({
        breakpoints: getBreakPoints(Object.keys(breakpoints).map((s) => s + 'px')),
    });

    const groupByVariants = parsedRules.reduce((acc, { selector, atRuleName, atRuleParams, props }) => {
        const mediaRuleValue = atRuleName === 'media' ? atRuleParams : null;
        const results = getVariantFromSelector({
            selector,
            mediaRuleValue,
            responsiveBreakpointNames: breakpoints,
            roundResponsiveViewBreakpoints,
        });

        for (const { variantsKey, baseSelector } of results) {
            if (!acc[variantsKey]) {
                acc[variantsKey] = {};
            }

            acc[variantsKey][baseSelector] = props;
        }

        return acc;
    }, {});

    return Object.fromEntries(
        Object.entries(groupByVariants).map(([variant, classesJson]) => {
            const resolvedLocalVariables = normalizeDictOfTouples(classesJson, resolveLocalVariables);
            const normalizedShorthands = normalizeDictOfTouples(resolvedLocalVariables, normalizeShorthands);
            const normalizedCssValues = normalizeDictOfTouples(normalizedShorthands, normalizeCssMap);
            return [variant, normalizeDictOfTouples(normalizedCssValues, Object.fromEntries)];
        }),
    );
}

function getVariantFromSelector({
    selector,
    mediaRuleValue,
    responsiveBreakpointNames,
    roundResponsiveViewBreakpoints,
}) {
    const selectorList = parseSelector(selector);

    const mediaVariants = [];

    if (mediaRuleValue) {
        const minWidth = parseAtruleParam(mediaRuleValue).find((rule) => rule.feature === 'min-width');

        if (minWidth) {
            const minWidthValue = parseSize(roundResponsiveViewBreakpoints(minWidth.value));

            if (typeof minWidthValue === 'number') {
                if (!responsiveBreakpointNames[minWidthValue]) {
                    // skip unknown responsive breakpoint for now
                    // throw new Error(`unsupported min-width media query value: "${minWidthValue}"`);
                } else {
                    mediaVariants.push(responsiveBreakpointNames[minWidthValue]);
                }
            }
        }
    }

    const extractedSelectors = selectorList.map((selectorElements) => {
        const modifiers = [];
        const selector = selectorElements
            .map((selectorElement, index, arr) => {
                // type is `attribute`, `class`, `combinator`, `comment`, `id`, `nesting`, `pseudo`, `root`, `selector`, `string`, `tag`, `universal`
                const { type, value } = selectorElement;

                const isLastElementSelector = arr.slice(index, arr.length).every((el) => el.type !== 'combinator');

                if (isLastElementSelector) {
                    if (type === 'pseudo') {
                        for (const v of ['active', 'hover', 'focus', 'placeholder']) {
                            if (value.includes(v)) {
                                modifiers.push(v);
                                return null;
                            }
                        }
                    }
                }

                if (type === 'comment') return null;

                return selectorElement;
            })
            .join('');

        return { selector, modifiers };
    });

    return extractedSelectors.map(({ selector, modifiers }) => {
        const variants = mediaVariants.concat(modifiers);
        const variantsKey = Array.from(variants).sort().join(',') || 'base';
        return {
            baseSelector: selector,
            variants,
            variantsKey,
        };
    });
}

module.exports = normalizer;
module.exports.getVariantFromSelector = getVariantFromSelector;
