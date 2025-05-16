const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const csvParser = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const crypto = require('crypto');

class DataManager extends EventEmitter {
  constructor(dataPath) {
    super();
    
    this.dataPath = dataPath;
    this.configPath = path.join(dataPath, 'config.json');
    this.bitDonationsPath = path.join(dataPath, 'bit_donations.csv');
    this.giftSubsPath = path.join(dataPath, 'gift_subs.csv');
    this.spinCommandsPath = path.join(dataPath, 'spin_commands.csv');
    
    // Default configuration
    this.config = {
      channelName: 'girl_dm_',
      bitThreshold: 1000,
      giftSubThreshold: 3,
      twitchUsername: '',
      twitchOAuthToken: '',
      autoConnect: false
    };
    
    // Initialize data files
    this.initializeDataFiles();
    
    // Load configuration if exists
    this.loadConfig();
  }
  
  // Initialize data files if they don't exist
  initializeDataFiles() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    
    // Create config file if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.config);
    }
    
    // Create bit donations CSV if it doesn't exist
    if (!fs.existsSync(this.bitDonationsPath)) {
      fs.writeFileSync(this.bitDonationsPath, 'Timestamp,Username,Bits,Message,SpinTriggered\n');
    }
    
    // Create gift subs CSV if it doesn't exist
    if (!fs.existsSync(this.giftSubsPath)) {
      fs.writeFileSync(this.giftSubsPath, 'Timestamp,Username,SubCount,RecipientUsernames,SpinTriggered\n');
    }
    
    // Create spin commands CSV if it doesn't exist
    if (!fs.existsSync(this.spinCommandsPath)) {
      fs.writeFileSync(this.spinCommandsPath, 'Timestamp,Username,Command\n');
    }
  }
  
  // Load configuration
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge loaded config with defaults to ensure all fields exist
        this.config = {
          ...this.config,
          ...loadedConfig
        };
        
        console.log('Configuration loaded successfully');
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }
  
  // Save configuration
  saveConfig(config) {
    try {
      this.config = {
        ...this.config,
        ...config
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('Configuration saved successfully');
      return { success: true };
    } catch (error) {
      console.error('Error saving configuration:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Get current configuration
  getConfig() {
    return this.config;
  }
  
  // Record a bit donation
  recordBitDonation(username, bits, message, spinTriggered = null) {
    // Determine if spin is triggered if not explicitly set
    if (spinTriggered === null) {
      spinTriggered = bits >= this.config.bitThreshold;
    }
    
    const timestamp = new Date().toISOString();
    const escapedMessage = message.replace(/,/g, ';').replace(/"/g, '""');
    const newRow = `${timestamp},"${username}",${bits},"${escapedMessage}",${spinTriggered ? 'YES' : 'NO'}\n`;
    
    // Append to CSV file
    fs.appendFileSync(this.bitDonationsPath, newRow);
    console.log(`Recorded ${bits} bit donation from ${username}`);
    
    // Create donation object
    const donation = {
      timestamp,
      username,
      bits,
      message,
      spinTriggered
    };
    
    // Emit event for real-time updates
    this.emit('new-donation', donation);
    
    // Emit spin alert if threshold met
    if (spinTriggered) {
      this.emit('spin-alert', donation);
    }
    
    return donation;
  }
  
  // Record a gift sub
  recordGiftSub(username, subCount, recipients = [], spinTriggered = null) {
    // Determine if spin is triggered if not explicitly set
    if (spinTriggered === null) {
      spinTriggered = subCount >= this.config.giftSubThreshold;
    }
    
    const timestamp = new Date().toISOString();
    
    // Format recipients as comma-separated list
    const recipientsStr = recipients.length > 0 
      ? `"${recipients.join(', ')}"`
      : '""';
    
    const newRow = `${timestamp},"${username}",${subCount},${recipientsStr},${spinTriggered ? 'YES' : 'NO'}\n`;
    
    // Append to CSV file
    fs.appendFileSync(this.giftSubsPath, newRow);
    console.log(`Recorded ${subCount} gift subs from ${username}`);
    
    // Create gift sub object
    const giftSub = {
      timestamp,
      username,
      subCount,
      recipients,
      spinTriggered
    };
    
    // Emit event for real-time updates
    this.emit('new-gift-sub', giftSub);
    
    // Emit spin alert if threshold met
    if (spinTriggered) {
      this.emit('spin-alert', {
        timestamp,
        username,
        subCount,
        isGiftSub: true,
        spinTriggered
      });
    }
    
    return giftSub;
  }
  
  // Record a spin command
  recordSpinCommand(username, command) {
    const timestamp = new Date().toISOString();
    const escapedCommand = command.replace(/,/g, ';').replace(/"/g, '""');
    const newRow = `${timestamp},"${username}","${escapedCommand}"\n`;
    
    // Append to CSV file
    fs.appendFileSync(this.spinCommandsPath, newRow);
    console.log(`Recorded !spin command from ${username}: ${command}`);
    
    // Create command object
    const spinCommand = {
      timestamp,
      username,
      command
    };
    
    // Emit event for real-time updates
    this.emit('new-spin-command', spinCommand);
    
    return spinCommand;
  }
  
  getBitDonations() {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.bitDonationsPath)) {
          return resolve({ donations: [], stats: this.calculateDonationStats([]) });
        }
        
        // First, let's check if the CSV file has the SpinCompletedCount column
        const fileContent = fs.readFileSync(this.bitDonationsPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const header = lines[0];
        
        console.log('Bit donations CSV header:', header);
        
        // If the header doesn't include SpinCompletedCount, add it
        let updatedHeader = header;
        let updatedContent = false;
        if (!header.includes('SpinCompletedCount')) {
          console.log('Adding SpinCompletedCount column to header');
          updatedHeader = header + ',SpinCompletedCount';
          const updatedLines = [updatedHeader];
          
          // Add 0 as default value for all existing rows
          for (let i = 1; i < lines.length; i++) {
            updatedLines.push(lines[i] + ',0');
          }
          
          // Write back to file
          fs.writeFileSync(this.bitDonationsPath, updatedLines.join('\n'));
          console.log('Updated bit donations CSV with SpinCompletedCount column');
          updatedContent = true;
        }
        
        const donations = [];
        fs.createReadStream(this.bitDonationsPath)
          .pipe(csvParser())
          .on('data', (row) => {
            // Check if the CSV has the SpinCompletedCount column
            const spinCompletedCount = row.hasOwnProperty('SpinCompletedCount') 
              ? parseInt(row.SpinCompletedCount) || 0 
              : 0;
            
            // Log each row being processed to check for issues
            console.log('Processing donation row:', row);
            
            donations.push({
              timestamp: row.Timestamp,
              username: row.Username,
              bits: parseInt(row.Bits),
              message: row.Message || '',
              spinTriggered: row.SpinTriggered === 'YES',
              spinCompletedCount: spinCompletedCount
            });
          })
          .on('end', () => {
            console.log(`Loaded ${donations.length} bit donations`);
            // Log a sample donation if available
            if (donations.length > 0) {
              console.log('Sample donation:', JSON.stringify(donations[0]));
            }
            
            const stats = this.calculateDonationStats(donations);
            resolve({ donations, stats, updatedContent });
          })
          .on('error', (error) => {
            console.error('Error parsing bit donations CSV:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error in getBitDonations:', error);
        reject(error);
      }
    });
  }
  
  getGiftSubs() {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.giftSubsPath)) {
          return resolve({ giftSubs: [], stats: this.calculateGiftSubStats([]) });
        }
        
        // First, let's check if the CSV file has the SpinCompletedCount column
        const fileContent = fs.readFileSync(this.giftSubsPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const header = lines[0];
        
        console.log('Gift subs CSV header:', header);
        
        // If the header doesn't include SpinCompletedCount, add it
        let updatedHeader = header;
        let updatedContent = false;
        if (!header.includes('SpinCompletedCount')) {
          console.log('Adding SpinCompletedCount column to header');
          updatedHeader = header + ',SpinCompletedCount';
          const updatedLines = [updatedHeader];
          
          // Add 0 as default value for all existing rows
          for (let i = 1; i < lines.length; i++) {
            updatedLines.push(lines[i] + ',0');
          }
          
          // Write back to file
          fs.writeFileSync(this.giftSubsPath, updatedLines.join('\n'));
          console.log('Updated gift subs CSV with SpinCompletedCount column');
          updatedContent = true;
        }
        
        const giftSubs = [];
        fs.createReadStream(this.giftSubsPath)
          .pipe(csvParser())
          .on('data', (row) => {
            const recipients = row.RecipientUsernames 
              ? row.RecipientUsernames.split(', ').filter(r => r.trim() !== '') 
              : [];
            
            // Check if the CSV has the SpinCompletedCount column
            const spinCompletedCount = row.hasOwnProperty('SpinCompletedCount') 
              ? parseInt(row.SpinCompletedCount) || 0 
              : 0;
            
            // Log each row being processed
            console.log('Processing gift sub row:', row);
            
            giftSubs.push({
              timestamp: row.Timestamp,
              username: row.Username,
              subCount: parseInt(row.SubCount),
              recipients: recipients,
              spinTriggered: row.SpinTriggered === 'YES',
              spinCompletedCount: spinCompletedCount
            });
          })
          .on('end', () => {
            console.log(`Loaded ${giftSubs.length} gift subs`);
            // Log a sample gift sub if available
            if (giftSubs.length > 0) {
              console.log('Sample gift sub:', JSON.stringify(giftSubs[0]));
            }
            
            const stats = this.calculateGiftSubStats(giftSubs);
            resolve({ giftSubs, stats, updatedContent });
          })
          .on('error', (error) => {
            console.error('Error parsing gift subs CSV:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error in getGiftSubs:', error);
        reject(error);
      }
    });
  }
  
  
  // Get spin commands
  getSpinCommands() {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.spinCommandsPath)) {
          return resolve({ commands: [], stats: this.calculateSpinCommandStats([]) });
        }
        
        const commands = [];
        fs.createReadStream(this.spinCommandsPath)
          .pipe(csvParser())
          .on('data', (row) => {
            commands.push({
              timestamp: row.Timestamp,
              username: row.Username,
              command: row.Command
            });
          })
          .on('end', () => {
            const stats = this.calculateSpinCommandStats(commands);
            resolve({ commands, stats });
          })
          .on('error', (error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }
  // Get spin tracker data
  getSpinTrackerData() {
  return new Promise(async (resolve, reject) => {
    try {
      const spinTrackerItems = [];
      const bitThreshold = this.config.bitThreshold || 1000;
      const giftSubThreshold = this.config.giftSubThreshold || 3;
      
      // Get bit donations and calculate spins
      const bitData = await this.getBitDonations();
      const giftSubData = await this.getGiftSubs();
      
      // Process bit donations
      bitData.donations.forEach(donation => {
        if (donation.bits >= bitThreshold) {
          const spinCount = Math.floor(donation.bits / bitThreshold);
          
          // Get completed count from spin status (default to 0 if not defined)
          const completedCount = donation.spinCompletedCount || 0;
          
          spinTrackerItems.push({
            id: `bit_${donation.timestamp}`,
            timestamp: donation.timestamp,
            username: donation.username,
            type: 'bits',
            amount: donation.bits,
            spinCount,
            completedCount,
            message: donation.message
          });
        }
      });
      
      // Process gift subs
      giftSubData.giftSubs.forEach(giftSub => {
        if (giftSub.subCount >= giftSubThreshold) {
          const spinCount = Math.floor(giftSub.subCount / giftSubThreshold);
          
          // Get completed count from spin status (default to 0 if not defined)
          const completedCount = giftSub.spinCompletedCount || 0;
          
          spinTrackerItems.push({
            id: `giftsub_${giftSub.timestamp}`,
            timestamp: giftSub.timestamp,
            username: giftSub.username,
            type: 'giftsubs',
            amount: giftSub.subCount,
            spinCount,
            completedCount
          });
        }
      });
      
      // Sort by timestamp (newest first)
      spinTrackerItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      resolve({ items: spinTrackerItems });
    } catch (error) {
      reject(error);
    }
  });
  }
  // Complete a spin
  async completeSpin(id) {
    try {
      // Parse the ID to determine type
      const [type, timestamp] = id.split('_');
      
      if (type === 'bit') {
        // Get the bit donation and update completed count
        const result = await this.updateDonationSpinCompletion(timestamp, 1);
        
        if (result.success) {
          this.emit('spin-status-update', { type: 'bit', timestamp });
        }
        
        return result;
      } else if (type === 'giftsub') {
        // Get the gift sub and update completed count
        const result = await this.updateGiftSubSpinCompletion(timestamp, 1);
        
        if (result.success) {
          this.emit('spin-status-update', { type: 'giftsub', timestamp });
        }
        
        return result;
      }
      
      return { success: false, error: 'Invalid ID type' };
    } catch (error) {
      console.error('Error completing spin:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Calculate bit donation statistics
  calculateDonationStats(donations) {
    let totalBits = 0;
    let totalSpins = 0;
    const donatorMap = {};
    
    donations.forEach(donation => {
      const username = donation.username;
      const bits = donation.bits;
      
      totalBits += bits;
      if (donation.spinTriggered) totalSpins++;
      
      if (donatorMap[username]) {
        donatorMap[username] += bits;
      } else {
        donatorMap[username] = bits;
      }
    });
    
    // Find top donator
    let topDonator = 'None';
    let topDonatorBits = 0;
    
    Object.keys(donatorMap).forEach(username => {
      if (donatorMap[username] > topDonatorBits) {
        topDonatorBits = donatorMap[username];
        topDonator = username;
      }
    });
    
    return {
      totalDonations: donations.length,
      totalBits,
      totalSpins,
      topDonator,
      topDonatorBits
    };
  }
  
  // Calculate gift sub statistics
  calculateGiftSubStats(giftSubs) {
    let totalGiftSubs = 0;
    let totalSpins = 0;
    const gifterMap = {};
    
    giftSubs.forEach(giftSub => {
      const username = giftSub.username;
      const subCount = giftSub.subCount;
      
      totalGiftSubs += subCount;
      if (giftSub.spinTriggered) totalSpins++;
      
      if (gifterMap[username]) {
        gifterMap[username] += subCount;
      } else {
        gifterMap[username] = subCount;
      }
    });
    
    // Find top gifter
    let topGifter = 'None';
    let topGifterSubs = 0;
    
    Object.keys(gifterMap).forEach(username => {
      if (gifterMap[username] > topGifterSubs) {
        topGifterSubs = gifterMap[username];
        topGifter = username;
      }
    });
    
    return {
      totalGiftSubs,
      totalSpins,
      topGifter,
      topGifterSubs
    };
  }
  
  // Calculate spin command statistics
  calculateSpinCommandStats(commands) {
    const uniqueUsers = new Set();
    
    commands.forEach(command => {
      uniqueUsers.add(command.username);
    });
    
    return {
      totalCommands: commands.length,
      uniqueUsers: uniqueUsers.size
    };
  }
  
  // Update donation spin status
  updateDonationSpinStatus(timestamp, spinTriggered) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.bitDonationsPath)) {
          return reject(new Error('Bit donations file not found'));
        }
        
        const fileContent = fs.readFileSync(this.bitDonationsPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const header = lines[0];
        const dataLines = lines.slice(1);
        
        // Find and update the line with the matching timestamp
        let updated = false;
        let updatedDonation = null;
        
        const updatedLines = dataLines.map(line => {
          // Use regex to handle CSVs with quoted fields containing commas
          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const parts = line.split(regex);
          
          if (parts.length >= 5 && parts[0].trim() === timestamp.trim()) {
            parts[4] = spinTriggered ? 'YES' : 'NO';
            updated = true;
            
            // Create donation object for tracking
            updatedDonation = {
              timestamp: parts[0],
              username: parts[1].replace(/"/g, ''),
              bits: parseInt(parts[2]),
              message: parts[3].replace(/"/g, ''),
              spinTriggered
            };
            
            return parts.join(',');
          }
          return line;
        });
        
        if (!updated) {
          return reject(new Error('Donation not found'));
        }
        
        // Write back to file
        const updatedContent = [header, ...updatedLines].join('\n');
        fs.writeFileSync(this.bitDonationsPath, updatedContent);
        
        // If spin was triggered, emit spin alert
        if (spinTriggered && updatedDonation) {
          this.emit('spin-alert', updatedDonation);
        }
        
        // Get updated donations and stats
        this.getBitDonations()
          .then(data => resolve({
            success: true,
            message: 'Spin status updated successfully',
            ...data
          }))
          .catch(error => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Update gift sub spin status
  updateGiftSubSpinStatus(timestamp, spinTriggered) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.giftSubsPath)) {
          return reject(new Error('Gift subs file not found'));
        }
        
        const fileContent = fs.readFileSync(this.giftSubsPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const header = lines[0];
        const dataLines = lines.slice(1);
        
        // Find and update the line with the matching timestamp
        let updated = false;
        let updatedGiftSub = null;
        
        const updatedLines = dataLines.map(line => {
          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const parts = line.split(regex);
          
          if (parts.length >= 5 && parts[0].trim() === timestamp.trim()) {
            parts[4] = spinTriggered ? 'YES' : 'NO';
            updated = true;
            
            // Extract recipients
            const recipients = parts[3].replace(/"/g, '').split(', ').filter(r => r.trim() !== '');
            
            // Create gift sub object for tracking
            updatedGiftSub = {
              timestamp: parts[0],
              username: parts[1].replace(/"/g, ''),
              subCount: parseInt(parts[2]),
              recipients,
              spinTriggered
            };
            
            return parts.join(',');
          }
          return line;
        });
        
        if (!updated) {
          return reject(new Error('Gift sub not found'));
        }
        
        // Write back to file
        const updatedContent = [header, ...updatedLines].join('\n');
        fs.writeFileSync(this.giftSubsPath, updatedContent);
        
        // If spin was triggered, emit spin alert
        if (spinTriggered && updatedGiftSub) {
          this.emit('spin-alert', {
            ...updatedGiftSub,
            isGiftSub: true
          });
        }
        
        // Get updated gift subs and stats
        this.getGiftSubs()
          .then(data => resolve({
            success: true,
            message: 'Gift sub spin status updated successfully',
            ...data
          }))
          .catch(error => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Find recent donation by username
  findRecentDonationByUsername(targetUsername) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.bitDonationsPath)) {
          return resolve(null);
        }
        
        const donations = [];
        fs.createReadStream(this.bitDonationsPath)
          .pipe(csvParser())
          .on('data', (row) => {
            donations.push({
              timestamp: row.Timestamp,
              username: row.Username,
              bits: parseInt(row.Bits),
              message: row.Message,
              spinTriggered: row.SpinTriggered === 'YES'
            });
          })
          .on('end', () => {
            // Sort by timestamp (newest first)
            donations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Find donation by username (case insensitive)
            const donation = donations.find(d => 
              d.username.toLowerCase() === targetUsername.toLowerCase()
            );
            
            resolve(donation || null);
          })
          .on('error', (error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Find recent gift sub by username
  findRecentGiftSubByUsername(targetUsername) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.giftSubsPath)) {
          return resolve(null);
        }
        
        const giftSubs = [];
        fs.createReadStream(this.giftSubsPath)
          .pipe(csvParser())
          .on('data', (row) => {
            const recipients = row.RecipientUsernames 
              ? row.RecipientUsernames.split(', ').filter(r => r.trim() !== '') 
              : [];
            
            giftSubs.push({
              timestamp: row.Timestamp,
              username: row.Username,
              subCount: parseInt(row.SubCount),
              recipients,
              spinTriggered: row.SpinTriggered === 'YES'
            });
          })
          .on('end', () => {
            // Sort by timestamp (newest first)
            giftSubs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Find gift sub by username (case insensitive)
            const giftSub = giftSubs.find(g => 
              g.username.toLowerCase() === targetUsername.toLowerCase()
            );
            
            resolve(giftSub || null);
          })
          .on('error', (error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Process !spin command from a moderator
  async processSpinCommand(modUsername, targetUsername) {
    try {
      // First try to find a bit donation for this user
      const donation = await this.findRecentDonationByUsername(targetUsername);
      
      if (donation) {
        // Only update if it's not already marked as triggered
        if (!donation.spinTriggered) {
          await this.updateDonationSpinStatus(donation.timestamp, true);
          
          console.log(`Marked bit donation from ${targetUsername} for spin`);
          return {
            success: true,
            type: 'bit_donation',
            donation
          };
        } else {
          console.log(`Donation from ${targetUsername} was already marked for spin`);
        }
      }
      
      // If no bit donation, try to find a gift sub for this user
      const giftSub = await this.findRecentGiftSubByUsername(targetUsername);
      
      if (giftSub) {
        // Only update if it's not already marked as triggered
        if (!giftSub.spinTriggered) {
          await this.updateGiftSubSpinStatus(giftSub.timestamp, true);
          
          console.log(`Marked gift sub from ${targetUsername} for spin`);
          return {
            success: true,
            type: 'gift_sub',
            giftSub
          };
        } else {
          console.log(`Gift sub from ${targetUsername} was already marked for spin`);
        }
      }
      
      // No valid donation or gift sub found for the user
      console.log(`No recent donations or gift subs found for ${targetUsername}`);
      return {
        success: false,
        message: `No recent donations or gift subs found for ${targetUsername}`
      };
    } catch (error) {
      console.error('Error processing spin command:', error);
      return {
        success: false,
        message: `Error processing command: ${error.message}`
      };
    }
  }
  
  // Create a test donation (for development/testing)
  createTestDonation(data = {}) {
    const { username = 'TestUser', bits = 1000, message = 'Test donation', spinTriggered = null } = data;
    return this.recordBitDonation(username, bits, message, spinTriggered);
  }
  
  // Create a test gift sub (for development/testing)
  createTestGiftSub(data = {}) {
    const { username = 'TestUser', subCount = 3, recipients = [], spinTriggered = null } = data;
    return this.recordGiftSub(username, subCount, recipients, spinTriggered);
  }
  
  // Create a test spin command (for development/testing)
  createTestSpinCommand(data = {}) {
    const { username = 'TestMod', targetUsername = 'TestUser' } = data;
    const command = `!spin ${targetUsername}`;
    return this.recordSpinCommand(username, command);
  }
  
  // Reset spins for an item
  async resetSpins(id) {
    try {
      // Parse the ID to determine type
      const [type, timestamp] = id.split('_');
      
      if (type === 'bit') {
        // Reset completion count to 0
        const result = await this.updateDonationSpinCompletion(timestamp, 0, true);
        
        if (result.success) {
          this.emit('spin-status-update', { type: 'bit', timestamp });
        }
        
        return result;
      } else if (type === 'giftsub') {
        // Reset completion count to 0
        const result = await this.updateGiftSubSpinCompletion(timestamp, 0, true);
        
        if (result.success) {
          this.emit('spin-status-update', { type: 'giftsub', timestamp });
        }
        
        return result;
      }
      
      return { success: false, error: 'Invalid ID type' };
    } catch (error) {
      console.error('Error resetting spins:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Clear all completed spins
  async clearCompletedSpins() {
    try {
      // Get all bit donations and gift subs
      const bitData = await this.getBitDonations();
      const giftSubData = await this.getGiftSubs();
      
      // Process bit donations
      for (const donation of bitData.donations) {
        if (donation.spinCompletedCount && donation.spinCompletedCount > 0) {
          await this.updateDonationSpinCompletion(donation.timestamp, 0, true);
        }
      }
      
      // Process gift subs
      for (const giftSub of giftSubData.giftSubs) {
        if (giftSub.spinCompletedCount && giftSub.spinCompletedCount > 0) {
          await this.updateGiftSubSpinCompletion(giftSub.timestamp, 0, true);
        }
      }
      
      this.emit('spin-status-update', { type: 'all' });
      
      return { success: true };
    } catch (error) {
      console.error('Error clearing completed spins:', error);
      return { success: false, error: error.message };
    }
  }
  
 // Enhanced updateDonationSpinCompletion with better CSV handling
async updateDonationSpinCompletion(timestamp, incrementAmount, resetFlag = false) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Updating donation spin completion: timestamp=${timestamp}, increment=${incrementAmount}, reset=${resetFlag}`);
      
      if (!fs.existsSync(this.bitDonationsPath)) {
        return reject(new Error('Bit donations file not found'));
      }
      
      // Read the file content
      const fileContent = fs.readFileSync(this.bitDonationsPath, 'utf8');
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      
      // Check if the header includes SpinCompletedCount column
      let header = lines[0];
      console.log('Current bit donations CSV header:', header);
      
      if (!header.includes('SpinCompletedCount')) {
        // Add the column to the header
        header = header.trim() + ',SpinCompletedCount';
        lines[0] = header;
        console.log('Updated header with SpinCompletedCount:', header);
      }
      
      const dataLines = lines.slice(1);
      
      // Find and update the line with the matching timestamp
      let updated = false;
      let updatedDonation = null;
      
      const updatedLines = dataLines.map(line => {
        // Use regex to handle CSVs with quoted fields containing commas
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const parts = line.split(regex);
        
        console.log(`Checking line with parts:`, parts);
        
        if (parts.length >= 5 && parts[0].trim() === timestamp.trim()) {
          console.log(`Found matching donation line: ${line}`);
          updated = true;
          
          // Check if the line already has the SpinCompletedCount column
          let currentCompletedCount = 0;
          if (parts.length >= 6) {
            currentCompletedCount = parseInt(parts[5]) || 0;
          }
          console.log(`Current completed count: ${currentCompletedCount}`);
          
          // Calculate new completed count
          let newCompletedCount;
          if (resetFlag) {
            newCompletedCount = 0;
          } else {
            // Increment by the specified amount
            newCompletedCount = currentCompletedCount + incrementAmount;
            
            // Ensure it doesn't exceed the maximum possible spins
            const bits = parseInt(parts[2]);
            const bitThreshold = this.config.bitThreshold || 1000;
            const maxSpins = Math.floor(bits / bitThreshold);
            newCompletedCount = Math.min(newCompletedCount, maxSpins);
          }
          console.log(`New completed count: ${newCompletedCount}`);
          
          // Update or add the SpinCompletedCount column
          if (parts.length >= 6) {
            parts[5] = newCompletedCount.toString();
          } else {
            parts.push(newCompletedCount.toString());
          }
          
          // Create donation object for tracking
          updatedDonation = {
            timestamp: parts[0],
            username: parts[1].replace(/"/g, ''),
            bits: parseInt(parts[2]),
            message: parts[3].replace(/"/g, ''),
            spinTriggered: parts[4].trim() === 'YES',
            spinCompletedCount: newCompletedCount
          };
          
          const updatedLine = parts.join(',');
          console.log(`Updated line: ${updatedLine}`);
          return updatedLine;
        }
        return line;
      });
      
      if (!updated) {
        console.error(`Donation not found for timestamp: ${timestamp}`);
        return reject(new Error('Donation not found for timestamp: ' + timestamp));
      }
      
      // Write back to file
      const updatedContent = [header, ...updatedLines].join('\n');
      
      // Log part of the content for debugging
      console.log(`Updated content (first 200 chars): ${updatedContent.substring(0, 200)}...`);
      
      // Write the updated content
      fs.writeFileSync(this.bitDonationsPath, updatedContent);
      console.log('Wrote updated bit donations CSV file');
      
      // Verify the file was updated correctly
      const verifyContent = fs.readFileSync(this.bitDonationsPath, 'utf8');
      console.log(`Verification - file content (first 200 chars): ${verifyContent.substring(0, 200)}...`);
      
      // Get updated donations and stats
      this.getBitDonations()
        .then(data => {
          console.log('Retrieved updated bit donations data');
          resolve({
            success: true,
            message: 'Spin completion status updated successfully',
            ...data,
            updatedDonation
          });
        })
        .catch(error => {
          console.error('Error retrieving updated bit donations:', error);
          reject(error);
        });
    } catch (error) {
      console.error('Error updating donation spin completion:', error);
      reject(error);
    }
  });
}

// Enhanced updateGiftSubSpinCompletion with similar improvements
async updateGiftSubSpinCompletion(timestamp, incrementAmount, resetFlag = false) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Updating gift sub spin completion: timestamp=${timestamp}, increment=${incrementAmount}, reset=${resetFlag}`);
      
      if (!fs.existsSync(this.giftSubsPath)) {
        return reject(new Error('Gift subs file not found'));
      }
      
      // Read the file content
      const fileContent = fs.readFileSync(this.giftSubsPath, 'utf8');
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      
      // Check if the header includes SpinCompletedCount column
      let header = lines[0];
      console.log('Current gift sub CSV header:', header);
      
      if (!header.includes('SpinCompletedCount')) {
        // Add the column to the header
        header = header.trim() + ',SpinCompletedCount';
        lines[0] = header;
        console.log('Updated gift sub header with SpinCompletedCount:', header);
      }
      
      const dataLines = lines.slice(1);
      
      // Find and update the line with the matching timestamp
      let updated = false;
      let updatedGiftSub = null;
      
      const updatedLines = dataLines.map(line => {
        // Use regex to handle CSVs with quoted fields containing commas
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const parts = line.split(regex);
        
        console.log(`Checking gift sub line with parts:`, parts);
        
        if (parts.length >= 5 && parts[0].trim() === timestamp.trim()) {
          console.log(`Found matching gift sub line: ${line}`);
          updated = true;
          
          // Check if the line already has the SpinCompletedCount column
          let currentCompletedCount = 0;
          if (parts.length >= 6) {
            currentCompletedCount = parseInt(parts[5]) || 0;
          }
          console.log(`Current completed count: ${currentCompletedCount}`);
          
          // Calculate new completed count
          let newCompletedCount;
          if (resetFlag) {
            newCompletedCount = 0;
          } else {
            // Increment by the specified amount
            newCompletedCount = currentCompletedCount + incrementAmount;
            
            // Ensure it doesn't exceed the maximum possible spins
            const subCount = parseInt(parts[2]);
            const giftSubThreshold = this.config.giftSubThreshold || 3;
            const maxSpins = Math.floor(subCount / giftSubThreshold);
            newCompletedCount = Math.min(newCompletedCount, maxSpins);
          }
          console.log(`New completed count: ${newCompletedCount}`);
          
          // Update or add the SpinCompletedCount column
          if (parts.length >= 6) {
            parts[5] = newCompletedCount.toString();
          } else {
            parts.push(newCompletedCount.toString());
          }
          
          // Extract recipients
          const recipients = parts[3].replace(/"/g, '').split(', ').filter(r => r.trim() !== '');
          
          // Create gift sub object for tracking
          updatedGiftSub = {
            timestamp: parts[0],
            username: parts[1].replace(/"/g, ''),
            subCount: parseInt(parts[2]),
            recipients,
            spinTriggered: parts[4].trim() === 'YES',
            spinCompletedCount: newCompletedCount
          };
          
          const updatedLine = parts.join(',');
          console.log(`Updated line: ${updatedLine}`);
          return updatedLine;
        }
        return line;
      });
      
      if (!updated) {
        console.error(`Gift sub not found for timestamp: ${timestamp}`);
        return reject(new Error('Gift sub not found for timestamp: ' + timestamp));
      }
      
      // Write back to file
      const updatedContent = [header, ...updatedLines].join('\n');
      
      // Log part of the content for debugging
      console.log(`Updated gift sub content (first 200 chars): ${updatedContent.substring(0, 200)}...`);
      
      // Write the updated content
      fs.writeFileSync(this.giftSubsPath, updatedContent);
      console.log('Wrote updated gift subs CSV file');
      
      // Verify the file was updated correctly
      const verifyContent = fs.readFileSync(this.giftSubsPath, 'utf8');
      console.log(`Verification - gift sub file content (first 200 chars): ${verifyContent.substring(0, 200)}...`);
      
      // Get updated gift subs and stats
      this.getGiftSubs()
        .then(data => {
          console.log('Retrieved updated gift subs data');
          resolve({
            success: true,
            message: 'Gift sub spin completion status updated successfully',
            ...data,
            updatedGiftSub
          });
        })
        .catch(error => {
          console.error('Error retrieving updated gift subs:', error);
          reject(error);
        });
    } catch (error) {
      console.error('Error updating gift sub spin completion:', error);
      reject(error);
    }
  });
}
  // Export spin tracker as CSV
  async exportSpinTrackerCSV(outputPath) {
    try {
      // Get spin tracker data
      const { items } = await this.getSpinTrackerData();
      
      // Create CSV writer
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
          { id: 'date', title: 'Date' },
          { id: 'username', title: 'Username' },
          { id: 'type', title: 'Type' },
          { id: 'amount', title: 'Amount' },
          { id: 'spinsEarned', title: 'Spins Earned' },
          { id: 'completed', title: 'Spins Completed' },
          { id: 'pending', title: 'Spins Pending' }
        ]
      });
      
      // Format data for CSV
      const records = items.map(item => ({
        date: new Date(item.timestamp).toLocaleString(),
        username: item.username,
        type: item.type === 'bits' ? 'Bit Donation' : 'Gift Subs',
        amount: item.type === 'bits' ? `${item.amount} bits` : `${item.amount} subs`,
        spinsEarned: item.spinCount,
        completed: item.completedCount,
        pending: item.spinCount - item.completedCount
      }));
      
      // Write CSV
      await csvWriter.writeRecords(records);
      
      return { success: true };
    } catch (error) {
      console.error('Error exporting spin tracker CSV:', error);
      throw error;
    }
  }
  
  // Export CSV by type
  exportCSV(type, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        let sourcePath;
        
        switch (type.toLowerCase()) {
          case 'bits':
          case 'donations':
          case 'bit_donations':
            sourcePath = this.bitDonationsPath;
            break;
          case 'gift_subs':
          case 'giftsubs':
          case 'subs':
            sourcePath = this.giftSubsPath;
            break;
          case 'spin_commands':
          case 'spincommands':
          case 'commands':
            sourcePath = this.spinCommandsPath;
            break;
          default:
            return reject(new Error(`Unknown export type: ${type}`));
        }
        
        if (!fs.existsSync(sourcePath)) {
          return reject(new Error(`No data found for ${type}`));
        }
        
        // Copy the file to the output path
        fs.copyFileSync(sourcePath, outputPath);
        resolve({ success: true });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Export all data as ZIP
  exportAllData(outputPath) {
    return new Promise((resolve, reject) => {
      // Implementation would use a ZIP library (optional for now)
      reject(new Error('Export all data as ZIP not implemented yet'));
    });
  }
}

module.exports = DataManager;