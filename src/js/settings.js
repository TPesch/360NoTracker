// Settings management script
document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const channelNameDisplay = document.getElementById('channel-name');
    const channelNameInput = document.getElementById('channel-name-input');
    const twitchUsernameInput = document.getElementById('twitch-username');
    const twitchOAuthTokenInput = document.getElementById('twitch-oauth-token');
    const autoConnectCheckbox = document.getElementById('auto-connect');
    const bitThresholdInput = document.getElementById('bit-threshold');
    const giftSubThresholdInput = document.getElementById('gift-sub-threshold');
    const saveButton = document.getElementById('save-settings');
    const statusMessage = document.getElementById('settings-status');
    const oauthLink = document.getElementById('oauth-link');
    
    // Navigation buttons
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navDonationsBtn = document.getElementById('nav-donations');
    const navGiftSubsBtn = document.getElementById('nav-gift-subs');
    const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
    const navSettingsBtn = document.getElementById('nav-settings');
    
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
    
    navSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
    
    // OAuth link handler
    oauthLink.addEventListener('click', (event) => {
      event.preventDefault();
      window.electronAPI.openExternalLink('https://twitchapps.com/tmi/');
    });
    
    // Load current settings
    async function loadSettings() {
      try {
        const config = await window.electronAPI.getConfig();
        
        // Update inputs
        channelNameDisplay.textContent = config.channelName || 'Not set';
        channelNameInput.value = config.channelName || '';
        twitchUsernameInput.value = config.twitchUsername || '';
        twitchOAuthTokenInput.value = config.twitchOAuthToken || '';
        autoConnectCheckbox.checked = config.autoConnect || false;
        bitThresholdInput.value = config.bitThreshold || 1000;
        giftSubThresholdInput.value = config.giftSubThreshold || 3;
        
        console.log('Settings loaded successfully');
      } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Failed to load settings', 'error');
      }
    }
    
    // Save settings
    async function saveSettings() {
      // Get values from form
      const channelName = channelNameInput.value.trim();
      const twitchUsername = twitchUsernameInput.value.trim();
      const twitchOAuthToken = twitchOAuthTokenInput.value.trim();
      const autoConnect = autoConnectCheckbox.checked;
      const bitThreshold = parseInt(bitThresholdInput.value);
      const giftSubThreshold = parseInt(giftSubThresholdInput.value);
      
      // Basic validation
      if (!channelName) {
        showStatus('Channel name is required', 'error');
        return;
      }
      
      if (isNaN(bitThreshold) || bitThreshold < 1) {
        showStatus('Bit threshold must be a positive number', 'error');
        return;
      }
      
      if (isNaN(giftSubThreshold) || giftSubThreshold < 1) {
        showStatus('Gift sub threshold must be a positive number', 'error');
        return;
      }
      
      // Create config object
      const config = {
        channelName,
        twitchUsername,
        twitchOAuthToken,
        autoConnect,
        bitThreshold,
        giftSubThreshold
      };
      
      try {
        // Save config
        const result = await window.electronAPI.saveConfig(config);
        
        if (result.success) {
          showStatus('Settings saved successfully!', 'success');
          
          // Update channel name display
          channelNameDisplay.textContent = channelName;
        } else {
          showStatus(result.error || 'Failed to save settings', 'error');
        }
      } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Failed to save settings', 'error');
      }
    }
    
    // Show status message
    function showStatus(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = 'settings-status';
      
      if (type === 'success') {
        statusMessage.classList.add('success');
      } else if (type === 'error') {
        statusMessage.classList.add('error');
      }
      
      // Show status message
      statusMessage.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 5000);
    }
    
    // Save button handler
    saveButton.addEventListener('click', saveSettings);
    
    // Initialize
    loadSettings();
  });