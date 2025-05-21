// Fixed Twitch client with enhanced !spin command handling
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
    
    // Message events (to track !spin commands) - ENHANCED VERSION
    this.client.on('message', (channel, userstate, message, self) => {
      // Ignore messages from the bot itself
      if (self) return;
      
      const username = userstate.username || 'anonymous';
      const messageText = message.trim();
      
      console.log(`[CHAT] ${username}: ${messageText}`);
      
      // Check if message starts with !spin
      if (messageText.toLowerCase().startsWith('!spin')) {
        // Record the command usage
        this.dataManager.recordSpinCommand(username, messageText);
        
        // Check if this is a mod or broadcaster
        const isMod = userstate.mod || userstate.badges?.broadcaster === '1' || userstate.badges?.moderator === '1';
        const isBroadcaster = userstate.badges?.broadcaster === '1';
        
        console.log(`!spin command from ${username}, isMod: ${isMod}, isBroadcaster: ${isBroadcaster}`);
        console.log('User badges:', JSON.stringify(userstate.badges));
        console.log('User state:', JSON.stringify({
          mod: userstate.mod,
          'user-type': userstate['user-type'],
          subscriber: userstate.subscriber
        }));
        
        // If user is a mod or broadcaster, try to process the spin command
        if (isMod || isBroadcaster) {
          // Extract the target username from the message
          // Support formats: !spin @username, !spin username, !spin @Username
          const spinCommandMatch = messageText.match(/!spin\s+@?(\w+)/i);
          
          if (spinCommandMatch && spinCommandMatch[1]) {
            const targetUsername = spinCommandMatch[1].toLowerCase(); // Make case-insensitive
            console.log(`${username} (mod/broadcaster) used !spin command for target: ${targetUsername}`);
            
            // Process the command
            this.dataManager.processSpinCommand(username, targetUsername)
              .then(result => {
                console.log(`Spin command result:`, result);
                
                // Send feedback to chat (optional)
                if (result.success) {
                  //ncomment this to send chat feedback
                  // this.client.say(channel, `@${username} Marked spin for ${targetUsername}!`);
                } else {
                  console.log(`Failed to mark spin for ${targetUsername}: ${result.message}`);
                  // uncomment this to send error feedback
                  // this.client.say(channel, `@${username} Could not find recent donation from ${targetUsername}`);
                }
              })
              .catch(error => {
                console.error('Error processing spin command:', error);
              });
          } else {
            console.log(`Invalid !spin command format from ${username}: ${messageText}`);
            //uncomment this to send usage help
            // this.client.say(channel, `@${username} Usage: !spin @username`);
          }
        } else {
          console.log(`Non-mod ${username} used !spin command - ignoring processing`);
        }
      } else if (messageText.toLowerCase().startsWith('!setthreshold')) {
        // Additional command for mods to set thresholds
        const isMod = userstate.mod || userstate.badges?.broadcaster === '1' || userstate.badges?.moderator === '1';
        const isBroadcaster = userstate.badges?.broadcaster === '1';
        
        if (isMod || isBroadcaster) {
          // Try to parse threshold values
          const thresholdMatch = messageText.match(/!setthreshold\s+bits=(\d+)\s+subs=(\d+)/i);
          
          if (thresholdMatch && thresholdMatch[1] && thresholdMatch[2]) {
            const bitThreshold = parseInt(thresholdMatch[1]);
            const giftSubThreshold = parseInt(thresholdMatch[2]);
            
            // Update configuration
            this.dataManager.saveConfig({
              bitThreshold,
              giftSubThreshold
            })
              .then(result => {
                if (result.success) {
                  console.log(`Mod ${username} updated thresholds: bits=${bitThreshold}, subs=${giftSubThreshold}`);
                  //uncomment this to send confirmation
                  // this.client.say(channel, `@${username} Thresholds updated: ${bitThreshold} bits, ${giftSubThreshold} subs`);
                }
              })
              .catch(error => {
                console.error('Error updating thresholds via chat command:', error);
              });
          } else {
            console.log(`Invalid threshold format from ${username}: ${messageText}`);
            //uncomment this to send usage help
            // this.client.say(channel, `@${username} Usage: !setthreshold bits=1000 subs=3`);
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