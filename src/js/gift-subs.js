// Gift subs page script
document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const channelNameEl = document.getElementById('channel-name');
    const giftSubsTableBody = document.getElementById('gift-subs-table-body');
    const spinAlertEl = document.getElementById('spin-alert');
    const spinAlertMessageEl = document.getElementById('spin-alert-message');
    const giftThresholdEl = document.getElementById('gift-threshold');
    
    // Stats elements
    const totalGiftSubsEl = document.getElementById('total-gift-subs');
    const totalSpinsEl = document.getElementById('total-spins');
    const topGifterEl = document.getElementById('top-gifter');
    
    // Navigation buttons
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navDonationsBtn = document.getElementById('nav-donations');
    const navGiftSubsBtn = document.getElementById('nav-gift-subs');
    const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
    const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
    const navDataBtn = document.getElementById('nav-data');
    const navSettingsBtn = document.getElementById('nav-settings');
    
    // // Export button
    // const exportGiftSubsBtn = document.getElementById('export-gift-subs');
    
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
    
    // // Export handler
    // exportGiftSubsBtn.addEventListener('click', () => {
    //   exportCSV('gift_subs');
    // });
    
    // Format timestamp
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    }
    
    // Render a single gift sub row
    function renderGiftSubRow(giftSub) {
      const tr = document.createElement('tr');
      
      // Create a unique ID for the checkbox based on the timestamp
      const checkboxId = `spin-checkbox-${giftSub.timestamp.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Format recipients
      const recipientsText = giftSub.recipients && giftSub.recipients.length > 0
        ? giftSub.recipients.join(', ')
        : 'Anonymous recipients';
      
      tr.innerHTML = `
        <td>${formatTimestamp(giftSub.timestamp)}</td>
        <td>${escapeHtml(giftSub.username)}</td>
        <td>${giftSub.subCount}</td>
        <td>${escapeHtml(recipientsText)}</td>
        <td class="${giftSub.spinTriggered ? 'spin-triggered' : ''}">
          <input type="checkbox" id="${checkboxId}" class="spin-checkbox" 
                 data-timestamp="${giftSub.timestamp}" 
                 ${giftSub.spinTriggered ? 'checked' : ''}>
          <label for="${checkboxId}">Spin</label>
        </td>
      `;
      
      // Add event listener to the checkbox after the row is created
      setTimeout(() => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.addEventListener('change', function() {
            updateSpinStatus(giftSub.timestamp, this.checked);
          });
        }
      }, 0);
      
      return tr;
    }
    
    // Show spin alert
    function showSpinAlert(data) {
      // Update alert message
      spinAlertMessageEl.textContent = `${data.username} gifted ${data.subCount} subs! Time to SPIN!`;
      
      // Show alert
      spinAlertEl.style.display = 'block';
      
      // Hide after 10 seconds
      setTimeout(() => {
        spinAlertEl.style.display = 'none';
      }, 10000);
    }
    
    // Escape HTML
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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

    
    // Update gift sub stats
    function updateGiftSubStats(stats) {
      if (!stats) return;
      
      totalGiftSubsEl.textContent = stats.totalGiftSubs || 0;
      totalSpinsEl.textContent = stats.totalSpins || 0;
      
      if (stats.topGifter && stats.topGifter !== 'None') {
        topGifterEl.textContent = `${stats.topGifter} (${stats.topGifterSubs || 0} subs)`;
      } else {
        topGifterEl.textContent = 'None yet';
      }
    }
    
    // Update gift subs table
    function updateGiftSubsTable(giftSubs) {
      // Clear existing rows
      giftSubsTableBody.innerHTML = '';
      
      // Add new rows
      if (giftSubs && giftSubs.length > 0) {
        giftSubs.forEach(giftSub => {
          giftSubsTableBody.appendChild(renderGiftSubRow(giftSub));
        });
      } else {
        // Show empty state
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="5" style="text-align: center;">No gift subscriptions recorded yet</td>
        `;
        giftSubsTableBody.appendChild(tr);
      }
    }
    
    // // Export CSV
    // async function exportCSV(type) {
    //   try {
    //     const result = await window.electronAPI.exportCSV(type);
    //     if (result.success) {
    //       console.log(`Exported ${type} data successfully`);
    //     }
    //   } catch (error) {
    //     console.error(`Error exporting ${type} data:`, error);
    //   }
    // }
    
    // Update gift sub spin status
    async function updateSpinStatus(timestamp, spinTriggered) {
      try {
        const result = await window.electronAPI.updateGiftSubSpin({
          timestamp,
          spinTriggered
        });
        
        if (result.success) {
          console.log('Spin status updated successfully');
          
          // Update stats
          updateGiftSubStats(result.giftSubStats);
          
          // Update table
          updateGiftSubsTable(result.giftSubs);
          
          // Show spin alert if triggered
          if (spinTriggered) {
            const giftSub = result.giftSubs.find(g => g.timestamp === timestamp);
            if (giftSub) {
              showSpinAlert(giftSub);
            }
          }
        }
      } catch (error) {
        console.error('Error updating spin status:', error);
      }
    }
    
    // Initialize
    async function initialize() {
      try {
        // Get configuration
        const config = await window.electronAPI.getConfig();
        
        // Update channel name and threshold
        channelNameEl.textContent = config.channelName || 'Not set';
        giftThresholdEl.textContent = `${config.giftSubThreshold || 3}+ gift subs`;
        
        // Load gift sub data
        const giftSubData = await window.electronAPI.getGiftSubs();
        updateGiftSubStats(giftSubData.stats);
        updateGiftSubsTable(giftSubData.giftSubs);
      } catch (error) {
        console.error('Error initializing:', error);
      }
    }
    
    // Set up event listeners for real-time updates
    function setupEventListeners() {
      // New gift sub
      window.electronAPI.onNewGiftSub((giftSub) => {
        console.log('New gift sub:', giftSub);
        
        // Refresh data
        window.electronAPI.getGiftSubs()
          .then(data => {
            updateGiftSubStats(data.stats);
            updateGiftSubsTable(data.giftSubs);
          })
          .catch(error => console.error('Error updating gift sub data:', error));
      });
      
      // Spin alert
      window.electronAPI.onSpinAlert((data) => {
        console.log('Spin alert:', data);
        
        // Only show alert for gift subs, not bit donations
        if (data.isGiftSub) {
          showSpinAlert(data);
        }
      });
    }
    
    // Clean up event listeners when navigating away
    function cleanupEventListeners() {
      window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllListeners('new-gift-sub');
        window.electronAPI.removeAllListeners('spin-alert');
      });
    }
    
    // Initialize and set up
    initialize();
    setupEventListeners();
    cleanupEventListeners();
  });