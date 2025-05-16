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
        
        // Refresh data
        window.electronAPI.getSpinCommands()
          .then(data => {
            updateCommandStats(data.stats);
            updateCommandsTable(data.commands);
          })
          .catch(error => console.error('Error updating spin command data:', error));
      });
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
  });np