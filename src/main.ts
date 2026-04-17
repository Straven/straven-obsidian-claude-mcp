import { Notice, Plugin } from 'obsidian';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import * as http from 'http';

export default class StravenmcpPlugin extends Plugin {
	private httpServer: http.Server | null = null;

	async onload() {
		const mcp = new McpServer({ name: 'straven-mcp', version: '0.1.0' });

		mcp.tool('ping', 'Check if the MCP server is alive', {}, async () => ({
			content: [{ type: 'text' as const, text: JSON.stringify({ result: 'pong' }) }],
		}));

		const transports = new Map<string, SSEServerTransport>();

		this.httpServer = http.createServer(async (req, res) => {
			const url = new URL(req.url ?? '/', 'http://localhost');

			if (req.method === 'GET' && url.pathname === '/sse') {
				const transport = new SSEServerTransport('/messages', res);
				transports.set(transport.sessionId, transport);
				res.on('close', () => transports.delete(transport.sessionId));
				await mcp.connect(transport);
			} else if (req.method === 'POST' && url.pathname === '/messages') {
				const sessionId = url.searchParams.get('sessionId') ?? '';
				const transport = transports.get(sessionId);
				if (transport) {
					await transport.handlePostMessage(req, res);
				} else {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: { code: 'SESSION_NOT_FOUND', message: 'No active session for this sessionId' } }));
				}
			} else {
				res.writeHead(404);
				res.end();
			}
		});

		this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				new Notice('straven-mcp: port 27124 is already in use. Disable another plugin using that port.');
			} else {
				new Notice(`straven-mcp: server error — ${err.message}`);
			}
		});

		this.httpServer.listen(27124, '127.0.0.1', () => {
			console.log('straven-mcp: listening on http://127.0.0.1:27124');
		});
	}

	async onunload() {
		if (this.httpServer) {
			this.httpServer.close();
			this.httpServer = null;
		}
	}
}
