// Spin tracker page script with fixes and grouping
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
  
  // Filter event handlers
  showCompletedCheckbox.addEventListener('change', updateSpinTrackerDisplay);
  showPendingCheckbox.addEventListener('change', updateSpinTrackerDisplay);
  filterTypeSelect.addEventListener('change', updateSpinTrackerDisplay);
  
  // Clear completed button handler
  clearCompletedButton.addEventListener('click', clearCompletedSpins);
  
  // Format timestamp
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
  
  // Generate spin icons based on count and status - FIXED VERSION
  function generateSpinIcons(spinCount, completedCount) {
    let icons = '';
    
    // Ensure completedCount doesn't exceed spinCount
    const safeCompletedCount = Math.min(Math.max(0, completedCount), spinCount);
    
    console.log(`Generating icons: spinCount=${spinCount}, completedCount=${completedCount}, safeCompletedCount=${safeCompletedCount}`);
    
    for (let i = 0; i < spinCount; i++) {
      if (i < safeCompletedCount) {
        // Green check for completed spins
        icons += '<i class="fas fa-check-circle completed-spin" title="Completed"></i> ';
      } else {
        // Red circle for pending spins
        icons += '<i class="fas fa-circle pending-spin" title="Pending"></i> ';
      }
    }
    
    return icons;
  }
  
  // Generate donation details tooltip
  function generateDonationTooltip(item) {
    let tooltip = '';
    
    if (item.type === 'bits' && item.donations) {
      tooltip = `Total from ${item.donations.length} donation(s):\n`;
      item.donations.forEach(d => {
        tooltip += `• ${d.bits} bits on ${formatTimestamp(d.timestamp)}\n`;
      });
    } else if (item.type === 'giftsubs' && item.giftSubs) {
      tooltip = `Total from ${item.giftSubs.length} gift sub event(s):\n`;
      item.giftSubs.forEach(gs => {
        tooltip += `• ${gs.subCount} subs on ${formatTimestamp(gs.timestamp)}\n`;
      });
    }
    
    return tooltip;
  }
  
  // Render a single spin tracker row - FIXED VERSION
  function renderSpinTrackerRow(item) {
    const tr = document.createElement('tr');
    
    // Format date (use most recent timestamp)
    const date = formatTimestamp(item.timestamp);
    
    // Ensure we have valid numbers
    const spinsEarned = Math.max(0, parseInt(item.spinCount) || 0);
    const completedCount = Math.max(0, parseInt(item.completedCount) || 0);
    
    // Ensure completedCount doesn't exceed spinsEarned
    const safeCompletedCount = Math.min(completedCount, spinsEarned);
    
    console.log(`Rendering row for ${item.username}: spinsEarned=${spinsEarned}, completedCount=${completedCount}, safeCompletedCount=${safeCompletedCount}`);
    
    // Render spin status icons
    const spinIcons = generateSpinIcons(spinsEarned, safeCompletedCount);
    
    // Type specific formatting
    let typeDisplay, amountDisplay;
    if (item.type === 'bits') {
      typeDisplay = '<span class="type-bits">Bit Donations</span>';
      amountDisplay = `${item.amount} bits total`;
    } else {
      typeDisplay = '<span class="type-giftsub">Gift Subs</span>';
      amountDisplay = `${item.amount} subs total`;
    }
    
    // Generate tooltip for donation details
    const tooltip = generateDonationTooltip(item);
    
    tr.innerHTML = `
      <td>${date}</td>
      <td>${escapeHtml(item.username)}</td>
      <td>${typeDisplay}</td>
      <td title="${tooltip}">${amountDisplay}</td>
      <td>${spinsEarned}</td>
      <td class="spin-status-icons">${spinIcons}</td>
      <td>
        <button class="btn-complete-spin" data-id="${item.id}" ${safeCompletedCount >= spinsEarned ? 'disabled' : ''}>
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
  
  // FIXED updateSpinSummary function - prevents negative pending counts
  function updateSpinSummary() {
    // Calculate totals
    let totalSpinsEarned = 0;
    let spinsCompleted = 0;
    let spinsPending = 0;
    const usersPending = new Set();
    
    // Add debugging
    console.log('Updating spin summary with', spinItems.length, 'grouped items');
    
    spinItems.forEach((item, index) => {
      // Ensure all values are valid numbers
      const spinCount = Math.max(0, parseInt(item.spinCount) || 0);
      const completedCount = Math.min(spinCount, Math.max(0, parseInt(item.completedCount) || 0));
      
      // Debug logging for each item
      console.log(`Grouped item ${index}:`, {
        username: item.username,
        type: item.type,
        spinCount: spinCount,
        completedCount: completedCount,
        pending: spinCount - completedCount
      });
      
      totalSpinsEarned += spinCount;
      spinsCompleted += completedCount;
      
      const pendingForUser = Math.max(0, spinCount - completedCount);
      spinsPending += pendingForUser;
      
      // Only add to pending users if they actually have pending spins
      if (pendingForUser > 0) {
        usersPending.add(item.username.toLowerCase());
      }
    });
    
    // Debug final calculations
    console.log('Final grouped summary:', {
      totalSpinsEarned,
      spinsCompleted,
      spinsPending,
      usersPendingCount: usersPending.size
    });
    
    // Update display with validated values
    totalSpinsEarnedEl.textContent = Math.max(0, totalSpinsEarned);
    spinsCompletedEl.textContent = Math.max(0, spinsCompleted);
    spinsPendingEl.textContent = Math.max(0, spinsPending);
    usersPendingEl.textContent = Math.max(0, usersPending.size);
  }

  // Mark a spin as completed - UPDATED FOR GROUPED DATA
  async function completeSpin(id) {
    try {
      console.log('Completing grouped spin with ID:', id);
      
      // Call the API to complete the spin
      const result = await window.electronAPI.completeSpin(id);
      
      if (result.success) {
        console.log('Grouped spin completed successfully');
        
        // Reload the entire dataset to reflect all changes
        await loadSpinTrackerData();
      } else {
        console.error('Error from API when completing grouped spin:', result.error || 'Unknown error');
        alert('Failed to complete spin. Please try again.');
      }
    } catch (error) {
      console.error('Error completing grouped spin:', error);
      alert('An error occurred while completing the spin. Please try again.');
    }
  }
  
  // Reset spins for an item - UPDATED FOR GROUPED DATA
  async function resetSpins(id) {
    try {
      console.log('Resetting grouped spins with ID:', id);
      
      // Call the API to reset the spins
      const result = await window.electronAPI.resetSpins(id);
      
      if (result.success) {
        console.log('Grouped spins reset successfully');
        
        // Reload the entire dataset to reflect all changes
        await loadSpinTrackerData();
      } else {
        console.error('Error from API when resetting grouped spins:', result.error || 'Unknown error');
        alert('Failed to reset spins. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting grouped spins:', error);
      alert('An error occurred while resetting spins. Please try again.');
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

  // Escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Global storage for spin tracker items
  let spinItems = [];
  
  // Load spin tracker data - ENHANCED WITH VALIDATION
  async function loadSpinTrackerData() {
    try {
      // Show loading message
      spinTrackerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading grouped spin tracker data...</td></tr>';
      
      // Get spin tracker data (now grouped)
      const result = await window.electronAPI.getSpinTrackerData();
      console.log('Loaded grouped spin tracker data:', result);
      
      // Store data globally and validate each item
      spinItems = (result.items || []).map(item => ({
        ...item,
        spinCount: Math.max(0, parseInt(item.spinCount) || 0),
        completedCount: Math.min(
          Math.max(0, parseInt(item.spinCount) || 0),
          Math.max(0, parseInt(item.completedCount) || 0)
        )
      }));
      
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
      console.error('Error loading grouped spin tracker data:', error);
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