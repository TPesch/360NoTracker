const tmi = require('tmi.js');

class TwitchClient {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.client = null;
    this.connected = false;
  }
  
  connect() {
    // Even if connected, force recreate the client
    if (this.client) {
      try {
        // Try to clean up existing client
        this.client.removeAllListeners();
        this.client = null;
      } catch (err) {
        console.error('Error cleaning up existing client:', err);
        // Continue anyway
      }
      this.connected = false;
    }
    
    // Mark as connecting
    console.log('Connecting to Twitch...');
    
    // Get configuration from data manager
    const config = this.dataManager.getConfig();
    
    // Check if we have channel name
    if (!config.channelName) {
      return Promise.reject(new Error('Channel name not specified in configuration'));
    }
    
    // Configure Twitch client with or without authentication
    const clientConfig = {
      options: { debug: false },
      connection: {
        secure: true,
        reconnect: true,
        timeout: 10000
      },
      channels: [config.channelName]
    };
    
    // Add authentication if provided
    if (config.twitchUsername && config.twitchOAuthToken) {
      clientConfig.identity = {
        username: config.twitchUsername,
        password: config.twitchOAuthToken
      };
    }
    
    // Create TMI.js client
    this.client = new tmi.Client(clientConfig);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up a connection timeout
    const connectionTimeout = new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection attempt timed out after 10 seconds'));
      }, 10000);
      
      // Store the timeout ID so we can clear it if connected successfully
      this.connectionTimeoutId = timeoutId;
    });
    
    // Connect with timeout
    return Promise.race([
      this.client.connect(),
      connectionTimeout
    ])
      .then(() => {
        // Clear the timeout if we connected successfully
        if (this.connectionTimeoutId) {
          clearTimeout(this.connectionTimeoutId);
          this.connectionTimeoutId = null;
        }
        
        this.connected = true;
        this.dataManager.emit('twitch-connection-status', { 
          connected: true, 
          channel: config.channelName,
          authenticated: !!clientConfig.identity
        });
        
        console.log(`Connected to Twitch channel: ${config.channelName}`);
        return { success: true, message: `Connected to ${config.channelName}'s channel` };
      })
      .catch(error => {
        // Clear the timeout if it exists
        if (this.connectionTimeoutId) {
          clearTimeout(this.connectionTimeoutId);
          this.connectionTimeoutId = null;
        }
        
        console.error('Error connecting to Twitch:', error);
        this.connected = false;
        
        // Clean up client if connection failed
        if (this.client) {
          try {
            this.client.removeAllListeners();
            this.client = null;
          } catch (err) {
            console.error('Error cleaning up client after failed connection:', err);
          }
        }
        
        this.dataManager.emit('twitch-connection-status', { connected: false, error: error.message });
        throw error;
      });
  }
// Disconnect from Twitch chat with better cleanup
disconnect() {
  if (!this.connected || !this.client) {
    return Promise.resolve({ success: true, message: 'Not connected to Twitch' });
  }
  
  // Create a copy of the client to avoid race conditions
  const clientToDisconnect = this.client;
  
  // Clear our references immediately
  this.client = null;
  this.connected = false;
  
  // Emit status update before actual disconnect to provide immediate UI feedback
  this.dataManager.emit('twitch-connection-status', { connected: false });
  
  return clientToDisconnect.disconnect()
    .then(() => {
      console.log('Disconnected from Twitch');
      return { success: true, message: 'Disconnected from Twitch' };
    })
    .catch(error => {
      console.error('Error disconnecting from Twitch:', error);
      throw error;
    })
    .finally(() => {
      // Clean up listeners to prevent memory leaks
      try {
        clientToDisconnect.removeAllListeners();
      } catch (err) {
        console.error('Error removing listeners during disconnect:', err);
      }
    });
}
  
  // Set up event handlers for Twitch events
  setupEventHandlers() {
    // Cheer events (bits donations)
    this.client.on('cheer', (channel, userstate, message) => {
      const username = userstate.username || 'anonymous';
      const bits = userstate.bits;
      
      console.log(`${username} cheered ${bits} bits!`);
      
      // Record bit donation
      this.dataManager.recordBitDonation(username, bits, message);
    });
    
    // Gift sub events
    this.client.on('submysterygift', (channel, username, subCount, methods, userstate) => {
      console.log(`${username} gifted ${subCount} subs!`);
      
      // Record gift sub
      this.dataManager.recordGiftSub(username, subCount);
    });
    
    // Individual gift sub events (to collect recipient names)
    this.client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
      console.log(`${username} gifted a sub to ${recipient}`);
      // We don't need to record this, as it's covered by submysterygift
      // But we could enhance the tracker to add recipient names
    });
    
    // Message events (to track !spin commands)
    this.client.on('message', (channel, userstate, message, self) => {
      // Ignore messages from the bot itself
      if (self) return;
      
      const username = userstate.username || 'anonymous';
      
      // Check if message starts with !spin
      if (message.trim().toLowerCase().startsWith('!spin')) {
        // Record the command usage
        this.dataManager.recordSpinCommand(username, message.trim());
        
        // Check if this is a mod or broadcaster
        const isMod = userstate.mod || userstate.badges?.broadcaster === '1';
        
        // If user is a mod, try to process the spin command
        if (isMod) {
          // Extract the target username from the message
          const match = message.match(/!spin\s+@?(\w+)/i);
          
          if (match && match[1]) {
            const targetUsername = match[1];
            console.log(`${username} used !spin command for ${targetUsername}`);
            
            // Process the command
            this.dataManager.processSpinCommand(username, targetUsername)
              .then(result => {
                console.log(`Spin command result:`, result);
              })
              .catch(error => {
                console.error('Error processing spin command:', error);
              });
          }
        }
      } else if (message.trim().toLowerCase().startsWith('!setthreshold')) {
        // Additional command for mods to set thresholds
        const isMod = userstate.mod || userstate.badges?.broadcaster === '1';
        
        if (isMod) {
          // Try to parse threshold values
          const match = message.match(/!setthreshold\s+bits=(\d+)\s+subs=(\d+)/i);
          
          if (match && match[1] && match[2]) {
            const bitThreshold = parseInt(match[1]);
            const giftSubThreshold = parseInt(match[2]);
            
            // Update configuration
            this.dataManager.saveConfig({
              bitThreshold,
              giftSubThreshold
            })
              .then(result => {
                if (result.success) {
                  console.log(`Mod ${username} updated thresholds: bits=${bitThreshold}, subs=${giftSubThreshold}`);
                }
              })
              .catch(error => {
                console.error('Error updating thresholds via chat command:', error);
              });
          } else {
            console.log(`Invalid threshold format from ${username}: ${message}`);
          }
        }
      }
    });
    
    // Handle connection errors
    this.client.on('disconnected', (reason) => {
      this.connected = false;
      console.error(`Disconnected from Twitch: ${reason}`);
      
      this.dataManager.emit('twitch-connection-status', { 
        connected: false, 
        error: reason
      });
      
      // Try to reconnect after a delay
      setTimeout(() => {
        if (!this.connected) {
          console.log('Attempting to reconnect to Twitch...');
          this.connect().catch(console.error);
        }
      }, 5000); // Try to reconnect after 5 seconds
    });
  }
}

module.exports = TwitchClient;