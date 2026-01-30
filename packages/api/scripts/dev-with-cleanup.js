#!/usr/bin/env node
/**
 * Development server wrapper with port cleanup
 * Ensures port 3040 is free before starting the server
 */

import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = process.env.PORT || '3040';

async function killProcessOnPort(port) {
  try {
    // Windows: netstat to find PID, then taskkill
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split('\n');
    const pids = new Set();

    for (const line of lines) {
      const match = line.match(/\s+(\d+)\s*$/);
      if (match) {
        const pid = match[1];
        // Don't kill system processes (PID 0, 4)
        if (pid !== '0' && pid !== '4') {
          pids.add(pid);
        }
      }
    }

    for (const pid of pids) {
      try {
        await execAsync(`taskkill /F /PID ${pid}`);
        console.log(`✓ Killed process ${pid} on port ${port}`);
      } catch (e) {
        // Process might have already exited
      }
    }

    // Wait a bit for OS to release the port
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (err) {
    // No process on port, or command failed (non-Windows)
    // This is fine, we'll try to start anyway
  }
}

async function startServer() {
  console.log(`🔍 Checking port ${PORT}...`);
  await killProcessOnPort(PORT);
  console.log(`🚀 Starting development server on port ${PORT}...\n`);

  const child = spawn('tsx', ['watch', 'src/server.ts'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`\n❌ Server exited with code ${code}`);
      process.exit(code);
    }
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    child.kill('SIGTERM');
    setTimeout(() => {
      child.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
}

startServer();
