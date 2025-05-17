// Data visualization script
document.addEventListener('DOMContentLoaded', async function() {
  // Chart elements
  const cumulativeChartCanvas = document.getElementById('cumulative-chart-canvas');
  const dailyChartCanvas = document.getElementById('daily-chart-canvas');
  const topDonatorsChartCanvas = document.getElementById('top-donators-chart-canvas');
  const distributionChartCanvas = document.getElementById('distribution-chart-canvas');
  
  // Controls
  const timeRangeSelect = document.getElementById('time-range');
  const showBitsCheckbox = document.getElementById('show-bits');
  const showSubsCheckbox = document.getElementById('show-subs');
  const showCombinedCheckbox = document.getElementById('show-combined');
  
  // Navigation buttons
  const navDashboardBtn = document.getElementById('nav-dashboard');
  const navDonationsBtn = document.getElementById('nav-donations');
  const navGiftSubsBtn = document.getElementById('nav-gift-subs');
  const navSpinCommandsBtn = document.getElementById('nav-spin-commands');
  const navSpinTrackerBtn = document.getElementById('nav-spin-tracker');
  const navDataBtn = document.getElementById('nav-data');
  const navSettingsBtn = document.getElementById('nav-settings');
  
  // Channel name element
  const channelNameEl = document.getElementById('channel-name');
  
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
  
  // Chart instances
  let cumulativeChart, dailyChart, topDonatorsChart, distributionChart;
  
  // Data storage
  let bitDonations = [];
  let giftSubs = [];
  
  // Filter by time range
  function filterByTimeRange(data, days) {
    if (days === 'all') return data;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    return data.filter(item => new Date(item.timestamp) >= cutoffDate);
  }
  
  // Prepare cumulative chart data
  function prepareCumulativeData(bits, subs, range) {
    // Filter data by time range
    const filteredBits = filterByTimeRange(bits, range);
    const filteredSubs = filterByTimeRange(subs, range);
    
    // Sort by timestamp
    filteredBits.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    filteredSubs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Generate date labels (using all unique dates from both datasets)
    const allDates = new Set();
    filteredBits.forEach(donation => allDates.add(new Date(donation.timestamp).toLocaleDateString()));
    filteredSubs.forEach(sub => allDates.add(new Date(sub.timestamp).toLocaleDateString()));
    
    const dateLabels = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    // Prepare datasets
    const bitsData = { dates: [], values: [] };
    const subsData = { dates: [], values: [] };
    const combinedData = { dates: [], values: [] };
    
    let cumulativeBits = 0;
    let cumulativeSubs = 0;
    
    dateLabels.forEach(date => {
      // Add bits for this date
      const bitsForDate = filteredBits.filter(d => new Date(d.timestamp).toLocaleDateString() === date);
      const bitsSum = bitsForDate.reduce((sum, d) => sum + d.bits, 0);
      cumulativeBits += bitsSum;
      
      // Add subs for this date (convert to bits equivalent: 1 sub = 500 bits)
      const subsForDate = filteredSubs.filter(s => new Date(s.timestamp).toLocaleDateString() === date);
      const subsSum = subsForDate.reduce((sum, s) => sum + s.subCount, 0) * 500; // Convert to bits equivalent
      cumulativeSubs += subsSum;
      
      // Add to datasets
      bitsData.dates.push(date);
      bitsData.values.push(cumulativeBits);
      
      subsData.dates.push(date);
      subsData.values.push(cumulativeSubs);
      
      combinedData.dates.push(date);
      combinedData.values.push(cumulativeBits + cumulativeSubs);
    });
    
    return {
      labels: dateLabels,
      bitsData,
      subsData,
      combinedData
    };
  }
  
  // Prepare daily chart data
  function prepareDailyData(bits, subs, range) {
    // Filter data by time range
    const filteredBits = filterByTimeRange(bits, range);
    const filteredSubs = filterByTimeRange(subs, range);
    
    // Generate date labels (using all unique dates from both datasets)
    const allDates = new Set();
    filteredBits.forEach(donation => allDates.add(new Date(donation.timestamp).toLocaleDateString()));
    filteredSubs.forEach(sub => allDates.add(new Date(sub.timestamp).toLocaleDateString()));
    
    const dateLabels = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    // Prepare datasets
    const bitsData = [];
    const subsData = [];
    
    dateLabels.forEach(date => {
      // Sum bits for this date
      const bitsForDate = filteredBits.filter(d => new Date(d.timestamp).toLocaleDateString() === date);
      const bitsSum = bitsForDate.reduce((sum, d) => sum + d.bits, 0);
      
      // Sum subs for this date (convert to bits equivalent: 1 sub = 500 bits)
      const subsForDate = filteredSubs.filter(s => new Date(s.timestamp).toLocaleDateString() === date);
      const subsSum = subsForDate.reduce((sum, s) => sum + s.subCount, 0) * 500; // Convert to bits equivalent
      
      // Add to datasets
      bitsData.push(bitsSum);
      subsData.push(subsSum);
    });
    
    return {
      labels: dateLabels,
      bitsData,
      subsData
    };
  }
  
  // Prepare top donators chart data
  function prepareTopDonatorsData(bits, subs) {
    // Combine all donations by username
    const donatorMap = {};
    
    // Add bit donations
    bits.forEach(donation => {
      const username = donation.username;
      const bitsValue = donation.bits;
      
      if (donatorMap[username]) {
        donatorMap[username] += bitsValue;
      } else {
        donatorMap[username] = bitsValue;
      }
    });
    
    // Add gift subs (converted to bits equivalent)
    subs.forEach(sub => {
      const username = sub.username;
      const subsValue = sub.subCount * 500; // Convert to bits equivalent
      
      if (donatorMap[username]) {
        donatorMap[username] += subsValue;
      } else {
        donatorMap[username] = subsValue;
      }
    });
    
    // Sort donators by total value
    const sortedDonators = Object.entries(donatorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Get top 10
    
    return {
      labels: sortedDonators.map(d => d[0]),
      values: sortedDonators.map(d => d[1])
    };
  }
  
  // Prepare donation distribution chart data
  function prepareDistributionData(bits, subs) {
    // Define brackets
    const brackets = [
      { name: '1-100 bits', min: 1, max: 100, count: 0 },
      { name: '101-500 bits', min: 101, max: 500, count: 0 },
      { name: '501-1000 bits', min: 501, max: 1000, count: 0 },
      { name: '1001-5000 bits', min: 1001, max: 5000, count: 0 },
      { name: '5001+ bits', min: 5001, max: Infinity, count: 0 }
    ];
    
    // Count bit donations in each bracket
    bits.forEach(donation => {
      const value = donation.bits;
      for (const bracket of brackets) {
        if (value >= bracket.min && value <= bracket.max) {
          bracket.count++;
          break;
        }
      }
    });
    
    // Count gift subs in each bracket (converted to bits equivalent)
    subs.forEach(sub => {
      const value = sub.subCount * 500; // Convert to bits equivalent
      for (const bracket of brackets) {
        if (value >= bracket.min && value <= bracket.max) {
          bracket.count++;
          break;
        }
      }
    });
    
    return {
      labels: brackets.map(b => b.name),
      values: brackets.map(b => b.count)
    };
  }
  
  // Create cumulative chart
  function createCumulativeChart(data) {
    if (cumulativeChart) {
      cumulativeChart.destroy();
    }
    
    const datasets = [];
    
    if (showBitsCheckbox.checked) {
      datasets.push({
        label: 'Bits',
        data: data.bitsData.values,
        borderColor: 'rgba(145, 70, 255, 1)',
        backgroundColor: 'rgba(145, 70, 255, 0.2)',
        fill: true,
        tension: 0.4
      });
    }
    
    if (showSubsCheckbox.checked) {
      datasets.push({
        label: 'Gift Subs (bits equivalent)',
        data: data.subsData.values,
        borderColor: 'rgba(0, 177, 115, 1)',
        backgroundColor: 'rgba(0, 177, 115, 0.2)',
        fill: true,
        tension: 0.4
      });
    }
    
    if (showCombinedCheckbox.checked) {
      datasets.push({
        label: 'Combined',
        data: data.combinedData.values,
        borderColor: 'rgba(255, 179, 71, 1)',
        backgroundColor: 'rgba(255, 179, 71, 0.2)',
        fill: true,
        tension: 0.4
      });
    }
    
    cumulativeChart = new Chart(cumulativeChartCanvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255, 255, 255, 0.9)'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  // Create daily chart
  function createDailyChart(data) {
    if (dailyChart) {
      dailyChart.destroy();
    }
    
    dailyChart = new Chart(dailyChartCanvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Bits',
            data: data.bitsData,
            backgroundColor: 'rgba(145, 70, 255, 0.7)'
          },
          {
            label: 'Gift Subs (bits equivalent)',
            data: data.subsData,
            backgroundColor: 'rgba(0, 177, 115, 0.7)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          x: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255, 255, 255, 0.9)'
            }
          }
        }
      }
    });
  }
  
  // Create top donators chart
  function createTopDonatorsChart(data) {
    if (topDonatorsChart) {
      topDonatorsChart.destroy();
    }
    
    topDonatorsChart = new Chart(topDonatorsChartCanvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Total Contribution (bits)',
            data: data.values,
            backgroundColor: 'rgba(191, 148, 255, 0.7)',
            borderColor: 'rgba(191, 148, 255, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255, 255, 255, 0.9)'
            }
          }
        }
      }
    });
  }
  
  // Create distribution chart
  function createDistributionChart(data) {
    if (distributionChart) {
      distributionChart.destroy();
    }
    
    distributionChart = new Chart(distributionChartCanvas, {
      type: 'pie',
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            backgroundColor: [
              'rgba(145, 70, 255, 0.7)',
              'rgba(0, 177, 115, 0.7)',
              'rgba(255, 179, 71, 0.7)',
              'rgba(233, 25, 22, 0.7)',
              'rgba(36, 123, 255, 0.7)'
            ],
            borderColor: [
              'rgba(145, 70, 255, 1)',
              'rgba(0, 177, 115, 1)',
              'rgba(255, 179, 71, 1)',
              'rgba(233, 25, 22, 1)',
              'rgba(36, 123, 255, 1)'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: 'rgba(255, 255, 255, 0.9)'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  // Update all charts
  function updateCharts() {
    const timeRange = timeRangeSelect.value;
    
    // Prepare data
    const cumulativeData = prepareCumulativeData(bitDonations, giftSubs, timeRange);
    const dailyData = prepareDailyData(bitDonations, giftSubs, timeRange);
    const topDonatorsData = prepareTopDonatorsData(bitDonations, giftSubs);
    const distributionData = prepareDistributionData(bitDonations, giftSubs);
    
    // Create charts
    createCumulativeChart(cumulativeData);
    createDailyChart(dailyData);
    createTopDonatorsChart(topDonatorsData);
    createDistributionChart(distributionData);
  }
  
  // Load data
  async function loadData() {
    try {
      // Get configuration
      const config = await window.electronAPI.getConfig();
      
      // Update channel name
      channelNameEl.textContent = config.channelName || 'Not set';
      
      // Load bit donations
      const donationData = await window.electronAPI.getBitDonations();
      bitDonations = donationData.donations || [];
      
      // Load gift subs
      const giftSubData = await window.electronAPI.getGiftSubs();
      giftSubs = giftSubData.giftSubs || [];
      
      // Update charts
      updateCharts();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  // Set up controls
  timeRangeSelect.addEventListener('change', updateCharts);
  showBitsCheckbox.addEventListener('change', updateCharts);
  showSubsCheckbox.addEventListener('change', updateCharts);
  showCombinedCheckbox.addEventListener('change', updateCharts);
  
  // Initialize
  loadData();
  
  // Set up update interval
  setInterval(loadData, 60000); // Refresh data every minute
  
  // Clean up
  window.addEventListener('beforeunload', () => {
    if (cumulativeChart) cumulativeChart.destroy();
    if (dailyChart) dailyChart.destroy();
    if (topDonatorsChart) topDonatorsChart.destroy();
    if (distributionChart) distributionChart.destroy();
  });
});