const assert = require('assert/strict');

const _corePlugins = require('tailwindcss/lib/corePlugins.js');
const twResolveConfig = require('tailwindcss/lib/public/resolve-config.js');
const { parseToAltUnits } = require('./parsers');

const twConfig = twResolveConfig.default({});

const { corePlugins } = _corePlugins;

const computed = {};
const corePluginsList = Object.keys(corePlugins);

const conditions = {};

function isCssProperty(key) {
    return !(key.startsWith('--') || key.startsWith('@'));
}

function setCondition(tailwind, ...keys) {
    let last = conditions;
    for (const key of keys) {
        if (!last[key]) {
            last[key] = {};
        }
        last = last[key];
    }

    return (last.tailwind = tailwind);
}

function addUtilities(utilities, options) {
    for (const cn of Object.keys(utilities)) {
        const condition = utilities[cn];
        const conditionKeys = Object.keys(condition);
        // assert(conditionKeys.length === 1, `unexpected number of keys: ${conditionKeys}`);
        if (conditionKeys.length > 1) {
            continue;
        }
        setCondition(
            cn.slice(1), // remove the leading dot
            conditionKeys[0],
            condition[conditionKeys[0]],
        );
    }
}

function matchUtilities(utilities, options) {
    let defaultOptions = {
        respectPrefix: true,
        respectImportant: true,
    };

    let { values } = { ...defaultOptions, ...options };
    const valuesInverted = {};
    const valuesRegex = [] // array of tuple of regex and the value

    if (values) {
        for (const key of Object.keys(values)) {
            let value = values[key];

            // for case of font-size, value includes the line-height as well, so just skip it and take the font-size only
            if (Array.isArray(value)) value = value[0];

            // close match for 33.333%, 66.667%, ....
            let match = value.match(/^(\d\d\.\d)\d+%$/);
            if (match) {
                valuesRegex.push([new RegExp(`^${match[1]}\\d+%$`), key]);
            } else {
                valuesInverted[value] = key;
            }

        }
    }

    for (let identifier in utilities) {
        let rule = utilities[identifier];

        assert(typeof rule === 'function', `rule ${rule} is not a function`);
        try {
            const properties = [];
            const tryValue = 0; // TODO: find a way to try other values (based on the provided values in options)
            const tryRule = rule(tryValue);
            const tryRuleKeys = Object.keys(tryRule);
            for (const key of tryRuleKeys) {
                if (!isCssProperty(key)) {
                    continue;
                }
                // assert(tryRule[key] === tryValue, `unexpected value for ${key}: ${tryRule[key]}`);
                if (tryRule[key] !== tryValue) {
                    continue;
                }
                properties.push(key);
            }

            // FIXME: should check for the number of properties equal to the number of properties in the tryRule
            if (properties.length > 0) {
                properties.sort();

                for (let i = 0; i < properties.length; i++) {
                    // camelCase to kebab-case
                    // some properties are in camelCase, for eg. fontWeight, lineHeight, etc.
                    properties[i] = properties[i].replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
                }

                setCondition(({ value }) => {
                    let twValue;
                    if (value in valuesInverted) {
                        twValue = valuesInverted[value];
                    } else {
                        for (const [regex, key] of valuesRegex) {
                            if (regex.test(value)) {
                                twValue = key;
                                break;
                            }
                        }
                    }

                    if (!twValue) {
                        // check for value in other unit px <-> rem <-> em
                        let alternativeValues = parseToAltUnits(value);
                        for (const value of alternativeValues) {
                            if (value in valuesInverted) {
                                twValue = valuesInverted[value];
                                break;
                            }
                        }
                    }

                    if (twValue) {
                        if (twValue === 'DEFAULT') {
                            return identifier;
                        }
                        return `${identifier}-${twValue}`;
                    }

                    return `${identifier}-[${value}]`;
                }, ...properties);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

for (const key of corePluginsList) {
    if (key === 'preflight') continue;
    else if (typeof corePlugins[key] !== 'function') computed[key] = corePlugins[key];
    else {
        computed[key] = corePlugins[key]({
            addBase: () => {},
            addDefaults: () => {},
            addComponents: () => {},
            addUtilities,
            matchUtilities,
            matchComponents: () => {},
            addVariant: () => {},
            matchVariant: () => {},
            theme: (themeKey) => twConfig.theme[themeKey],
            config: () => twConfig,
        });
    }
}

module.exports = {
    computed,
    conditions,
};
