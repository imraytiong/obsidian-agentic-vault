import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const SandboxFSApi = () => ({
  name: 'sandbox-fs-api',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (!req.url.startsWith('/api/')) return next();
      
      let body = '';
      req.on('data', (chunk: any) => body += chunk.toString());
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const vaultRoot = path.resolve(__dirname, '../test-vault-empty');
          
          if (req.url.startsWith('/api/fs/')) {
            const targetPath = path.join(vaultRoot, payload.path || '');
            
            if (!targetPath.startsWith(vaultRoot)) {
              res.statusCode = 403;
              return res.end("Forbidden path");
            }

            if (req.url === '/api/fs/read') {
              const content = fs.readFileSync(targetPath, 'utf-8');
              res.end(JSON.stringify({ content }));
            } else if (req.url === '/api/fs/write') {
              fs.mkdirSync(path.dirname(targetPath), { recursive: true });
              fs.writeFileSync(targetPath, payload.content, 'utf-8');
              res.end(JSON.stringify({ success: true }));
            } else if (req.url === '/api/fs/exists') {
              const exists = fs.existsSync(targetPath);
              res.end(JSON.stringify({ exists }));
            } else if (req.url === '/api/fs/list') {
              if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
                const files = fs.readdirSync(targetPath).map((f: string) => path.join(payload.path, f));
                res.end(JSON.stringify({ files }));
              } else {
                res.end(JSON.stringify({ files: [] }));
              }
            } else if (req.url === '/api/fs/mkdir') {
              fs.mkdirSync(targetPath, { recursive: true });
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 404;
              res.end("Not found");
            }
          } else if (req.url === '/api/exec') {
            // Local process runner for the sandbox
            const exe = payload.exe;
            const args = payload.args;
            const child = spawn(exe, args, { cwd: vaultRoot, env: { ...process.env, PATH: `${payload.customEnvPath}:${process.env.PATH || ''}` } });
            
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d: any) => stdout += d.toString());
            child.stderr.on('data', (d: any) => stderr += d.toString());
            child.on('close', (code: number) => {
              if (code === 0) res.end(JSON.stringify({ stdout, stderr }));
              else {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: stdout || stderr || `Process exited with code ${code}`, stderr }));
              }
            });
            child.on('error', (err: any) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            });
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
  }
});

export default defineConfig({
  plugins: [react(), SandboxFSApi()],
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, './src/mocks/obsidian.ts')
    }
  },
  server: {
    port: 5173
  }
})
