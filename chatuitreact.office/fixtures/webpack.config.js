/* eslint-disable no-undef */

// Bundles the conversation fixtures for Node. Not part of the add-in build.
const path = require("path");

module.exports = {
  mode: "development",
  target: "node",
  devtool: false,
  entry: path.resolve(__dirname, "conversation/run.ts"),
  output: {
    path: path.resolve(__dirname, "../node_modules/.cache/chatuit-fixtures"),
    filename: "run.js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
    ],
  },
};
