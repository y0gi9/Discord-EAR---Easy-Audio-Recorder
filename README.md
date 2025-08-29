# Discord EAR - Easy Audio Recorder

A lightweight Discord bot that automatically records a specific user's voice when they join voice channels. Perfect for capturing important conversations, meetings, or gaming sessions.

## Features

- 🎯 **Targeted Recording** - Monitors and records only a specific Discord user
- 🔄 **Auto-Follow** - Automatically joins voice channels when the target user joins
- 📁 **Smart Saving** - Saves recordings with timestamps for easy organization  
- 🎵 **High Quality** - Records in WAV format at 48kHz for crystal clear audio
- 🚀 **Zero Configuration** - Just set your bot token and target user ID

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

Edit `.env` file:
```env
BOT_TOKEN=your_discord_bot_token_here
TARGET_USER_ID=123456789012345678
```

To get a user ID, enable Developer Mode in Discord settings, then right-click a user and "Copy User ID".

## How It Works

The bot continuously monitors voice channel activity. When your target user:
- **Joins** a voice channel → Bot automatically joins and starts recording
- **Speaks** → Audio is captured and saved
- **Leaves** → Recording stops and file is saved
- **Switches channels** → Bot follows and continues recording

## Audio Output

- **Format**: WAV files at 48kHz mono
- **Location**: `./recordings/` directory
- **Naming**: `recording-YYYY-MM-DDTHH-mm-ss-sssZ.wav`
- **Quality**: Professional-grade audio suitable for analysis or archival

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