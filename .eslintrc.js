module.exports = {
    root: true,
    extends: [
        './configs/base.eslintrc.json',
        './configs/warnings.eslintrc.json',
        './configs/errors.eslintrc.json'
    ],
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
            'tsconfig.json',
            'dev-packages/*/tsconfig.json',
            'packages/*/tsconfig.json',
            'examples/*/tsconfig.json'
        ]
    }
};
