/* eslint-disable no-undef */

const fs = require("fs");
const path = require("path");
const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { DefinePlugin } = require("webpack");
const environments = require("./environments");

// Every failed tool call of a dev pane, one JSON object per line (src/chat/dev/toolErrorLog.ts).
const toolErrorLog = path.join(__dirname, "logs", "tool-errors.jsonl");

// The ChatUiT server as `dotnet run --launch-profile https` starts it.
const apiDev = "https://localhost:7254";

/** The prod environment, or an error naming every value that is still empty. */
function prodEnvironment() {
  const missing = Object.entries(environments.prod)
    .filter(([, value]) => value === "")
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Set ${missing.join(", ")} for prod in environments.js before a production build.`);
  }
  return environments.prod;
}

/** Rewrites a dev manifest with the prod values. */
function toProdManifest(content, prod) {
  const dev = environments.dev;
  return content
    .toString()
    .replaceAll(dev.addinUrl, prod.addinUrl)
    // The bare origin, as in <AppDomain>.
    .replaceAll(new URL(dev.addinUrl).origin, new URL(prod.addinUrl).origin)
    .replaceAll(dev.officeId, prod.officeId)
    .replaceAll(dev.outlookId, prod.outlookId)
    .replaceAll(
      `<DisplayName DefaultValue="${dev.displayName}"/>`,
      `<DisplayName DefaultValue="${prod.displayName}"/>`
    );
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const environment = dev ? environments.dev : prodEnvironment();

  return {
    devtool: "source-map",
    entry: {
      taskpane: "./src/office/taskpane/index.tsx",
    },
    output: {
      // dist/ is what `dotnet publish` copies into wwwroot, so the add-in is served under /office/.
      path: path.resolve(__dirname, "dist", "office"),
      filename: dev ? "[name].js" : "[name].[contenthash].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    module: {
      rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: "babel-loader" }],
    },
    plugins: [
      new DefinePlugin({
        // A production build serves its one server; a dev build starts on the first dev host and can switch.
        CHATUIT_API_ORIGIN: JSON.stringify(dev ? Object.values(environment.apiHosts)[0] : environment.apiOrigin),
        CHATUIT_DEV_API_HOSTS: JSON.stringify(dev ? environment.apiHosts : null),
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/office/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "assets/*", to: "assets/[name][ext]" },
          {
            from: "manifests/*.xml",
            to: "[name][ext]",
            transform: (content) => (dev ? content : toProdManifest(content, environment)),
          },
        ],
      }),
    ],
    devServer: {
      server: {
        type: "https",
        options: env.WEBPACK_SERVE ? await devCerts.getHttpsServerOptions() : undefined,
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
      // The task pane calls the API on its own origin, like the ChatUiT client's Vite proxy.
      proxy: [{ context: ["/api"], target: apiDev, changeOrigin: true }],
      // Compression would buffer the streamed (SSE) responses.
      compress: false,
      setupMiddlewares: (middlewares, devServer) => {
        devServer.app.post("/dev/tool-errors", (request, response) => {
          let body = "";
          request.setEncoding("utf8");
          request.on("data", (chunk) => (body += chunk));
          request.on("end", () => {
            try {
              fs.mkdirSync(path.dirname(toolErrorLog), { recursive: true });
              fs.appendFileSync(toolErrorLog, JSON.stringify(JSON.parse(body)) + "\n");
              response.status(204).end();
            } catch {
              response.status(400).end();
            }
          });
        });
        return middlewares;
      },
      client: {
        overlay: {
          // "Script error." is an error from a cross-origin script (office.js) whose details the browser hides.
          // It says nothing about the add-in and would cover the task pane.
          runtimeErrors: (error) => error.message !== "Script error.",
        },
      },
    },
  };
};
