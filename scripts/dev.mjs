// Starts the server and the Vite dev server on free ports.
// The web app port can be fixed with --port <port>. Otherwise both ports are the first free ones.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CLIENT_PORT = 54979;
const DEFAULT_SERVER_PORT = 7254;
const MAX_TRIES = 20;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(repoRoot, 'ChatUiT.Server', 'ChatUiT.Server.csproj');

// Resolves true when nothing accepts connections on the port on localhost (IPv4 or IPv6).
function isFree(port) {
    const tryHost = (host) => new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.once('connect', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => resolve(true));
    });
    return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((results) => results.every(Boolean));
}

async function firstFreePort(start) {
    for (let port = start; port < start + MAX_TRIES; port++) {
        if (await isFree(port)) {
            return port;
        }
    }
    throw new Error(`No free port in ${start}-${start + MAX_TRIES - 1}`);
}

const portArg = process.argv.indexOf('--port');
const client = portArg !== -1 ? Number(process.argv[portArg + 1]) : await firstFreePort(DEFAULT_CLIENT_PORT);
const server = await firstFreePort(DEFAULT_SERVER_PORT);
const clientUrl = `https://localhost:${client}`;
const serverUrl = `https://localhost:${server}`;

console.log(`ChatUiT web app: ${clientUrl} (server ${serverUrl})`);

// The Office add-in's dev server reads the server port from this file.
const portsFile = path.join(repoRoot, '.dev-ports.json');
fs.writeFileSync(portsFile, JSON.stringify({ client, server }));
process.on('exit', () => fs.rmSync(portsFile, { force: true }));

const child = spawn('dotnet', [
    'run',
    '--project', project,
    '--no-launch-profile',
    `--property:SpaProxyServerUrl=${clientUrl}`,
], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_HOSTINGSTARTUPASSEMBLIES: 'Microsoft.AspNetCore.SpaProxy',
        ASPNETCORE_URLS: serverUrl,
        AllowedOrigins__0: clientUrl,
        CHATUIT_CLIENT_PORT: String(client),
    },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 0));
