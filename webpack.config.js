const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { version } = require('./package.json');

module.exports = (_env, argv) => {
  const dev = argv.mode === 'development';

  return {
    mode: dev ? 'development' : 'production',
    devtool: dev ? 'cheap-source-map' : false,
    entry: {
      popup: './src/popup/index.tsx',
      page: './src/page/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'public' },
          {
            // Keep the manifest version in sync with package.json.
            from: 'src/manifest.json',
            transform: (content) => JSON.stringify({ ...JSON.parse(content.toString()), version }, null, 2),
          },
        ],
      }),
    ],
    // axe-core makes page.js large; that's expected for a locally loaded extension script.
    performance: { hints: false },
  };
};
