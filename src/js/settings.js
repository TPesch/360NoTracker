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
    const enableSoundsCheckbox = document.getElementById('enable-sounds');
    const notificationSoundSelect = document.getElementById('notification-sound');
    const notificationVolumeInput = document.getElementById('notification-volume');
    const volumeValueSpan = document.getElementById('volume-value');
    const testSoundButton = document.getElementById('test-sound');

    
    // Navigation buttons
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navDonationsBtn = document.getElementById('nav-donations');
    const navGiftSubsBtn = document.getElementById('nav-gift-subs');
    const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
    const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
    const navDataBtn = document.getElementById('nav-data');
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

    navSpinTrackerBtn.addEventListener('click', () => {
      window.location.href = 'spin-tracker.html';
    });

    navDataBtn.addEventListener('click', () => {
      window.location.href = 'data.html';
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
        
        // Set default values for sound settings
        enableSoundsCheckbox.checked = config.enableSounds !== false; 
        notificationSoundSelect.value = config.notificationSound || 'soft';
        notificationVolumeInput.value = config.notificationVolume || 50;
        volumeValueSpan.textContent = `${notificationVolumeInput.value}%`;
        
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

      // Get sound settings
      const enableSounds = enableSoundsCheckbox.checked;
      const notificationSound = notificationSoundSelect.value;
      const notificationVolume = parseInt(notificationVolumeInput.value);
      
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
        giftSubThreshold,
        enableSounds,
        notificationSound,
        notificationVolume
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
    
    // Add volume slider event listener
    notificationVolumeInput.addEventListener('input', function() {
      volumeValueSpan.textContent = `${this.value}%`;
    });

    // Add test sound button event listener
    testSoundButton.addEventListener('click', function() {
      // Play the selected sound
      const sound = notificationSoundSelect.value;
      const volume = parseInt(notificationVolumeInput.value) / 100;
      
      if (enableSoundsCheckbox.checked) {
        playNotificationSound(sound, volume);
      } else {
        showStatus('Sounds are disabled. Enable sounds to test.', 'error');
      }
    });

    // Function to play notification sound
    function playNotificationSound(sound, volume) {
      // Create audio element
      const audio = new Audio();
      
      // Set source based on selected sound
      switch (sound) {
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
        .catch(error => {
          console.error('Error playing sound:', error);
          showStatus('Failed to play sound', 'error');
        });
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
    // Delete all data button
    const deleteAllDataBtn = document.getElementById('delete-all-data');
    if (deleteAllDataBtn) {
      deleteAllDataBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.deleteAllData();
          
          // The main process will show the success/error dialogs
          // No need to update the UI here
        } catch (error) {
          console.error('Error deleting data:', error);
        }
      });
    }
  });