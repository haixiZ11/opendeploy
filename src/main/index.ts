import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { release as osRelease } from 'node:os';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { registerLlmIpc } from './ipc-llm';
import { registerSkillIpc } from './ipc-skills';
import { registerProjectsIpc } from './ipc-projects';
import { registerPluginsIpc } from './ipc-plugins';
import { seedOrRefreshKnowledge } from './skills/seed';
import { createLogger, getLogPath } from './logger';
import { openDeployHome } from './paths';

// Must run before app `ready` so Electron's userData path uses this name.
app.setName('OpenDeploy');

// In packaged builds, point bridge resolver at the extraResources copy
// (electron-builder ships bos-bridge/* under resources/bos-bridge/).
// Dev mode falls through to the bin/Release/net48 path.
if (app.isPackaged && !process.env.BOS_BRIDGE_EXE) {
  process.env.BOS_BRIDGE_EXE = join(
    process.resourcesPath,
    'bos-bridge',
    'opendeploy-bos-serializer.exe',
  );
}

let mainWin: BrowserWindow | null = null;

app.whenReady().then(async () => {
  // First line of every session — gives remote diagnostics a fixed anchor
  // for version + platform without needing to ask the user.
  const startupLogger = createLogger('app');
  void startupLogger.info(
    `OpenDeploy v${app.getVersion()} starting | ` +
      `platform=${process.platform} ${osRelease()} arch=${process.arch} | ` +
      `electron=${process.versions.electron} node=${process.versions.node} | ` +
      `home=${openDeployHome()} | log=${getLogPath()}`,
  );

  registerIpcHandlers();
  registerLlmIpc(() => mainWin);
  registerSkillIpc();
  registerProjectsIpc(() => mainWin);
  registerPluginsIpc();
  await seedOrRefreshKnowledge();
  mainWin = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWin = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
