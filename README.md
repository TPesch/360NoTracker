# Twitch Donation Tracker

![Cat](src/assets//spinning-cat.gif)

A desktop application that tracks Twitch bit donations and gift subscriptions, with a focus on managing "wheel spins" for streamers. Built by Fake_Boi for the moderators of girl_dm's stream.

![Twitch Donation Tracker Screenshot](src/assets/Screenshot%202025-05-21%20114208.png)

## Features

- **Real-time Tracking**: Connect to Twitch chat to automatically monitor bit donations and gift subscriptions
- **Spin Management**: Track which viewers are eligible for wheel spins based on configured thresholds
- **Moderator Tools**: Use `!spin @username` commands to mark spins as completed
- **Grouped Tracking**: Combines multiple donations from the same user for cleaner display
- **Data Visualization**: View donation trends and statistics over time
- **Export/Import**: Save and restore your donation data as needed
- **Customizable Settings**: Configure thresholds, notification sounds, and more

## How to use it?

### Download the Zip File and run TwitchDonationTracker.exe

## Dont trust my code? Clone the repository and try to have a look and build the application yourself!

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or newer)
- [npm](https://www.npmjs.com/) (included with Node.js)
- [Electron](https://www.electronjs.org/)

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/TPesch/360NoTracker.git
   cd twitch-donation-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the application:

   ```bash
   npm start
   ```

4. For development mode with DevTools:
   ```bash
   npm run dev
   ```

### Building for Distribution

To create a distributable package for Windows:

```bash
npm run build-win
```

For Linux:

```bash
npm run build-linux
```

The packaged applications will be available in the `dist` directory.

## Configuration

After starting the application for the first time, navigate to the Settings tab to configure:

1. **Channel Name**: The Twitch channel to track (default: girl*dm*)
2. **Thresholds**:
   - Bit donation threshold (default: 1000 bits)
   - Gift subscription threshold (default: 3 gift subs)
3. **Authentication** (optional & untested):
   - Twitch username and OAuth token for authenticated connections
   - Get your OAuth token from [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/)
4. **Notification Settings**:
   - Enable/disable sounds
   - Adjust volume
   - Choose sounds for different events

## How It Works

### Tracking Donations

The application connects to Twitch chat using the [tmi.js](https://github.com/tmijs/tmi.js) library. When a viewer donates bits or gift subscriptions, the app automatically records the donation and checks if it meets the threshold for a wheel spin.

### Spin Management

- When a viewer donates enough bits or gift subs, they become eligible for a wheel spin
- Moderators can mark spins as completed using the `!spin @username` command in Twitch chat
- The Spin Tracker page provides a visual overview of pending and completed spins

### Data Storage

All data is stored locally on your computer in CSV format:

- `bit_donations.csv` - Records of bit donations
- `gift_subs.csv` - Records of gift subscriptions
- `spin_commands.csv` - Records of !spin commands

## Moderator Commands (Meh kinda works can be better)

The following commands can be used in Twitch chat by moderators:

- `!spin @username` - Mark a spin as completed for the specified user
- `!setthreshold bits=X subs=Y` - Update the spin thresholds directly from chat

## Contact

For issues, feature requests, or questions, please contact:

- GitHub: [@TPesch](https://github.com/TPesch)
- Email: 14TPesch@gmail.com

## License

This project is licensed under the ISC License - see the LICENSE file for details.

---

_This application is not affiliated with Twitch or girl*dm*. It is a community-made tool for channel moderators._
