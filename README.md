# Discord EAR - Easy Audio Recorder

A lightweight Discord bot that automatically records a specific user's voice when they join voice channels. Perfect for capturing important conversations, meetings, or gaming sessions.

## Features

- 🎯 **Flexible Recording Modes** - Record single user, multiple users, or everyone in channel
- 🔄 **Auto-Follow** - Automatically joins voice channels when target users join
- 📁 **Smart Organization** - Separate files per user with timestamps and usernames
- 🎵 **Multiple Formats** - Output in WAV, MP3, or raw PCM format
- 🚫 **Channel Filtering** - Whitelist/blacklist specific channels 
- ⏱️ **Duration Limits** - Set maximum recording length per session
- 🔇 **Silence Detection** - Automatically stop recording after silence periods
- 🚀 **Easy Configuration** - Comprehensive .env settings for all options

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/y0gi9/Discord-EAR---Easy-Audio-Recorder.git
   cd Discord-EAR---Easy-Audio-Recorder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your bot**
   ```bash
   cp .env.example .env
   # Edit .env with your bot token and target user ID
   ```

4. **Start recording**
   ```bash
   npm start
   ```

## Setup Guide

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token to your `.env` file
4. Invite the bot to your server with these permissions:
   - View Channels
   - Connect
   - Use Voice Activity

### Configuration

Edit `.env` file with your preferred settings:

```env
# Required
BOT_TOKEN=your_discord_bot_token_here

# Recording Mode
RECORDING_MODE=single_user
# Options: single_user, all_users, whitelist

TARGET_USER_ID=123456789012345678
# For single_user: one user ID
# For whitelist: comma-separated IDs (123456789,987654321)

# Optional Filters
ALLOWED_CHANNELS=123456789012345678
# Only record in these channels (leave empty for all)
BLOCKED_CHANNELS=987654321098765432
# Never record in these channels

# Audio Settings  
AUDIO_FORMAT=wav
# Options: wav, mp3, pcm
MAX_RECORDING_MINUTES=60
# Max length per session (0 = unlimited)
SILENCE_TIMEOUT=5000
# Stop recording after this many ms of silence
```

To get user/channel IDs, enable Developer Mode in Discord settings, then right-click and "Copy ID".

## Recording Modes

### Single User Mode (`single_user`)
- Records only one specific user
- Bot joins when target user joins voice channels
- Perfect for monitoring specific individuals

### All Users Mode (`all_users`) 
- Records everyone in voice channels
- Creates separate files for each speaker
- Great for meeting recordings

### Whitelist Mode (`whitelist`)
- Records only users in your whitelist
- Specify multiple user IDs in TARGET_USER_ID
- Ideal for team/group monitoring

## Audio Output

- **Format**: WAV, MP3, or PCM based on your configuration
- **Location**: `./recordings/` directory  
- **Naming**: `{username}-YYYY-MM-DDTHH-mm-ss-sssZ.{format}`
- **Quality**: 48kHz mono, professional-grade audio
- **Organization**: Separate files per user and speaking session

## Commands

```bash
npm start          # Start the bot
npm run dev        # Start with auto-restart on file changes
npm run convert    # Convert any old PCM files to WAV format
```

## Technical Requirements

- Node.js 16.0.0 or higher
- FFmpeg (automatically included)
- Discord bot with voice permissions

## Project Structure

```
discord-ear/
├── index.js           # Main bot logic
├── convert.js         # Audio conversion utility
├── package.json       # Dependencies and scripts
├── .env              # Configuration (create from .env.example)
└── recordings/       # Audio files (auto-created)
```

## Legal Notice

This tool is intended for legitimate recording purposes only. Ensure you have proper consent from all parties before recording voice conversations. Users are responsible for complying with local laws regarding audio recording and privacy.

## License

MIT License - Feel free to use, modify, and distribute as needed.