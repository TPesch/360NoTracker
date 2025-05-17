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
    const notificationVolumeInput = document.getElementById('notification-volume');
    const volumeValueSpan = document.getElementById('volume-value');
    const spinSoundSelect = document.getElementById('spin-sound');
    const bitSoundSelect = document.getElementById('bit-sound');
    const giftSoundSelect = document.getElementById('gift-sound');
    const commandSoundSelect = document.getElementById('command-sound');
    const testButtons = document.querySelectorAll('.small-button[data-test]');
    const themeSelectEl = document.getElementById('theme-select');

    // Import/Export handlers
    const importButtons = document.querySelectorAll('.import-button');
    const exportAllCSVBtn = document.getElementById('export-all-csv');


    
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
    
    // Import button handlers
    importButtons.forEach(button => {
      button.addEventListener('click', async function() {
        const importType = this.getAttribute('data-import-type');
        let fileInput;
        let importFunction;
        
        // Determine which file input and import function to use
        switch (importType) {
          case 'bits':
            fileInput = document.getElementById('import-bits');
            importFunction = window.electronAPI.importBitDonations;
            break;
          case 'subs':
            fileInput = document.getElementById('import-subs');
            importFunction = window.electronAPI.importGiftSubs;
            break;
          case 'commands':
            fileInput = document.getElementById('import-commands');
            importFunction = window.electronAPI.importSpinCommands;
            break;
          default:
            showStatus('Invalid import type', 'error');
            return;
        }
        
        // Check if a file is selected
        if (!fileInput.files || fileInput.files.length === 0) {
          showStatus('Please select a file to import', 'error');
          return;
        }
        
        const file = fileInput.files[0];
        
        // Read the file
        try {
          const reader = new FileReader();
          
          reader.onload = async (e) => {
            const csvData = e.target.result;
            
            try {
              // Call the appropriate import function
              const result = await importFunction(csvData);
              
              // Show result
              if (result.success) {
                if (result.count > 0) {
                  showStatus(`Successfully imported ${result.count} items`, 'success');
                } else {
                  showStatus('No new data to import. All items already exist.', 'info');
                }
                
                // Clear the file input
                fileInput.value = '';
              } else {
                showStatus(result.message || 'Import failed', 'error');
              }
            } catch (error) {
              console.error('Error importing data:', error);
              showStatus(`Import failed: ${error.message}`, 'error');
            }
          };
          
          reader.onerror = () => {
            showStatus('Error reading file', 'error');
          };
          
          reader.readAsText(file);
        } catch (error) {
          console.error('Error reading file:', error);
          showStatus(`Error reading file: ${error.message}`, 'error');
        }
      });
    });

    // Export all CSV as ZIP
    if (exportAllCSVBtn) {
      exportAllCSVBtn.addEventListener('click', async () => {
        try {
          const result = await window.electronAPI.exportAllCSV();
          
          if (result.success) {
            showStatus('All data exported successfully as ZIP file', 'success');
          } else if (!result.canceled) {
            showStatus(result.message || 'Export failed', 'error');
          }
        } catch (error) {
          console.error('Error exporting data:', error);
          showStatus(`Export failed: ${error.message}`, 'error');
        }
      });
    }

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
        notificationVolumeInput.value = config.notificationVolume || 50;
        volumeValueSpan.textContent = `${notificationVolumeInput.value}%`;
        spinSoundSelect.value = config.spinSound || 'bell';
        bitSoundSelect.value = config.bitSound || 'cash';
        giftSoundSelect.value = config.giftSound || 'bell';
        commandSoundSelect.value = config.commandSound || 'soft';
        
         // Update theme
        themeSelectEl.value = config.theme || 'dark';    
        
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
      const notificationVolume = parseInt(notificationVolumeInput.value);
      const spinSound = spinSoundSelect.value;
      const bitSound = bitSoundSelect.value;
      const giftSound = giftSoundSelect.value;
      const commandSound = commandSoundSelect.value;

      // Get theme
      const theme = themeSelectEl.value;
      
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
        notificationVolume,
        spinSound,
        bitSound,
        giftSound,
        commandSound,
        theme
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

    // Add test sound button event listeners
    testButtons.forEach(button => {
      button.addEventListener('click', function() {
        const soundType = this.getAttribute('data-test');
        let soundOption;
        
        switch (soundType) {
          case 'spin':
            soundOption = spinSoundSelect.value;
            break;
          case 'bit':
            soundOption = bitSoundSelect.value;
            break;
          case 'gift':
            soundOption = giftSoundSelect.value;
            break;
          case 'command':
            soundOption = commandSoundSelect.value;
            break;
          default:
            soundOption = 'soft';
        }
        
        if (enableSoundsCheckbox.checked && soundOption !== 'none') {
          playSound(soundOption, parseInt(notificationVolumeInput.value) / 100);
        } else if (!enableSoundsCheckbox.checked) {
          showStatus('Sounds are disabled. Enable sounds to test.', 'error');
        } else {
          showStatus('No sound selected for this event.', 'info');
        }
      });
    });
    // Add theme select event listener
    themeSelectEl.addEventListener('change', function() {
      applyTheme(this.value);
    });
    
    // Function to apply theme
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    
    // Initialize theme on page load
    async function initTheme() {
      try {
        const config = await window.electronAPI.getConfig();
        applyTheme(config.theme || 'dark');
      } catch (error) {
        console.error('Error initializing theme:', error);
      }
    }
    

    // Function to play sound for different types of events
    function playSound(sound, volume) {
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
          return; // No sound selected
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

    // Initialize theme
    initTheme();
    
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