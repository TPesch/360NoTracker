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
    // In the constructor, add this to the default configuration
    // In the constructor, update the default configuration
    this.config = {
      channelName: 'girl_dm_',
      bitThreshold: 1000,
      giftSubThreshold: 3,
      twitchUsername: '',
      twitchOAuthToken: '',
      autoConnect: false,
      enableSounds: true,
      notificationVolume: 50,
      spinSound: 'bell',
      bitSound: 'cash',
      giftSound: 'bell',
      commandSound: 'soft',
      theme: 'dark'
    };
    
    // Initialize data files
    this.initializeDataFiles();
    
    // Load configuration if exists
    this.loadConfig();
  }
  // Delete all tracked data
  deleteAllData() {
    return new Promise((resolve, reject) => {
      try {
        // Create empty files with just headers
        fs.writeFileSync(this.bitDonationsPath, 'Timestamp,Username,Bits,Message,SpinTriggered,SpinCompletedCount\n');
        fs.writeFileSync(this.giftSubsPath, 'Timestamp,Username,SubCount,RecipientUsernames,SpinTriggered,SpinCompletedCount\n');
        fs.writeFileSync(this.spinCommandsPath, 'Timestamp,Username,Command\n');
        
        console.log('All tracking data deleted');
        return resolve({ success: true, message: 'All tracking data has been deleted' });
      } catch (error) {
        console.error('Error deleting data:', error);
        return reject(error);
      }
    });
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
  
  // Import bit donations from CSV
  importBitDonations(csvData) {
    return new Promise((resolve, reject) => {
      try {
        // Parse CSV data
        const rows = csvData.trim().split('\n');
        const header = rows[0];
        
        // Check if header matches expected format
        if (!header.includes('Timestamp') || !header.includes('Username') || !header.includes('Bits')) {
          return reject(new Error('Invalid bit donations CSV format. Header must include Timestamp, Username, and Bits columns.'));
        }
        
        // Create a backup of the current file
        const backupPath = `${this.bitDonationsPath}.bak`;
        fs.copyFileSync(this.bitDonationsPath, backupPath);
        
        // Get existing data to avoid duplicates
        const existingData = fs.readFileSync(this.bitDonationsPath, 'utf8').trim().split('\n');
        const existingTimestamps = new Set();
        
        // Skip header and collect existing timestamps
        for (let i = 1; i < existingData.length; i++) {
          const row = existingData[i];
          if (row.trim()) {
            const timestamp = row.split(',')[0].trim();
            existingTimestamps.add(timestamp);
          }
        }
        
        // Filter out header and rows with timestamps that already exist
        const newRows = rows.filter((row, index) => {
          if (index === 0) return true; // Keep header
          
          const timestamp = row.split(',')[0].trim();
          return !existingTimestamps.has(timestamp);
        });
        
        if (newRows.length <= 1) {
          return resolve({
            success: true,
            message: 'No new donations to import. All entries already exist.',
            count: 0
          });
        }
        
        // Append new rows to the file (skip header when appending)
        const appendData = newRows.slice(1).join('\n') + '\n';
        fs.appendFileSync(this.bitDonationsPath, appendData);
        
        console.log(`Imported ${newRows.length - 1} new bit donations`);
        
        resolve({
          success: true,
          message: `Successfully imported ${newRows.length - 1} bit donations.`,
          count: newRows.length - 1
        });
      } catch (error) {
        console.error('Error importing bit donations:', error);
        reject(error);
      }
    });
  }

  // Import gift subs from CSV
  importGiftSubs(csvData) {
    return new Promise((resolve, reject) => {
      try {
        // Parse CSV data
        const rows = csvData.trim().split('\n');
        const header = rows[0];
        
        // Check if header matches expected format
        if (!header.includes('Timestamp') || !header.includes('Username') || !header.includes('SubCount')) {
          return reject(new Error('Invalid gift subs CSV format. Header must include Timestamp, Username, and SubCount columns.'));
        }
        
        // Create a backup of the current file
        const backupPath = `${this.giftSubsPath}.bak`;
        fs.copyFileSync(this.giftSubsPath, backupPath);
        
        // Get existing data to avoid duplicates
        const existingData = fs.readFileSync(this.giftSubsPath, 'utf8').trim().split('\n');
        const existingTimestamps = new Set();
        
        // Skip header and collect existing timestamps
        for (let i = 1; i < existingData.length; i++) {
          const row = existingData[i];
          if (row.trim()) {
            const timestamp = row.split(',')[0].trim();
            existingTimestamps.add(timestamp);
          }
        }
        
        // Filter out header and rows with timestamps that already exist
        const newRows = rows.filter((row, index) => {
          if (index === 0) return true; // Keep header
          
          const timestamp = row.split(',')[0].trim();
          return !existingTimestamps.has(timestamp);
        });
        
        if (newRows.length <= 1) {
          return resolve({
            success: true,
            message: 'No new gift subs to import. All entries already exist.',
            count: 0
          });
        }
        
        // Append new rows to the file (skip header when appending)
        const appendData = newRows.slice(1).join('\n') + '\n';
        fs.appendFileSync(this.giftSubsPath, appendData);
        
        console.log(`Imported ${newRows.length - 1} new gift subs`);
        
        resolve({
          success: true,
          message: `Successfully imported ${newRows.length - 1} gift subs.`,
          count: newRows.length - 1
        });
      } catch (error) {
        console.error('Error importing gift subs:', error);
        reject(error);
      }
    });
  }

  // Import spin commands from CSV
  importSpinCommands(csvData) {
    return new Promise((resolve, reject) => {
      try {
        // Parse CSV data
        const rows = csvData.trim().split('\n');
        const header = rows[0];
        
        // Check if header matches expected format
        if (!header.includes('Timestamp') || !header.includes('Username') || !header.includes('Command')) {
          return reject(new Error('Invalid spin commands CSV format. Header must include Timestamp, Username, and Command columns.'));
        }
        
        // Create a backup of the current file
        const backupPath = `${this.spinCommandsPath}.bak`;
        fs.copyFileSync(this.spinCommandsPath, backupPath);
        
        // Get existing data to avoid duplicates
        const existingData = fs.readFileSync(this.spinCommandsPath, 'utf8').trim().split('\n');
        const existingTimestamps = new Set();
        
        // Skip header and collect existing timestamps
        for (let i = 1; i < existingData.length; i++) {
          const row = existingData[i];
          if (row.trim()) {
            const timestamp = row.split(',')[0].trim();
            existingTimestamps.add(timestamp);
          }
        }
        
        // Filter out header and rows with timestamps that already exist
        const newRows = rows.filter((row, index) => {
          if (index === 0) return true; // Keep header
          
          const timestamp = row.split(',')[0].trim();
          return !existingTimestamps.has(timestamp);
        });
        
        if (newRows.length <= 1) {
          return resolve({
            success: true,
            message: 'No new spin commands to import. All entries already exist.',
            count: 0
          });
        }
        
        // Append new rows to the file (skip header when appending)
        const appendData = newRows.slice(1).join('\n') + '\n';
        fs.appendFileSync(this.spinCommandsPath, appendData);
        
        console.log(`Imported ${newRows.length - 1} new spin commands`);
        
        resolve({
          success: true,
          message: `Successfully imported ${newRows.length - 1} spin commands.`,
          count: newRows.length - 1
        });
      } catch (error) {
        console.error('Error importing spin commands:', error);
        reject(error);
      }
    });
  }

  // Export all data as ZIP
  exportAllData(outputPath) {
    return new Promise(async (resolve, reject) => {
      let output = null;
      
      try {
        // Check if archiver is installed
        let archiver;
        try {
          archiver = require('archiver');
        } catch (error) {
          console.error('Archiver package not installed:', error);
          return reject(new Error('The archiver package is not installed. Please run "npm install archiver --save" and restart the application.'));
        }
        
        // Create output directory if it doesn't exist
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Create output stream
        output = fs.createWriteStream(outputPath);
        
        // Add error handling for the output stream
        output.on('error', (err) => {
          console.error('Output stream error:', err);
          reject(err);
        });
        
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });
        
        // Listen for all archive data to be written
        output.on('close', () => {
          console.log(`Archive created: ${archive.pointer()} total bytes`);
          resolve({
            success: true,
            message: 'Data exported successfully as ZIP file.',
            path: outputPath
          });
        });
        
        // Add progress tracking
        archive.on('progress', (progress) => {
          const percentage = progress.entries.processed / progress.entries.total * 100;
          console.log(`Archive progress: ${Math.round(percentage)}%`);
          // You could emit an event to update UI here
        });
        
        // Listen for warnings during archiving
        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            console.warn('Archive warning:', err);
          } else {
            console.error('Archive error:', err);
            reject(err);
          }
        });
        
        // Listen for errors during archiving
        archive.on('error', (err) => {
          console.error('Archive error:', err);
          reject(err);
        });
        
        // Pipe archive data to the output file
        archive.pipe(output);
        
        // Check if data files exist before adding them
        if (fs.existsSync(this.bitDonationsPath)) {
          archive.file(this.bitDonationsPath, { name: 'bit_donations.csv' });
        } else {
          console.warn(`Bit donations file not found: ${this.bitDonationsPath}`);
          // Create empty file with header
          const header = 'Timestamp,Username,Bits,Message,SpinTriggered,SpinCompletedCount\n';
          archive.append(header, { name: 'bit_donations.csv' });
        }
        
        if (fs.existsSync(this.giftSubsPath)) {
          archive.file(this.giftSubsPath, { name: 'gift_subs.csv' });
        } else {
          console.warn(`Gift subs file not found: ${this.giftSubsPath}`);
          // Create empty file with header
          const header = 'Timestamp,Username,SubCount,RecipientUsernames,SpinTriggered,SpinCompletedCount\n';
          archive.append(header, { name: 'gift_subs.csv' });
        }
        
        if (fs.existsSync(this.spinCommandsPath)) {
          archive.file(this.spinCommandsPath, { name: 'spin_commands.csv' });
        } else {
          console.warn(`Spin commands file not found: ${this.spinCommandsPath}`);
          // Create empty file with header
          const header = 'Timestamp,Username,Command\n';
          archive.append(header, { name: 'spin_commands.csv' });
        }
        
        // Include metadata JSON
        const metadata = {
          exportDate: new Date().toISOString(),
          channelName: this.config.channelName,
          bitThreshold: this.config.bitThreshold,
          giftSubThreshold: this.config.giftSubThreshold,
          appVersion: '1.0.0' // You could get this from package.json
        };
        
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
        
        // Add a README file
        const readme = `# Twitch Donation Tracker Export

  This ZIP file contains exported data from the Twitch Donation Tracker app.

  ## Files Included:
  - bit_donations.csv: Records of bit donations
  - gift_subs.csv: Records of gift subscriptions
  - spin_commands.csv: Records of !spin commands
  - metadata.json: Export information

  Export Date: ${new Date().toLocaleString()}
  Channel: ${this.config.channelName || 'Not set'}

  To import this data, use the Import feature in the app's Settings page.
  `;
        
        archive.append(readme, { name: 'README.txt' });
        
        // Finalize the archive
        await archive.finalize();
        
      } catch (error) {
        console.error('Error exporting data as ZIP:', error);
        
        // Cleanup in case of failure - delete incomplete zip file
        if (output) {
          output.end(); // Ensure the stream is closed
        }
        
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath); // Delete incomplete zip file
            console.log('Cleaned up incomplete ZIP file');
          } catch (cleanupError) {
            console.warn('Failed to clean up incomplete ZIP file:', cleanupError);
          }
        }
        
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
  

}

module.exports = DataManager;