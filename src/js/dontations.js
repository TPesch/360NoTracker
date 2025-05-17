// Donations page script
document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const channelNameEl = document.getElementById('channel-name');
    const donationTableBody = document.getElementById('donation-table-body');
    const spinAlertEl = document.getElementById('spin-alert');
    const spinAlertMessageEl = document.getElementById('spin-alert-message');
    
    // Stats elements
    const totalDonationsEl = document.getElementById('total-donations');
    const totalBitsEl = document.getElementById('total-bits');
    const totalSpinsEl = document.getElementById('total-spins');
    const topDonatorEl = document.getElementById('top-donator');
    
    // Navigation buttons
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navDonationsBtn = document.getElementById('nav-donations');
    const navGiftSubsBtn = document.getElementById('nav-gift-subs');
    const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
    const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
    const navDataBtn = document.getElementById('nav-data');
    const navSettingsBtn = document.getElementById('nav-settings');
    
    // Export button
    const exportDonationsBtn = document.getElementById('export-donations');
    
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
    exportDonationsBtn.addEventListener('click', () => {
      exportCSV('bit_donations');
    });
    
    // Format timestamp
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    }
    
    // Render a single donation row
    function renderDonationRow(donation) {
      const tr = document.createElement('tr');
      
      // Create a unique ID for the checkbox based on the timestamp
      const checkboxId = `spin-checkbox-${donation.timestamp.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      tr.innerHTML = `
        <td>${formatTimestamp(donation.timestamp)}</td>
        <td>${escapeHtml(donation.username)}</td>
        <td>${donation.bits}</td>
        <td>${escapeHtml(donation.message || '')}</td>
        <td class="${donation.spinTriggered ? 'spin-triggered' : ''}">
          <input type="checkbox" id="${checkboxId}" class="spin-checkbox" 
                 data-timestamp="${donation.timestamp}" 
                 ${donation.spinTriggered ? 'checked' : ''}>
          <label for="${checkboxId}">Spin</label>
        </td>
      `;
      
      // Add event listener to the checkbox after the row is created
      setTimeout(() => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.addEventListener('change', function() {
            updateSpinStatus(donation.timestamp, this.checked);
          });
        }
      }, 0);
      
      return tr;
    }
    
    // Show spin alert
    function showSpinAlert(data) {
      // Update alert message
      spinAlertMessageEl.textContent = `${data.username} donated ${data.bits} bits! Time to SPIN!`;
      
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
    
    // Update donations table
    function updateDonationsTable(donations) {
      // Clear existing rows
      donationTableBody.innerHTML = '';
      
      // Add new rows
      if (donations && donations.length > 0) {
        donations.forEach(donation => {
          donationTableBody.appendChild(renderDonationRow(donation));
        });
      } else {
        // Show empty state
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="5" style="text-align: center;">No donations recorded yet</td>
        `;
        donationTableBody.appendChild(tr);
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
    
    // Update donation spin status
    async function updateSpinStatus(timestamp, spinTriggered) {
      try {
        const result = await window.electronAPI.updateDonationSpin({
          timestamp,
          spinTriggered
        });
        
        if (result.success) {
          console.log('Spin status updated successfully');
          
          // Update stats
          updateDonationStats(result.stats);
          
          // Update table
          updateDonationsTable(result.donations);
          
          // Show spin alert if triggered
          if (spinTriggered) {
            const donation = result.donations.find(d => d.timestamp === timestamp);
            if (donation) {
              showSpinAlert(donation);
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
        
        // Update channel name
        channelNameEl.textContent = config.channelName || 'Not set';
        
        // Load donation data
        const donationData = await window.electronAPI.getBitDonations();
        updateDonationStats(donationData.stats);
        updateDonationsTable(donationData.donations);
      } catch (error) {
        console.error('Error initializing:', error);
      }
    }
    
    // Set up event listeners for real-time updates
    function setupEventListeners() {
      // New donation
      window.electronAPI.onNewDonation((donation) => {
        console.log('New donation:', donation);
        
        // Refresh data
        window.electronAPI.getBitDonations()
          .then(data => {
            updateDonationStats(data.stats);
            updateDonationsTable(data.donations);
          })
          .catch(error => console.error('Error updating donation data:', error));
      });
      
      // Spin alert
      window.electronAPI.onSpinAlert((data) => {
        console.log('Spin alert:', data);
        
        // Only show alert for bit donations, not gift subs
        if (!data.isGiftSub) {
          showSpinAlert(data);
        }
      });
    }
    
    // Clean up event listeners when navigating away
    function cleanupEventListeners() {
      window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllListeners('new-donation');
        window.electronAPI.removeAllListeners('spin-alert');
      });
    }
    
    // Initialize and set up
    initialize();
    setupEventListeners();
    cleanupEventListeners();
  });