import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { registerLlmIpc } from './ipc-llm';
import { registerSkillIpc } from './ipc-skills';
import { registerProjectsIpc } from './ipc-projects';
import { registerPluginsIpc } from './ipc-plugins';
import { seedOrRefreshKnowledge } from './skills/seed';

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
