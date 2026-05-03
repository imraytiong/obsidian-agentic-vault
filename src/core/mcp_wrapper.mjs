/* global process */
import { spawn } from 'child_process';

const command = process.argv[2];
const args = process.argv.slice(3);

const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });

child.stdout.on('data', data => {
	const str = data.toString();
	// JSON-RPC messages must start with {
	// If it doesn't, redirect to stderr to prevent breaking the MCP protocol
	if (str.trim().startsWith('{')) {
		process.stdout.write(data);
	} else {
		process.stderr.write(data);
	}
});

process.stdin.pipe(child.stdin);
