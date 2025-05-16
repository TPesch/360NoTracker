// Spin tracker page script
document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const channelNameEl = document.getElementById('channel-name');
    const spinTrackerTableBody = document.getElementById('spin-tracker-table-body');
    
    // Filter controls
    const showCompletedCheckbox = document.getElementById('show-completed');
    const showPendingCheckbox = document.getElementById('show-pending');
    const filterTypeSelect = document.getElementById('filter-type');
    const clearCompletedButton = document.getElementById('clear-completed');
    
    // Stats elements
    const totalSpinsEarnedEl = document.getElementById('total-spins-earned');
    const spinsCompletedEl = document.getElementById('spins-completed');
    const spinsPendingEl = document.getElementById('spins-pending');
    const usersPendingEl = document.getElementById('users-pending');
    
    // Navigation buttons
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navDonationsBtn = document.getElementById('nav-donations');
    const navGiftSubsBtn = document.getElementById('nav-gift-subs');
    const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
    const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
    const navSettingsBtn = document.getElementById('nav-settings');
    
    // Export button
    const exportSpinTrackerBtn = document.getElementById('export-spin-tracker');
    
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
    
    navSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
    
    // Filter event handlers
    showCompletedCheckbox.addEventListener('change', updateSpinTrackerDisplay);
    showPendingCheckbox.addEventListener('change', updateSpinTrackerDisplay);
    filterTypeSelect.addEventListener('change', updateSpinTrackerDisplay);
    
    // Clear completed button handler
    clearCompletedButton.addEventListener('click', clearCompletedSpins);
    
    // Export handler
    exportSpinTrackerBtn.addEventListener('click', () => {
      exportCSV('spin_tracker');
    });
    
    // Format timestamp
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    }
    
    // Generate spin icons based on count and status
    function generateSpinIcons(spinCount, completedCount) {
      let icons = '';
      
      for (let i = 0; i < spinCount; i++) {
        if (i < completedCount) {
          // Green check for completed spins
          icons += '<i class="fas fa-check-circle completed-spin" title="Completed"></i> ';
        } else {
          // Red circle for pending spins
          icons += '<i class="fas fa-circle pending-spin" title="Pending"></i> ';
        }
      }
      
      return icons;
    }
    
    // Render a single spin tracker row
    function renderSpinTrackerRow(item) {
      const tr = document.createElement('tr');
      
      // Format date
      const date = formatTimestamp(item.timestamp);
      
      // Calculate spins earned
      const spinsEarned = item.spinCount;
      
      // Render spin status icons
      const spinIcons = generateSpinIcons(spinsEarned, item.completedCount);
      
      // Type specific formatting
      let typeDisplay, amountDisplay;
      if (item.type === 'bits') {
        typeDisplay = '<span class="type-bits">Bit Donation</span>';
        amountDisplay = `${item.amount} bits`;
      } else {
        typeDisplay = '<span class="type-giftsub">Gift Subs</span>';
        amountDisplay = `${item.amount} subs`;
      }
      
      tr.innerHTML = `
        <td>${date}</td>
        <td>${escapeHtml(item.username)}</td>
        <td>${typeDisplay}</td>
        <td>${amountDisplay}</td>
        <td>${spinsEarned}</td>
        <td class="spin-status-icons">${spinIcons}</td>
        <td>
          <button class="btn-complete-spin" data-id="${item.id}" ${item.completedCount >= spinsEarned ? 'disabled' : ''}>
            <i class="fas fa-check"></i> Complete Spin
          </button>
          <button class="btn-reset-spins" data-id="${item.id}">
            <i class="fas fa-undo"></i> Reset
          </button>
        </td>
      `;
      
      return tr;
    }
    
    // Update spin tracker display based on filters
    function updateSpinTrackerDisplay() {
      const showCompleted = showCompletedCheckbox.checked;
      const showPending = showPendingCheckbox.checked;
      const filterType = filterTypeSelect.value;
      
      // Apply filters
      spinTrackerTableBody.querySelectorAll('tr').forEach(row => {
        // Skip if not a data row (e.g., loading message)
        if (!row.hasAttribute('data-id')) return;
        
        const dataId = row.getAttribute('data-id');
        const rowData = spinItems.find(item => item.id === dataId);
        
        if (!rowData) return;
        
        // Check completion status
        const hasCompletedSpins = rowData.completedCount > 0;
        const hasPendingSpins = rowData.completedCount < rowData.spinCount;
        
        // Check type filter
        const typeMatches = filterType === 'all' || 
                            (filterType === 'bits' && rowData.type === 'bits') ||
                            (filterType === 'giftsubs' && rowData.type === 'giftsubs');
        
        // Determine if row should be shown
        const shouldShow = typeMatches && 
                           ((showCompleted && hasCompletedSpins) || (showPending && hasPendingSpins));
        
        row.style.display = shouldShow ? '' : 'none';
      });
      
      // Update summary stats
      updateSpinSummary();
    }
    
    // Update spin summary statistics
    function updateSpinSummary() {
      // Calculate totals
      let totalSpinsEarned = 0;
      let spinsCompleted = 0;
      let spinsPending = 0;
      const usersPending = new Set();
      
      spinItems.forEach(item => {
        totalSpinsEarned += item.spinCount;
        spinsCompleted += item.completedCount;
        spinsPending += (item.spinCount - item.completedCount);
        
        if (item.completedCount < item.spinCount) {
          usersPending.add(item.username);
        }
      });
      
      // Update display
      totalSpinsEarnedEl.textContent = totalSpinsEarned;
      spinsCompletedEl.textContent = spinsCompleted;
      spinsPendingEl.textContent = spinsPending;
      usersPendingEl.textContent = usersPending.size;
    }
    
    // Mark a spin as completed
    async function completeSpin(id) {
      try {
        const result = await window.electronAPI.completeSpin(id);
        
        if (result.success) {
          console.log('Spin completed successfully');
          
          // Refresh data
          await loadSpinTrackerData();
        }
      } catch (error) {
        console.error('Error completing spin:', error);
      }
    }
    
    // Reset spins for an item
    async function resetSpins(id) {
      try {
        const result = await window.electronAPI.resetSpins(id);
        
        if (result.success) {
          console.log('Spins reset successfully');
          
          // Refresh data
          await loadSpinTrackerData();
        }
      } catch (error) {
        console.error('Error resetting spins:', error);
      }
    }
    
    // Clear all completed spins
    async function clearCompletedSpins() {
      if (!confirm('Are you sure you want to clear all completed spins?')) {
        return;
      }
      
      try {
        const result = await window.electronAPI.clearCompletedSpins();
        
        if (result.success) {
          console.log('Completed spins cleared successfully');
          
          // Refresh data
          await loadSpinTrackerData();
        }
      } catch (error) {
        console.error('Error clearing completed spins:', error);
      }
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
    
    // Global storage for spin tracker items
    let spinItems = [];
    
    // Load spin tracker data
    async function loadSpinTrackerData() {
      try {
        // Show loading message
        spinTrackerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading spin tracker data...</td></tr>';
        
        // Get spin tracker data
        const result = await window.electronAPI.getSpinTrackerData();
        
        // Store data globally
        spinItems = result.items || [];
        
        // Clear loading message
        spinTrackerTableBody.innerHTML = '';
        
        // Add data rows
        if (spinItems.length > 0) {
          spinItems.forEach(item => {
            const row = renderSpinTrackerRow(item);
            row.setAttribute('data-id', item.id);
            spinTrackerTableBody.appendChild(row);
          });
          
          // Add event listeners to buttons
          addButtonEventListeners();
        } else {
          // Show empty state
          spinTrackerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No spin tracker data available</td></tr>';
        }
        
        // Apply filters
        updateSpinTrackerDisplay();
        
        // Update summary
        updateSpinSummary();
      } catch (error) {
        console.error('Error loading spin tracker data:', error);
        spinTrackerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Error loading data</td></tr>';
      }
    }
    
    // Add event listeners to complete/reset buttons
    function addButtonEventListeners() {
      // Complete spin buttons
      document.querySelectorAll('.btn-complete-spin').forEach(button => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-id');
          completeSpin(id);
        });
      });
      
      // Reset spin buttons
      document.querySelectorAll('.btn-reset-spins').forEach(button => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-id');
          resetSpins(id);
        });
      });
    }
    
    // Initialize
    async function initialize() {
      try {
        // Get configuration
        const config = await window.electronAPI.getConfig();
        
        // Update channel name
        channelNameEl.textContent = config.channelName || 'Not set';
        
        // Load spin tracker data
        await loadSpinTrackerData();
      } catch (error) {
        console.error('Error initializing:', error);
      }
    }
    
    // Set up event listeners for real-time updates
    function setupEventListeners() {
      // New donation
      window.electronAPI.onNewDonation((donation) => {
        if (donation.spinTriggered) {
          loadSpinTrackerData();
        }
      });
      
      // New gift sub
      window.electronAPI.onNewGiftSub((giftSub) => {
        if (giftSub.spinTriggered) {
          loadSpinTrackerData();
        }
      });
      
      // Spin status update
      window.electronAPI.onSpinStatusUpdate(() => {
        loadSpinTrackerData();
      });
    }
    
    // Clean up event listeners when navigating away
    function cleanupEventListeners() {
      window.addEventListener('beforeunload', () => {
        window.electronAPI.removeAllListeners('new-donation');
        window.electronAPI.removeAllListeners('new-gift-sub');
        window.electronAPI.removeAllListeners('spin-status-update');
      });
    }
    
    // Initialize and set up
    initialize();
    setupEventListeners();
    cleanupEventListeners();
  });