module.exports = {
    preset: 'ts-jest',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
    globals: {
        __DEV__: true,
        __TEST__: true,
        __VERSION__: require('./package.json').version,
        __BROWSER__: false,
        __GLOBAL__: false,
        __ESM_BUNDLER__: true,
        __ESM_BROWSER__: false,
        __NODE_JS__: true,
        __FEATURE_OPTIONS_API__: true,
        __FEATURE_SUSPENSE__: true,
        __FEATURE_PROD_DEVTOOLS__: false,
    },
};
