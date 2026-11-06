// Isolated browser component tests: no role override or preview route ships in Next.
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
webpack(
  {
    mode: "development",
    devtool: false,
    entry: path.resolve("tests/harness/entry.tsx"),
    output: {
      path: "/private/tmp/pnd-native-component-tests",
      filename: "harness.js",
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@/contexts/UserContext$": path.resolve("tests/harness/context.ts"),
        "@": path.resolve("src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: path.resolve("tests/harness/loader.cjs"),
        },
      ],
    },
    optimization: { minimize: false },
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
    } else console.log("Native component harness built.");
  },
);
