const twResolveConfig = require('tailwindcss/lib/public/resolve-config.js');
const twConfig = twResolveConfig.default({});

const defaultOptions = {
    COLOR_DELTA: 2,
    SCREEN_GAP: 10,
    FULL_ROUND: 9999,
    REM: 16,
    EM: 16,
    PREPROCESSOR_INPUT: '@tailwind base;\n\n@tailwind components;\n\n@tailwind utilities;',
    TAILWIND_CONFIG: twConfig,
};

module.exports = defaultOptions;
