// Main renderer script for the dashboard
document.addEventListener('DOMContentLoaded', async function() {
  // Elements
  const channelNameEl = document.getElementById('channel-name');
  const connectionStatusEl = document.getElementById('connection-status');
  const connectButton = document.getElementById('connect-twitch');
  const disconnectButton = document.getElementById('disconnect-twitch');
  const activityFeedEl = document.getElementById('activity-feed');
  const spinAlertEl = document.getElementById('spin-alert');
  const spinAlertMessageEl = document.getElementById('spin-alert-message');
  
  // Stats elements
  const totalDonationsEl = document.getElementById('total-donations');
  const totalBitsEl = document.getElementById('total-bits');
  const totalSpinsEl = document.getElementById('total-spins');
  const topDonatorEl = document.getElementById('top-donator');
  
  const totalGiftSubsEl = document.getElementById('total-gift-subs');
  const giftSubSpinsEl = document.getElementById('gift-sub-spins');
  const topGifterEl = document.getElementById('top-gifter');
  const giftThresholdEl = document.getElementById('gift-threshold');
  
  const totalCommandsEl = document.getElementById('total-commands');
  const uniqueUsersEl = document.getElementById('unique-users');
  
  // Navigation buttons
  const navDashboardBtn = document.getElementById('nav-dashboard');
  const navDonationsBtn = document.getElementById('nav-donations');
  const navGiftSubsBtn = document.getElementById('nav-gift-subs');
  const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
  const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
  const navDataBtn = document.getElementById('nav-data');
  const navSettingsBtn = document.getElementById('nav-settings');
  
  // Export buttons
  const exportDonationsBtn = document.getElementById('export-donations');
  const exportGiftSubsBtn = document.getElementById('export-gift-subs');
  const exportSpinCommandsBtn = document.getElementById('export-spin-commands');
  
  // Navigation handlers
  navDashboardBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  
  navDonationsBtn.addEventListener('click', () => {
    window.location.href = 'donations.html';
  });
  
  navGiftSubsBtn.addEventListener('click', () => {
    window.location.href = 'gift-subs.html';
  });
  
  navSpinCommandsBtn.addEventListener('click', () => {
    window.location.href = 'spin-commands.html';
  });
  
  navSpinTrackerBtn.addEventListener('click', () => {
    window.location.href = 'spin-tracker.html';
  });
  
  navDataBtn.addEventListener('click', () => {
    window.location.href = 'data.html';
  });

  navSettingsBtn.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });
  
  // Export handlers
  exportDonationsBtn.addEventListener('click', () => {
    exportCSV('bit_donations');
  });
  
  exportGiftSubsBtn.addEventListener('click', () => {
    exportCSV('gift_subs');
  });
  
  exportSpinCommandsBtn.addEventListener('click', () => {
    exportCSV('spin_commands');
  });
  
 // Connect/disconnect handlers
  connectButton.addEventListener('click', () => {
    connectToTwitch();
  });
  
  disconnectButton.addEventListener('click', () => {
    disconnectFromTwitch();
  });

  
  async function connectToTwitch() {
    try {
      // Update status in UI
      connectionStatusEl.textContent = 'Connecting...';
      connectionStatusEl.className = 'status-value connecting';
      
      // Disable connect button
      connectButton.disabled = true;
      
      // Connect
      const result = await window.electronAPI.connectToTwitch();
      console.log('Connect result:', result);
      
      return result;
    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      
      // Update status in UI
      connectionStatusEl.textContent = 'Connection failed: ' + (error.message || 'Unknown error');
      connectionStatusEl.className = 'status-value disconnected';
      
      // Re-enable connect button
      connectButton.disabled = false;
      
      throw error;
    }
  }
  
  // Disconnect from Twitch with enhanced error handling
  async function disconnectFromTwitch() {
    try {
      // Update status
      connectionStatusEl.textContent = 'Disconnecting...';
      connectionStatusEl.className = 'status-value connecting';
      
      const result = await window.electronAPI.disconnectFromTwitch();
      console.log('Disconnect result:', result);
      
      // Update status
      connectionStatusEl.textContent = 'Disconnected';
      connectionStatusEl.className = 'status-value disconnected';
      
      return result;
    } catch (error) {
      console.error('Error disconnecting from Twitch:', error);
      
      // Update status
      connectionStatusEl.textContent = 'Error disconnecting: ' + (error.message || 'Unknown error');
      connectionStatusEl.className = 'status-value disconnected';
      
      // If there was an error, try to force reset the connection status
      try {
        await window.electronAPI.forceResetConnection();
      } catch (resetError) {
        console.error('Error during connection reset:', resetError);
      }
      
      throw error;
    }
  }
  

// Enhanced connection status update handler
function updateConnectionStatus(status) {
  console.log('Connection status update:', status);
  
  // Get or create the recovery button
  const recoveryButton = addConnectionRecoveryButton();
  
  // Update status text and class
  if (status.connecting) {
    connectionStatusEl.textContent = 'Connecting...';
    connectionStatusEl.className = 'status-value connecting';
  } else if (status.connected) {
    connectionStatusEl.textContent = 'Connected';
    connectionStatusEl.className = 'status-value connected';
  } else {
    connectionStatusEl.textContent = status.error ? `Disconnected: ${status.error}` : 'Disconnected';
    connectionStatusEl.className = 'status-value disconnected';
  }
  
  // Enable/disable buttons
  connectButton.disabled = status.connected || status.connecting;
  disconnectButton.disabled = !status.connected;
  
  // Show recovery button if connection appears to be stuck
  if (status.connecting && status.lastAttempt) {
    const now = new Date();
    const lastAttempt = new Date(status.lastAttempt);
    const connectionTime = now - lastAttempt;
    
    if (connectionTime > 15000 && recoveryButton) { // 15 seconds
      recoveryButton.style.display = 'inline-block';
    }
  } else if (recoveryButton) {
    recoveryButton.style.display = 'none';
  }
  
  // Update channel name if connected
  if (status.connected && status.channel) {
    channelNameEl.textContent = status.channel;
  }
}

  function addConnectionRecoveryButton() {
    // Create a new recovery button if it doesn't exist
    if (!document.getElementById('force-reset-connection')) {
      const recoveryButton = document.createElement('button');
      recoveryButton.id = 'force-reset-connection';
      recoveryButton.className = 'button button-danger';
      recoveryButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Reset Connection';
      recoveryButton.style.display = 'none'; // Hide by default
      
      // Add the button to the connection panel
      const connectionPanel = document.querySelector('.connection-panel');
      if (connectionPanel) {
        connectionPanel.appendChild(recoveryButton);
        
        // Add click handler
        recoveryButton.addEventListener('click', async () => {
          try {
            console.log('Manually forcing connection reset');
            connectionStatusEl.textContent = 'Resetting connection...';
            await window.electronAPI.forceResetConnection();
            connectionStatusEl.textContent = 'Connection reset';
            connectionStatusEl.className = 'status-value disconnected';
            
            // Update button states
            connectButton.disabled = false;
            disconnectButton.disabled = true;
            recoveryButton.style.display = 'none';
          } catch (error) {
            console.error('Error resetting connection:', error);
            connectionStatusEl.textContent = 'Reset failed: ' + (error.message || 'Unknown error');
          }
        });
      }
    }
    
    return document.getElementById('force-reset-connection');
  } 
  // Format timestamp
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
  
  // Add activity item to feed
  function addActivityItem(type, data) {
    // Create activity item element
    const activityItem = document.createElement('div');
    activityItem.className = `activity-item ${type}`;
    
    // Create timestamp element
    const timestampEl = document.createElement('div');
    timestampEl.className = 'timestamp';
    timestampEl.textContent = formatTimestamp(data.timestamp);
    
    // Create content element
    const contentEl = document.createElement('div');
    contentEl.className = 'content';
    
    // Create different content based on type
    switch (type) {
      case 'donation':
        contentEl.innerHTML = `
          <span class="username">${escapeHtml(data.username)}</span> 
          donated <strong>${data.bits} bits</strong>
          ${data.spinTriggered ? '<span class="spin-triggered">(SPIN TRIGGERED)</span>' : ''}
        `;
        
        if (data.message) {
          const messageEl = document.createElement('div');
          messageEl.className = 'message';
          messageEl.textContent = data.message;
          contentEl.appendChild(messageEl);
        }
        break;
        
      case 'gift-sub':
        contentEl.innerHTML = `
          <span class="username">${escapeHtml(data.username)}</span> 
          gifted <strong>${data.subCount} subs</strong>
          ${data.spinTriggered ? '<span class="spin-triggered">(SPIN TRIGGERED)</span>' : ''}
        `;
        break;
        
      case 'spin-command':
        contentEl.innerHTML = `
          <span class="username">${escapeHtml(data.username)}</span> 
          used command: <strong>${escapeHtml(data.command)}</strong>
        `;
        break;
        
      case 'spin-alert':
        contentEl.innerHTML = `
          <strong>SPIN ALERT!</strong> 
          <span class="username">${escapeHtml(data.username)}</span> 
          ${data.isGiftSub 
            ? `gifted ${data.subCount} subs!` 
            : `donated ${data.bits} bits!`}
        `;
        break;
        
      default:
        contentEl.textContent = JSON.stringify(data);
    }
    
    // Append elements to activity item
    activityItem.appendChild(timestampEl);
    activityItem.appendChild(contentEl);
    
    // Add to activity feed
    activityFeedEl.insertBefore(activityItem, activityFeedEl.firstChild);
    
    // Limit number of items
    if (activityFeedEl.children.length > 50) {
      activityFeedEl.removeChild(activityFeedEl.lastChild);
    }
    
    // Remove empty state if present
    const emptyState = activityFeedEl.querySelector('.empty-state');
    if (emptyState) {
      activityFeedEl.removeChild(emptyState);
    }
  }
    // Function to play sound for different types of events
  function playSound(type) {
    // Get config settings
    window.electronAPI.getConfig()
      .then(config => {
        if (config.enableSounds) {
          let soundOption;
          
          // Determine which sound to play based on event type
          switch (type) {
            case 'spin':
              soundOption = config.spinSound;
              break;
            case 'bit':
              soundOption = config.bitSound;
              break;
            case 'gift':
              soundOption = config.giftSound;
              break;
            case 'command':
              soundOption = config.commandSound;
              break;
            default:
              soundOption = 'soft';
          }
          
          // If sound is set to 'none', don't play anything
          if (soundOption === 'none') {
            return;
          }
          
          const volume = (config.notificationVolume || 50) / 100;
          
          // Create audio element
          const audio = new Audio();
          
          // Set source based on selected sound
          switch (soundOption) {
            case 'soft':
              audio.src = '../assets/mixkit-light-button-2580.mp3';
              break;
            case 'cash':
              audio.src = '../assets/mixkit-long-pop-2358.mp3';
              break;
            case 'bell':
              audio.src = '../assets/mixkit-gaming-lock-2848.mp3';
              break;
            case 'chime':
              audio.src = '../assets/mixkit-tile-game-reveal-960.mp3';
              break;
            case 'alert':
              audio.src = '../assets/mixkit-message-pop-alert-2354.mp3';
              break;
            default:
              audio.src = '../assets/mixkit-light-button-2580.mp3';
          }
          
          // Set volume
          audio.volume = volume;
          
          // Play sound
          audio.play()
            .catch(error => console.error('Error playing sound:', error));
        }
      })
      .catch(error => console.error('Error getting config for sound:', error));
  }
    // Update the showSpinAlert function to use the new sound system
  function showSpinAlert(data) {
      // Update alert message
      if (data.isGiftSub) {
        spinAlertMessageEl.textContent = `${data.username} gifted ${data.subCount} subs! Time to SPIN!`;
      } else {
        spinAlertMessageEl.textContent = `${data.username} donated ${data.bits} bits! Time to SPIN!`;
      }
      
      // Show alert
      spinAlertEl.style.display = 'block';
      
      // Play spin sound
      playSound('spin');
      
      // Add to activity feed
      addActivityItem('spin-alert', data);
      
      // Hide after 10 seconds
      setTimeout(() => {
        spinAlertEl.style.display = 'none';
      }, 10000);
    }
      
  // Initialize theme on page load
  async function initTheme() {
        try {
          const config = await window.electronAPI.getConfig();
          document.documentElement.setAttribute('data-theme', config.theme || 'dark');
        } catch (error) {
          console.error('Error initializing theme:', error);
        }
      }
  // Call initTheme on page load
  initTheme();
  
  // Update donation stats
  function updateDonationStats(stats) {
    if (!stats) return;
    
    totalDonationsEl.textContent = stats.totalDonations || 0;
    totalBitsEl.textContent = stats.totalBits || 0;
    totalSpinsEl.textContent = stats.totalSpins || 0;
    
    if (stats.topDonator && stats.topDonator !== 'None') {
      topDonatorEl.textContent = `${stats.topDonator} (${stats.topDonatorBits || 0} bits)`;
    } else {
      topDonatorEl.textContent = 'None yet';
    }
  }
  
  // Update gift sub stats
  function updateGiftSubStats(stats) {
    if (!stats) return;
    
    totalGiftSubsEl.textContent = stats.totalGiftSubs || 0;
    giftSubSpinsEl.textContent = stats.totalSpins || 0;
    
    if (stats.topGifter && stats.topGifter !== 'None') {
      topGifterEl.textContent = `${stats.topGifter} (${stats.topGifterSubs || 0} subs)`;
    } else {
      topGifterEl.textContent = 'None yet';
    }
  }
  
  // Update spin command stats
  function updateSpinCommandStats(stats) {
    if (!stats) return;
    
    totalCommandsEl.textContent = stats.totalCommands || 0;
    uniqueUsersEl.textContent = stats.uniqueUsers || 0;
  }
  
  // Escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Export CSV
  async function exportCSV(type) {
    try {
      const result = await window.electronAPI.exportCSV(type);
      if (result.success) {
        console.log(`Exported ${type} data successfully`);
      }
    } catch (error) {
      console.error(`Error exporting ${type} data:`, error);
    }
  }
  // Connect to Twitch with automatic stuck connection handling
  async function connectToTwitch() {
    try {
      // Check if already connecting
      const currentStatus = await window.electronAPI.getConnectionStatus();

      // If it's been stuck connecting for a while, force reset
      if (currentStatus.connecting && currentStatus.lastAttempt) {
        const now = new Date();
      const lastAttempt = new Date(currentStatus.lastAttempt);
      const connectionTime = now - lastAttempt;
      
      if (connectionTime > 10000) { // 10 seconds
        console.log('Connection appears to be stalled, forcing reset first');
        await window.electronAPI.forceResetConnection();
        // Wait a moment before attempting to connect again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Update status
    connectionStatusEl.textContent = 'Connecting...';
    connectionStatusEl.className = 'status-value connecting';
    
    // Connect
    const result = await window.electronAPI.connectToTwitch();
    console.log('Connect result:', result);
    
    // Update status based on result
    if (result.success) {
      connectionStatusEl.textContent = 'Connected';
      connectionStatusEl.className = 'status-value connected';
    } else {
      connectionStatusEl.textContent = result.message || 'Connection failed';
      connectionStatusEl.className = 'status-value disconnected';
    }
    
    return result;
  } catch (error) {
    console.error('Error connecting to Twitch:', error);
    
    // Update status
    connectionStatusEl.textContent = 'Connection failed: ' + (error.message || 'Unknown error');
    connectionStatusEl.className = 'status-value disconnected';
    
    // If there was an error, try to force reset the connection status
    try {
      await window.electronAPI.forceResetConnection();
    } catch (resetError) {
      console.error('Error during connection reset:', resetError);
    }
    
    throw error;
  }
}
  
  // Disconnect from Twitch
  async function disconnectFromTwitch() {
    try {
      const result = await window.electronAPI.disconnectFromTwitch();
      console.log('Disconnect result:', result);
    } catch (error) {
      console.error('Error disconnecting from Twitch:', error);
    }
  }
  
  // Create test donation
  async function createTestDonation() {
    try {
      const donation = await window.electronAPI.createTestDonation({
        username: 'TestUser',
        bits: 1000,
        message: 'This is a test donation',
      });
      
      console.log('Test donation created:', donation);
    } catch (error) {
      console.error('Error creating test donation:', error);
    }
  }
  
  // Create test gift sub
  async function createTestGiftSub() {
    try {
      const giftSub = await window.electronAPI.createTestGiftSub({
        username: 'TestUser',
        subCount: 3,
        recipients: ['Recipient1', 'Recipient2', 'Recipient3'],
      });
      
      console.log('Test gift sub created:', giftSub);
    } catch (error) {
      console.error('Error creating test gift sub:', error);
    }
  }
  
  // Create test spin command
  async function createTestSpinCommand() {
    try {
      const command = await window.electronAPI.createTestSpinCommand({
        username: 'TestMod',
        targetUsername: 'TestUser',
      });
      
      console.log('Test spin command created:', command);
    } catch (error) {
      console.error('Error creating test spin command:', error);
    }
  }
  
  // Initialize
  async function initialize() {
    try {
      // Get configuration
      const config = await window.electronAPI.getConfig();
      console.log('Config:', config);
      
      // Update channel name
      channelNameEl.textContent = config.channelName || 'Not set';
      
      // Update threshold display
      giftThresholdEl.textContent = `${config.giftSubThreshold || 3}+ subs`;
      
      // Load donation data
      const donationData = await window.electronAPI.getBitDonations();
      console.log('Donation data:', donationData);
      updateDonationStats(donationData.stats);
      
      // Load gift sub data
      const giftSubData = await window.electronAPI.getGiftSubs();
      console.log('Gift sub data:', giftSubData);
      updateGiftSubStats(giftSubData.stats);
      
      // Load spin command data
      const spinCommandData = await window.electronAPI.getSpinCommands();
      console.log('Spin command data:', spinCommandData);
      updateSpinCommandStats(spinCommandData.stats);
      
      // Connect to Twitch if auto-connect is enabled
      if (config.autoConnect) {
        connectToTwitch();
      }
    } catch (error) {
      console.error('Error initializing:', error);
    }
  }
  
  // Set up event listeners for real-time updates
  function setupEventListeners() {
    // New donation
    window.electronAPI.onNewDonation((donation) => {
      console.log('New donation:', donation);
      addActivityItem('donation', donation);
      
      playSound('bit');

      // Refresh stats
      window.electronAPI.getBitDonations()
        .then(data => updateDonationStats(data.stats))
        .catch(error => console.error('Error updating donation stats:', error));
    });
    
    // New gift sub
    window.electronAPI.onNewGiftSub((giftSub) => {
      console.log('New gift sub:', giftSub);
      addActivityItem('gift-sub', giftSub);
      
      playSound('gift');

      // Refresh stats
      window.electronAPI.getGiftSubs()
        .then(data => updateGiftSubStats(data.stats))
        .catch(error => console.error('Error updating gift sub stats:', error));
    });
    
    // New spin command
    window.electronAPI.onNewSpinCommand((command) => {
      console.log('New spin command:', command);
      addActivityItem('spin-command', command);
      
      playSound('command');

      // Refresh stats
      window.electronAPI.getSpinCommands()
        .then(data => updateSpinCommandStats(data.stats))
        .catch(error => console.error('Error updating spin command stats:', error));
    });
    
    // Spin alert
    window.electronAPI.onSpinAlert((data) => {
      console.log('Spin alert:', data);
      showSpinAlert(data);
    });
    
    playSound('spin');

    // Twitch connection status
    window.electronAPI.onTwitchConnectionStatus((status) => {
      console.log('Twitch connection status:', status);
      updateConnectionStatus(status);
    });
  }
  
  // Clean up event listeners when navigating away
  function cleanupEventListeners() {
    window.addEventListener('beforeunload', () => {
      window.electronAPI.removeAllListeners('new-donation');
      window.electronAPI.removeAllListeners('new-gift-sub');
      window.electronAPI.removeAllListeners('new-spin-command');
      window.electronAPI.removeAllListeners('spin-alert');
      window.electronAPI.removeAllListeners('twitch-connection-status');
    });
  }
  
  // Initialize and set up
  initialize();
  setupEventListeners();
  cleanupEventListeners();
});