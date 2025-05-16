const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Data retrieval
  getBitDonations: () => ipcRenderer.invoke('get-bit-donations'),
  getGiftSubs: () => ipcRenderer.invoke('get-gift-subs'),
  getSpinCommands: () => ipcRenderer.invoke('get-spin-commands'),
  
  // Data updates
  updateDonationSpin: (data) => ipcRenderer.invoke('update-donation-spin', data),
  updateGiftSubSpin: (data) => ipcRenderer.invoke('update-gift-sub-spin', data),
  processSpinCommand: (data) => ipcRenderer.invoke('process-spin-command', data),
  
 // Twitch connection handling with timeout and retry
 connectToTwitch: () => {
  // Set a connection status indicator
  ipcRenderer.send('connection-status-update', { status: 'connecting' });
  
  // Set a timeout to detect hanging connections
  const connectionTimeout = setTimeout(() => {
    console.log('Connection attempt timed out, retrying...');
    ipcRenderer.send('connection-status-update', { status: 'timeout' });
    
    // Try to disconnect and reconnect
    ipcRenderer.invoke('disconnect-from-twitch').then(() => {
      // Wait a moment and try to reconnect
      setTimeout(() => {
        ipcRenderer.invoke('connect-to-twitch');
      }, 1000);
    });
  }, 10000); // 10 second timeout
  
  // Invoke the connection method
  return ipcRenderer.invoke('connect-to-twitch')
    .then(result => {
      // Clear the timeout
      clearTimeout(connectionTimeout);
      return result;
    })
    .catch(error => {
      // Clear the timeout
      clearTimeout(connectionTimeout);
      throw error;
    });
},

disconnectFromTwitch: () => {
  // Set a disconnection status
  ipcRenderer.send('connection-status-update', { status: 'disconnecting' });
  
  return ipcRenderer.invoke('disconnect-from-twitch');
},

// Add a connection status listener
onConnectionStatusUpdate: (callback) => 
  ipcRenderer.on('connection-status-update', (_, status) => callback(status)),

// Check current connection status
getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),

  // Test functions
  createTestDonation: (data) => ipcRenderer.invoke('create-test-donation', data),
  createTestGiftSub: (data) => ipcRenderer.invoke('create-test-gift-sub', data),
  createTestSpinCommand: (data) => ipcRenderer.invoke('create-test-spin-command', data),
  
  // Spin tracker
  getSpinTrackerData: () => ipcRenderer.invoke('get-spin-tracker-data'),
  completeSpin: (id) => ipcRenderer.invoke('complete-spin', id),
  resetSpins: (id) => ipcRenderer.invoke('reset-spins', id),
  clearCompletedSpins: () => ipcRenderer.invoke('clear-completed-spins'),
  onSpinStatusUpdate: (callback) => ipcRenderer.on('spin-status-update', (_, data) => callback(data)),
  
  // Export
  exportCSV: (type) => ipcRenderer.invoke('export-csv', type),
  
  // Event listeners
  onNewDonation: (callback) => ipcRenderer.on('new-donation', (_, data) => callback(data)),
  onNewGiftSub: (callback) => ipcRenderer.on('new-gift-sub', (_, data) => callback(data)),
  onNewSpinCommand: (callback) => ipcRenderer.on('new-spin-command', (_, data) => callback(data)),
  onSpinAlert: (callback) => ipcRenderer.on('spin-alert', (_, data) => callback(data)),
  onTwitchConnectionStatus: (callback) => ipcRenderer.on('twitch-connection-status', (_, status) => callback(status)),
  
  // Remove listeners (important to avoid memory leaks)
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});