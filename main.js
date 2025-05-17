const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const TwitchClient = require('./twitch-client');
const DataManager = require('./data-manager');

// Keep a global reference of objects to prevent garbage collection
let mainWindow;
let twitchClient;
let dataManager;
// Enhanced connection status tracking with timeout management
// Simple connection status object without any non-serializable properties
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
    // Make a clean copy without circular references
    return {
      connected: twitchConnectionStatus.connected,
      connecting: twitchConnectionStatus.connecting,
      lastAttempt: twitchConnectionStatus.lastAttempt ? 
                   twitchConnectionStatus.lastAttempt.toISOString() : null,
      error: twitchConnectionStatus.error
    };
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
    } else if (status.status === 'error') {
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = status.error || 'Connection failed';
    }
    
    // Send safe connection status update to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('connection-status-update', {
          connected: twitchConnectionStatus.connected,
          connecting: twitchConnectionStatus.connecting,
          lastAttempt: twitchConnectionStatus.lastAttempt ? 
                       twitchConnectionStatus.lastAttempt.toISOString() : null,
          error: twitchConnectionStatus.error
        });
      } catch (err) {
        console.error('Error sending connection status to renderer:', err);
      }
    }
  });
  // Force reset connection status
  ipcMain.handle('force-reset-connection', () => {
    console.log('Force resetting connection status');
    twitchConnectionStatus.connecting = false;
    twitchConnectionStatus.connected = false;
    twitchConnectionStatus.error = null;
    
    // Let the renderer know about the reset
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('connection-status-update', {
          connected: false,
          connecting: false,
          lastAttempt: null,
          error: null
        });
      } catch (err) {
        console.error('Error sending connection reset status to renderer:', err);
      }
    }
    
    return { success: true };
  });
// Connect to Twitch handler - FIXED VERSION
  ipcMain.handle('connect-to-twitch', async () => {
    // Even if it says we're connecting, force reset the state first
    twitchConnectionStatus.connecting = false;
    twitchConnectionStatus.connected = false;
    twitchConnectionStatus.error = null;
    
    try {
      // Now mark as connecting
      twitchConnectionStatus.connecting = true;
      twitchConnectionStatus.lastAttempt = new Date();
      
      // Send status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt.toISOString(),
            error: null
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
      }
      
      // Make sure any existing client is cleaned up first
      if (twitchClient && twitchClient.client) {
        try {
          await twitchClient.disconnect();
        } catch (err) {
          console.log('Error while disconnecting existing client:', err);
          // Continue anyway
        }
      }
      
      // Connect to Twitch
      const result = await twitchClient.connect();
      
      // Update status based on result
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.connected = result.success;
      twitchConnectionStatus.error = result.success ? null : result.message;
      
      // Send status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt.toISOString(),
            error: twitchConnectionStatus.error
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      
      // Update status
      twitchConnectionStatus.connecting = false;
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = error.message;
      
      // Send status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt.toISOString(),
            error: twitchConnectionStatus.error
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
      }
      
      throw error;
    }
  });
 // Disconnect from Twitch handler - SIMPLIFIED VERSION
  ipcMain.handle('disconnect-from-twitch', async () => {
    try {
      // Check if already disconnected
      if (!twitchConnectionStatus.connected && !twitchConnectionStatus.connecting) {
        console.log('Already disconnected, ignoring request');
        return { success: true, message: 'Already disconnected' };
      }
      
      // Mark as disconnecting
      twitchConnectionStatus.connecting = false;
      
      // Send safe connection status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt ? 
                        twitchConnectionStatus.lastAttempt.toISOString() : null,
            error: twitchConnectionStatus.error
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
      }
      
      // Make sure twitchClient exists
      if (!twitchClient) {
        twitchConnectionStatus.connected = false;
        return { success: true, message: 'Not connected' };
      }
      
      // Disconnect from Twitch
      const result = await twitchClient.disconnect();
      
      // Update status based on result
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = null;
      
      // Send safe connection status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt ? 
                        twitchConnectionStatus.lastAttempt.toISOString() : null,
            error: twitchConnectionStatus.error
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error disconnecting from Twitch:', error);
      
      // Update status
      twitchConnectionStatus.connected = false;
      twitchConnectionStatus.error = error.message;
      
      // Send safe connection status update to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('connection-status-update', {
            connected: twitchConnectionStatus.connected,
            connecting: twitchConnectionStatus.connecting,
            lastAttempt: twitchConnectionStatus.lastAttempt ? 
                        twitchConnectionStatus.lastAttempt.toISOString() : null,
            error: twitchConnectionStatus.error
          });
        } catch (err) {
          console.error('Error sending connection status to renderer:', err);
        }
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
        {
          label: 'Spin Tracker', 
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'spin-tracker.html'))
        },
        {
          label: 'Data',
          click: () => mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'data.html'))
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
    detail: 'Version 1.0.0\nCreated by Fake_Boi\n\nTrack Twitch bit donations and gift subscriptions for wheel spins.\n\nThis application is not affiliated with Twitch\nTo contact please email:\n 14TPesch@gmail.com',
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

// Import bit donations
  ipcMain.handle('import-bit-donations', (event, csvData) => {
    return dataManager.importBitDonations(csvData);
  });

  // Import gift subs
  ipcMain.handle('import-gift-subs', (event, csvData) => {
    return dataManager.importGiftSubs(csvData);
  });

  // Import spin commands
  ipcMain.handle('import-spin-commands', (event, csvData) => {
    return dataManager.importSpinCommands(csvData);
  });

  // Export all data as ZIP
  ipcMain.handle('export-all-csv', () => {
    return new Promise((resolve, reject) => {
      dialog.showSaveDialog(mainWindow, {
        title: 'Export All Data as ZIP',
        defaultPath: path.join(app.getPath('documents'), 'twitch-tracker-export.zip'),
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
      }).then(result => {
        if (!result.canceled) {
          dataManager.exportAllData(result.filePath)
            .then(result => resolve(result))
            .catch(error => reject(error));
        } else {
          resolve({ success: false, canceled: true });
        }
      });
    });
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


  setupConnectionHandlers();


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
  // Delete all data
  ipcMain.handle('delete-all-data', async () => {
    try {
      // Show confirmation dialog
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Delete All Data',
        message: 'Are you sure you want to delete all tracking data?',
        detail: 'This will permanently delete all donation records, gift sub records, and spin commands. This cannot be undone. Your settings will be preserved.',
        buttons: ['Cancel', 'Delete All Data'],
        defaultId: 0,
        cancelId: 0
      });
      
      // If user confirmed (clicked the "Delete All Data" button)
      if (choice.response === 1) {
        const result = await dataManager.deleteAllData();
        
        // Show success message
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Data Deleted',
          message: 'All tracking data has been deleted successfully.',
          buttons: ['OK']
        });
        
        return result;
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      
      // Show error message
      await dialog.showErrorBox(
        'Error Deleting Data',
        `Failed to delete data: ${error.message}`
      );
      
      throw error;
    }
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
app.on('before-quit', async (event) => {
  // If twitchClient exists and is connected, try to disconnect gracefully
  if (twitchClient && twitchClient.connected) {
    try {
      // Prevent immediate quit to allow disconnection
      event.preventDefault();
      
      // Try to disconnect
      await twitchClient.disconnect();
      
      // Now quit for real
      app.quit();
    } catch (error) {
      console.error('Error disconnecting before quit:', error);
      // Continue with quit even if there's an error
      app.quit();
    }
  }
});