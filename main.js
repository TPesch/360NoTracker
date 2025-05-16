const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const TwitchClient = require('./twitch-client');
const DataManager = require('./data-manager');

// Keep a global reference of objects to prevent garbage collection
let mainWindow;
let twitchClient;
let dataManager;
// Connection status tracking variable
let twitchConnectionStatus = {
  connected: false,
  connecting: false,
  lastAttempt: null,
  error: null
};
// Add new IPC handlers for connection status
function setupConnectionHandlers() {
  // Get current connection status
  ipcMain.handle('get-connection-status', () => {
    return twitchConnectionStatus;
  });

  // Update connection status event handler
  ipcMain.on('connection-status-update', (event, status) => {
    console.log('Connection status update:', status);
    
    // Update the status
    if (status.status === 'connecting') {
      twitchConnectionStatus.connecting = true;
      twitchConnectionStatus.lastAttempt = new Date();
    } else if (status.status === 'disconnecting') {
      twitchConnectionStatus.connecting = false;
    } else if (status.status === 'timeout') {
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.error = 'Connection attempt timed out';
    }
    
    // Forward the update to the renderer
    if (mainWindow) {
      mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
    }
  });
  
  // Updated connect to Twitch handler
  ipcMain.handle('connect-to-twitch', async () => {
    try {
      // Check if already connecting or connected
      if (twitchConnectionStatus.connecting) {
        console.log('Connection already in progress, ignoring request');
        return { success: false, message: 'Connection already in progress' };
      }
      
      // Mark as connecting
      twitchConnectionStatus.connecting = true;
      twitchConnectionStatus.lastAttempt = new Date();
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      // Connect to Twitch
      const result = await twitchClient.connect();
      
      // Update status based on result
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.connected = result.success;
      twitchConnectionStatus.error = result.success ? null : result.message;
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      return result;
    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      
      // Update status
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = error.message;
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      throw error;
    }
  });
  
  // Updated disconnect from Twitch handler
  ipcMain.handle('disconnect-from-twitch', async () => {
    try {
      // Check if already disconnected
      if (!twitchConnectionStatus.connected && !twitchConnectionStatus.connecting) {
        console.log('Already disconnected, ignoring request');
        return { success: true, message: 'Already disconnected' };
      }
      
      // Mark as disconnecting
      twitchConnectionStatus.connecting = false;
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      // Disconnect from Twitch
      const result = await twitchClient.disconnect();
      
      // Update status based on result
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = null;
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      return result;
    } catch (error) {
      console.error('Error disconnecting from Twitch:', error);
      
      // Update status
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = error.message;
      
      // Forward status to renderer
      if (mainWindow) {
        mainWindow.webContents.send('connection-status-update', twitchConnectionStatus);
      }
      
      throw error;
    }
  });
}

// Initialize data directory
const appDataPath = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}

// Create main application window
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'src', 'assets', 'icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'index.html'));

  // Initialize data manager
  dataManager = new DataManager(appDataPath);
  
  // Create Twitch client (not connected yet)
  twitchClient = new TwitchClient(dataManager);

  // Set up application menu
  createMenu();

  // Open the DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'settings.html'))
        },
        { type: 'separator' },
        {
          label: 'Export All Data',
          click: exportAllData
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'index.html'))
        },
        {
          label: 'Bits Donations',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'donations.html'))
        },
        {
          label: 'Gift Subs',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'gift-subs.html'))
        },
        {
          label: 'Spin Commands',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'spin-commands.html'))
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Twitch',
      submenu: [
        {
          label: 'Connect to Twitch',
          click: () => twitchClient.connect()
        },
        {
          label: 'Disconnect from Twitch',
          click: () => twitchClient.disconnect()
        },
        { type: 'separator' },
        {
          label: 'Open Twitch Channel',
          click: () => {
            const channel = dataManager.getConfig().channelName || 'twitch';
            shell.openExternal(`https://twitch.tv/${channel}`);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => showAboutDialog()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Show About dialog
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    title: 'About Twitch Donation Tracker',
    message: 'Twitch Donation Tracker',
    detail: 'Version 1.0.0\nCreated by Tomas Pesch\n\nTrack Twitch bit donations and gift subscriptions for wheel spins.',
    buttons: ['OK'],
    icon: path.join(__dirname, 'src', 'assets', 'icon.png')
  });
}

// Export all data to CSV
function exportAllData() {
  dialog.showSaveDialog(mainWindow, {
    title: 'Export All Data',
    defaultPath: path.join(app.getPath('documents'), 'twitch-tracker-export.zip'),
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
  }).then(result => {
    if (!result.canceled) {
      dataManager.exportAllData(result.filePath)
        .then(() => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Export Complete',
            message: 'All data has been exported successfully.',
            buttons: ['OK']
          });
        })
        .catch(error => {
          dialog.showErrorBox('Export Failed', `Error exporting data: ${error.message}`);
        });
    }
  });
}

// IPC Communication handlers
function setupIPC() {
  // Get configuration
  ipcMain.handle('get-config', () => {
    return dataManager.getConfig();
  });
  
  // Save configuration
  ipcMain.handle('save-config', (event, config) => {
    return dataManager.saveConfig(config);
  });
  // Get bit donations
  ipcMain.handle('get-bit-donations', () => {
    return dataManager.getBitDonations();
  });

  // Get gift subscriptions
  ipcMain.handle('get-gift-subs', () => {
    return dataManager.getGiftSubs();
  });

  // Get spin commands
  ipcMain.handle('get-spin-commands', () => {
    return dataManager.getSpinCommands();
  });

  // Update donation spin status
  ipcMain.handle('update-donation-spin', (event, { timestamp, spinTriggered }) => {
    return dataManager.updateDonationSpinStatus(timestamp, spinTriggered);
  });

  // Update gift sub spin status
  ipcMain.handle('update-gift-sub-spin', (event, { timestamp, spinTriggered }) => {
    return dataManager.updateGiftSubSpinStatus(timestamp, spinTriggered);
  });

  // Process spin command
  ipcMain.handle('process-spin-command', (event, { modUsername, targetUsername }) => {
    return dataManager.processSpinCommand(modUsername, targetUsername);
  });

  // Test donation
  ipcMain.handle('create-test-donation', (event, data) => {
    return dataManager.createTestDonation(data);
  });

  // Test gift sub
  ipcMain.handle('create-test-gift-sub', (event, data) => {
    return dataManager.createTestGiftSub(data);
  });

  // Test spin command
  ipcMain.handle('create-test-spin-command', (event, data) => {
    return dataManager.createTestSpinCommand(data);
  });

  // // Connect to Twitch
  // ipcMain.handle('connect-to-twitch', () => {
  //   return twitchClient.connect();
  // });
  setupConnectionHandlers();
  // Connect to Twitch

  // // Disconnect from Twitch
  // ipcMain.handle('disconnect-from-twitch', () => {
  //   return twitchClient.disconnect();
  // });

  // Get spin tracker data
  ipcMain.handle('get-spin-tracker-data', () => {
    return dataManager.getSpinTrackerData();
  });

  // Complete a spin
  ipcMain.handle('complete-spin', (event, id) => {
    return dataManager.completeSpin(id);
  });

  // Reset spins
  ipcMain.handle('reset-spins', (event, id) => {
    return dataManager.resetSpins(id);
  });

  // Clear completed spins
  ipcMain.handle('clear-completed-spins', () => {
    return dataManager.clearCompletedSpins();
  });

  // Export data
  ipcMain.handle('export-csv', (event, type) => {
    return new Promise((resolve, reject) => {
      dialog.showSaveDialog(mainWindow, {
        title: `Export ${type} Data`,
        defaultPath: path.join(app.getPath('documents'), `${type}.csv`),
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      }).then(result => {
        if (!result.canceled) {
          dataManager.exportCSV(type, result.filePath)
            .then(() => resolve({ success: true }))
            .catch(error => reject(error));
        } else {
          resolve({ success: false, canceled: true });
        }
      });
    });
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();
  setupIPC();

  // Forward events from data manager to renderer
  dataManager.on('new-donation', (donation) => {
    if (mainWindow) mainWindow.webContents.send('new-donation', donation);
  });

  dataManager.on('new-gift-sub', (giftSub) => {
    if (mainWindow) mainWindow.webContents.send('new-gift-sub', giftSub);
  });

  dataManager.on('new-spin-command', (command) => {
    if (mainWindow) mainWindow.webContents.send('new-spin-command', command);
  });

  dataManager.on('spin-alert', (data) => {
    if (mainWindow) mainWindow.webContents.send('spin-alert', data);
  });

  dataManager.on('twitch-connection-status', (status) => {
    if (mainWindow) mainWindow.webContents.send('twitch-connection-status', status);
  });

  app.on('activate', () => {
    // On macOS re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up when app is quitting
app.on('before-quit', () => {
  if (twitchClient) {
    twitchClient.disconnect();
  }
});