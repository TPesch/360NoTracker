// Spin commands page script
document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const channelNameEl = document.getElementById('channel-name');
    const spinCommandsTableBody = document.getElementById('spin-commands-table-body');
    
    // Stats elements
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
    
    // Export button
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
    
    // Export handler
    exportSpinCommandsBtn.addEventListener('click', () => {
      exportCSV('spin_commands');
    });
    
    // Format timestamp
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    }
    
    // Render a single command row
    function renderCommandRow(command) {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${formatTimestamp(command.timestamp)}</td>
        <td>${escapeHtml(command.username)}</td>
        <td>${escapeHtml(command.command)}</td>
      `;
      
      return tr;
    }
    
    // Escape HTML
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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


    // Update command stats
    function updateCommandStats(stats) {
      if (!stats) return;
      
      totalCommandsEl.textContent = stats.totalCommands || 0;
      uniqueUsersEl.textContent = stats.uniqueUsers || 0;
    }
    
    // Update commands table
    function updateCommandsTable(commands) {
      // Clear existing rows
      spinCommandsTableBody.innerHTML = '';
      
      // Add new rows
      if (commands && commands.length > 0) {
        commands.forEach(command => {
          spinCommandsTableBody.appendChild(renderCommandRow(command));
        });
      } else {
        // Show empty state
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="3" style="text-align: center;">No !spin commands recorded yet</td>
        `;
        spinCommandsTableBody.appendChild(tr);
      }
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
    
    // Initialize
    async function initialize() {
      try {
        // Get configuration
        const config = await window.electronAPI.getConfig();
        
        // Update channel name
        channelNameEl.textContent = config.channelName || 'Not set';
        
        // Load spin command data
        const commandData = await window.electronAPI.getSpinCommands();
        updateCommandStats(commandData.stats);
        updateCommandsTable(commandData.commands);
      } catch (error) {
        console.error('Error initializing:', error);
      }
    }
    
    // Set up event listeners for real-time updates
    function setupEventListeners() {
      // New spin command
      window.electronAPI.onNewSpinCommand((command) => {
        console.log('New spin command:', command);
        
          // Play command sound
          playSound('command');

        // Refresh data
        window.electronAPI.getSpinCommands()
          .then(data => {
            updateCommandStats(data.stats);
            updateCommandsTable(data.commands);
          })
          .catch(error => console.error('Error updating spin command data:', error));
      });
    }
    
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

    // Clean up event listeners when navigating away
    function cleanupEventListeners() {
      window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllListeners('new-spin-command');
      });
    }
    
    // Initialize and set up
    initialize();
    setupEventListeners();
    cleanupEventListeners();
  });