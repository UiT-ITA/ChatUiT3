/* eslint-disable no-undef */

const fs = require("fs");
const path = require("path");
const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { DefinePlugin } = require("webpack");
const { zipSync } = require("fflate");
const environments = require("./environments");

// The Teams app's manifest (with the dev values) and icons.
const teamsManifestFolder = path.join(__dirname, "manifests", "teams");
const teamsPackageFiles = ["manifest.json", "color.png", "outline.png"];

// Every failed tool call of a dev pane, one JSON object per line (src/chat/dev/toolErrorLog.ts).
const toolErrorLog = path.join(__dirname, "logs", "tool-errors.jsonl");

// The ports scripts/dev.mjs started this checkout's server on.
const devPortsFile = path.join(__dirname, "..", ".dev-ports.json");

/** The ChatUiT server of this checkout: the one scripts/dev.mjs started, else the one `dotnet run --launch-profile https` starts. */
function apiDev() {
  try {
    return `https://localhost:${JSON.parse(fs.readFileSync(devPortsFile, "utf8")).server}`;
  } catch {
    return "https://localhost:7254";
  }
}

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

/** The dev values in the manifests and their prod values, in the order they are replaced. */
function prodReplacements(prod) {
  const dev = environments.dev;
  return [
    [dev.addinUrl, prod.addinUrl],
    [dev.appUrl, prod.appUrl],
    // The bare origin, as in <AppDomain>.
    [new URL(dev.addinUrl).origin, new URL(prod.addinUrl).origin],
    // The bare hosts, as in validDomains.
    [`"${new URL(dev.addinUrl).host}"`, `"${new URL(prod.addinUrl).host}"`],
    [`"${new URL(dev.appUrl).host}"`, `"${new URL(prod.appUrl).host}"`],
    [dev.officeId, prod.officeId],
    [dev.outlookId, prod.outlookId],
    [dev.teamsId, prod.teamsId],
    [`<DisplayName DefaultValue="${dev.displayName}"/>`, `<DisplayName DefaultValue="${prod.displayName}"/>`],
    [`"${dev.displayName}"`, `"${prod.displayName}"`],
  ];
}

/** Rewrites a dev manifest (Office XML or Teams JSON) with the prod values. */
function toProdManifest(content, prod) {
  return prodReplacements(prod).reduce(
    (text, [devValue, prodValue]) => text.replaceAll(devValue, prodValue),
    content.toString()
  );
}

/** Emits the Teams app package, the zip that is uploaded to Teams, as chatuit-teams.zip. */
class TeamsPackagePlugin {
  constructor(transformManifest) {
    this.transformManifest = transformManifest;
  }

  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap("TeamsPackagePlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "TeamsPackagePlugin", stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          const files = {};
          for (const name of teamsPackageFiles) {
            const file = path.join(teamsManifestFolder, name);
            compilation.fileDependencies.add(file);
            const content = fs.readFileSync(file);
            files[name] = name === "manifest.json" ? Buffer.from(this.transformManifest(content.toString())) : content;
          }
          compilation.emitAsset("chatuit-teams.zip", new sources.RawSource(Buffer.from(zipSync(files))));
        }
      );
    });
  }
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const environment = dev ? environments.dev : prodEnvironment();

  return {
    devtool: "source-map",
    entry: {
      taskpane: "./src/office/taskpane/index.tsx",
      sidepanel: "./src/teams/sidepanel/index.tsx",
      config: "./src/teams/config/index.ts",
    },
    output: {
      // dist/ is what `dotnet publish` copies into wwwroot, so the add-in is served under /office/.
      path: path.resolve(__dirname, "dist", "office"),
      filename: dev ? "[name].js" : "[name].[contenthash].js",
      clean: true,
    },
    optimization: {
      runtimeChunk: "single",
      // The task pane and the Teams side panel share the chat code and its libraries.
      splitChunks: { chunks: "all" },
    },
    performance: {
      maxAssetSize: 1.5 * 1024 * 1024,
      maxEntrypointSize: 1.5 * 1024 * 1024,
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
      new HtmlWebpackPlugin({
        filename: "sidepanel.html",
        template: "./src/teams/sidepanel/sidepanel.html",
        chunks: ["sidepanel"],
      }),
      new HtmlWebpackPlugin({
        filename: "config.html",
        template: "./src/teams/config/config.html",
        chunks: ["config"],
      }),
      new TeamsPackagePlugin((content) => (dev ? content : toProdManifest(content, environment))),
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
      proxy: [{ context: ["/api"], target: apiDev(), router: apiDev, changeOrigin: true }],
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
