require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const prism = require('prism-media');

class VoiceRecorder {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
            ]
        });

        // Configuration
        this.recordingMode = process.env.RECORDING_MODE || 'single_user';
        this.targetUserIds = this.parseUserIds(process.env.TARGET_USER_ID);
        this.allowedChannels = this.parseChannelIds(process.env.ALLOWED_CHANNELS);
        this.blockedChannels = this.parseChannelIds(process.env.BLOCKED_CHANNELS);
        this.autoConvert = process.env.AUTO_CONVERT !== 'false';
        this.audioFormat = process.env.AUDIO_FORMAT || 'mp3';
        this.maxRecordingMinutes = parseInt(process.env.MAX_RECORDING_MINUTES) || 60;
        this.silenceTimeout = parseInt(process.env.SILENCE_TIMEOUT) || 5000;
        this.createSeparateFiles = process.env.CREATE_SEPARATE_FILES !== 'false';
        this.logLevel = process.env.LOG_LEVEL || 'info';

        // State
        this.connection = null;
        this.activeRecordings = new Map();
        this.recordingPath = './recordings';
        this.currentChannel = null;

        // Create recordings directory if it doesn't exist
        if (!fs.existsSync(this.recordingPath)) {
            fs.mkdirSync(this.recordingPath, { recursive: true });
        }

        this.setupEventHandlers();
    }

    parseUserIds(userIdString) {
        if (!userIdString) return [];
        return userIdString.split(',').map(id => id.trim()).filter(id => id);
    }

    parseChannelIds(channelIdString) {
        if (!channelIdString) return [];
        return channelIdString.split(',').map(id => id.trim()).filter(id => id);
    }

    shouldRecordUser(userId) {
        if (this.recordingMode === 'all_users') return true;
        if (this.recordingMode === 'single_user') return this.targetUserIds.includes(userId);
        if (this.recordingMode === 'whitelist') return this.targetUserIds.includes(userId);
        return false;
    }

    shouldRecordChannel(channelId) {
        if (this.blockedChannels.includes(channelId)) return false;
        if (this.allowedChannels.length === 0) return true;
        return this.allowedChannels.includes(channelId);
    }

    async scanForTargetUser() {
        this.log('info', 'Scanning all voice channels for target user(s)...');
        
        try {
            const guilds = this.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                const channels = guild.channels.cache.filter(channel => channel.type === 2); // Voice channels
                
                for (const [channelId, channel] of channels) {
                    if (!this.shouldRecordChannel(channelId)) continue;
                    
                    const members = channel.members;
                    let foundTargetUser = false;
                    
                    for (const [memberId, member] of members) {
                        if (this.targetUserIds.includes(memberId)) {
                            this.log('info', `Found target user ${member.displayName} in channel: ${channel.name}`);
                            foundTargetUser = true;
                            await this.joinChannelAndRecord(channel);
                            return; // Stop after finding first target user
                        }
                    }
                }
            }
            
            this.log('info', 'No target users found in any voice channels');
        } catch (error) {
            this.log('error', `Error scanning for target user: ${error.message}`);
        }
    }

    log(level, message) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.logLevel] || 1;
        if (levels[level] >= currentLevel) {
            console.log(`[${level.toUpperCase()}] ${message}`);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', async () => {
            this.log('info', `Logged in as ${this.client.user.tag}!`);
            this.log('info', `Recording mode: ${this.recordingMode}`);
            if (this.recordingMode === 'single_user') {
                this.log('info', `Target user ID: ${this.targetUserIds[0]}`);
                await this.scanForTargetUser();
            } else if (this.recordingMode === 'whitelist') {
                this.log('info', `Whitelist users: ${this.targetUserIds.join(', ')}`);
                await this.scanForTargetUser();
            } else {
                this.log('info', 'Recording all users in voice channels');
            }
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.member.id;
        
        // Check if we should monitor this user
        const shouldMonitor = this.recordingMode === 'single_user' 
            ? this.targetUserIds.includes(userId)
            : true; // For all_users mode, monitor everyone

        if (!shouldMonitor && this.recordingMode === 'single_user') return;

        // User joined a voice channel
        if (!oldState.channel && newState.channel) {
            if (!this.shouldRecordChannel(newState.channel.id)) {
                this.log('debug', `Ignoring channel: ${newState.channel.name}`);
                return;
            }
            
            this.log('info', `User ${newState.member.displayName} joined: ${newState.channel.name}`);
            
            if (this.recordingMode === 'single_user' && this.targetUserIds.includes(userId)) {
                await this.joinChannelAndRecord(newState.channel);
            } else if (this.recordingMode === 'all_users' && !this.connection) {
                await this.joinChannelAndRecord(newState.channel);
            } else if (this.recordingMode === 'whitelist' && this.targetUserIds.includes(userId)) {
                await this.joinChannelAndRecord(newState.channel);
            }
        }
        
        // User left a voice channel
        if (oldState.channel && !newState.channel) {
            this.log('info', `User ${oldState.member.displayName} left voice channel`);
            
            if (this.recordingMode === 'single_user' && this.targetUserIds.includes(userId)) {
                await this.stopAllRecordings();
            } else if (this.recordingMode === 'all_users') {
                // Check if channel is now empty
                if (oldState.channel.members.filter(m => !m.user.bot).size === 0) {
                    await this.stopAllRecordings();
                }
            }
        }
        
        // User moved between channels
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            this.log('info', `User ${newState.member.displayName} moved to: ${newState.channel.name}`);
            
            if (this.shouldRecordChannel(newState.channel.id)) {
                if (this.recordingMode === 'single_user' && this.targetUserIds.includes(userId)) {
                    await this.stopAllRecordings();
                    await this.joinChannelAndRecord(newState.channel);
                }
            }
        }
    }

    async joinChannelAndRecord(channel) {
        try {
            if (this.connection) {
                await this.stopAllRecordings();
            }

            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
            });

            this.currentChannel = channel;
            this.log('info', `Joined voice channel: ${channel.name}`);

            // Start recording based on mode
            if (this.recordingMode === 'all_users') {
                this.startRecordingAllUsers();
            } else {
                this.startRecordingTargetUsers();
            }

        } catch (error) {
            this.log('error', `Error joining voice channel: ${error.message}`);
        }
    }

    startRecordingTargetUsers() {
        this.log('info', 'Starting targeted user recording');
        this.setupSpeakingListeners();
    }

    startRecordingAllUsers() {
        this.log('info', 'Starting recording for all users in channel');
        this.setupSpeakingListeners();
    }

    setupSpeakingListeners() {
        this.log('info', 'Setting up voice activity listeners');
        
        // Clear any existing listeners first
        this.connection.receiver.speaking.removeAllListeners();
        
        this.connection.receiver.speaking.on('start', (userId) => {
            if (this.shouldRecordUser(userId)) {
                this.log('debug', `User ${userId} started speaking`);
                this.startUserRecording(userId);
            }
        });

        this.connection.receiver.speaking.on('end', (userId) => {
            if (this.shouldRecordUser(userId)) {
                this.log('debug', `User ${userId} stopped speaking`);
                // Use a shorter timeout and clear any existing timeout
                if (this.activeRecordings.has(userId)) {
                    const recording = this.activeRecordings.get(userId);
                    if (recording.silenceTimer) {
                        clearTimeout(recording.silenceTimer);
                    }
                    recording.silenceTimer = setTimeout(() => {
                        this.stopUserRecording(userId);
                    }, 2000); // 2 second silence timeout
                }
            }
        });
    }

    async startUserRecording(userId) {
        if (this.activeRecordings.has(userId)) {
            this.log('debug', `User ${userId} already being recorded, refreshing timeout`);
            // Clear existing silence timer since they're speaking again
            const recording = this.activeRecordings.get(userId);
            if (recording.silenceTimer) {
                clearTimeout(recording.silenceTimer);
                recording.silenceTimer = null;
            }
            return;
        }

        const member = this.currentChannel.members.get(userId);
        const username = member ? member.displayName : userId;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${username}-${timestamp}.${this.audioFormat}`;
        const filepath = path.join(this.recordingPath, filename);
        
        this.log('info', `Started recording ${username}: ${filename}`);

        try {
            // Subscribe to the user's audio stream with manual control
            const opusStream = this.connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.Manual,
                },
            });

            // Create Opus decoder
            const opusDecoder = new prism.opus.Decoder({
                frameSize: 960,
                channels: 1,
                rate: 48000,
            });

            // Create FFmpeg process for MP3 with better compression
            const ffmpegArgs = [
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '1',
                '-i', 'pipe:0'
            ];

            // MP3 specific args for better quality and smaller size
            if (this.audioFormat === 'mp3') {
                ffmpegArgs.push(
                    '-codec:a', 'libmp3lame',
                    '-b:a', '128k',
                    '-ac', '1',
                    '-ar', '48000'
                );
            }

            ffmpegArgs.push('-y', filepath);

            if (this.maxRecordingMinutes > 0) {
                ffmpegArgs.splice(-2, 0, '-t', (this.maxRecordingMinutes * 60).toString());
            }

            const ffmpegProcess = spawn(ffmpeg, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let hasReceivedAudio = false;
            let audioDataSize = 0;

            // Monitor FFmpeg errors
            ffmpegProcess.stderr.on('data', (data) => {
                // Only log actual errors, not status updates
                const errorText = data.toString();
                if (errorText.includes('Error') || errorText.includes('error')) {
                    this.log('error', `FFmpeg error for ${username}: ${errorText}`);
                }
            });

            // Chain: Opus stream -> Opus decoder -> FFmpeg -> Audio file
            opusStream.pipe(opusDecoder);
            
            opusDecoder.on('data', (chunk) => {
                hasReceivedAudio = true;
                audioDataSize += chunk.length;
                ffmpegProcess.stdin.write(chunk);
            });

            opusStream.on('error', (error) => {
                this.log('error', `Opus stream error for ${username}: ${error.message}`);
                this.cleanupRecording(userId);
            });

            opusDecoder.on('error', (error) => {
                this.log('error', `Opus decoder error for ${username}: ${error.message}`);
                this.cleanupRecording(userId);
            });

            ffmpegProcess.on('close', (code) => {
                this.log('debug', `Recording finished for ${username} (code: ${code})`);
                
                // Check if we got meaningful audio data
                if (!hasReceivedAudio || audioDataSize < 1000) {
                    this.log('debug', `Removing empty recording: ${filepath}`);
                    try {
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                        }
                    } catch (err) {
                        this.log('error', `Failed to delete empty file: ${err.message}`);
                    }
                } else {
                    this.log('info', `Saved recording: ${filename} (${audioDataSize} bytes processed)`);
                }
                
                this.activeRecordings.delete(userId);
            });

            // Store the recording info
            this.activeRecordings.set(userId, {
                username,
                filepath,
                opusStream,
                opusDecoder,
                ffmpegProcess,
                startTime: Date.now(),
                silenceTimer: null,
                hasReceivedAudio: false,
                audioDataSize: 0
            });

        } catch (error) {
            this.log('error', `Failed to start recording for ${username}: ${error.message}`);
        }
    }

    stopUserRecording(userId) {
        const recording = this.activeRecordings.get(userId);
        if (!recording) return;

        // Check minimum recording duration (3 seconds)
        const recordingDuration = Date.now() - recording.startTime;
        if (recordingDuration < 3000) {
            this.log('debug', `Recording too short (${recordingDuration}ms), extending timeout`);
            // Reset the silence timer for a bit longer
            if (recording.silenceTimer) {
                clearTimeout(recording.silenceTimer);
            }
            recording.silenceTimer = setTimeout(() => {
                this.forceStopUserRecording(userId);
            }, 3000 - recordingDuration);
            return;
        }

        this.forceStopUserRecording(userId);
    }

    forceStopUserRecording(userId) {
        const recording = this.activeRecordings.get(userId);
        if (!recording) return;

        this.log('info', `Stopping recording for ${recording.username}`);
        
        try {
            // Clear any pending silence timer
            if (recording.silenceTimer) {
                clearTimeout(recording.silenceTimer);
            }

            // Properly close the streams
            if (recording.opusStream && !recording.opusStream.destroyed) {
                recording.opusStream.destroy();
            }
            
            if (recording.ffmpegProcess && recording.ffmpegProcess.stdin && !recording.ffmpegProcess.stdin.destroyed) {
                recording.ffmpegProcess.stdin.end();
            }
        } catch (error) {
            this.log('error', `Error stopping recording for ${recording.username}: ${error.message}`);
        }
    }

    cleanupRecording(userId) {
        const recording = this.activeRecordings.get(userId);
        if (!recording) return;

        this.log('debug', `Cleaning up recording for ${recording.username}`);
        
        try {
            if (recording.silenceTimer) {
                clearTimeout(recording.silenceTimer);
            }
            
            if (recording.opusStream && !recording.opusStream.destroyed) {
                recording.opusStream.destroy();
            }
            
            if (recording.ffmpegProcess) {
                recording.ffmpegProcess.kill('SIGTERM');
            }
            
            // Remove empty file if it exists
            if (fs.existsSync(recording.filepath)) {
                const stats = fs.statSync(recording.filepath);
                if (stats.size < 1000) {
                    fs.unlinkSync(recording.filepath);
                    this.log('debug', `Removed empty recording file: ${recording.filepath}`);
                }
            }
        } catch (error) {
            this.log('error', `Error cleaning up recording: ${error.message}`);
        }
        
        this.activeRecordings.delete(userId);
    }

    async stopAllRecordings() {
        this.log('info', 'Stopping all recordings');
        
        // Force stop all active recordings
        for (const [userId] of this.activeRecordings) {
            this.forceStopUserRecording(userId);
        }
        
        // Wait a moment for processes to clean up
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear any remaining recordings
        this.activeRecordings.clear();

        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
            this.currentChannel = null;
            this.log('info', 'Left voice channel');
        }
    }

    start() {
        if (!process.env.BOT_TOKEN) {
            this.log('error', 'BOT_TOKEN not found in environment variables');
            process.exit(1);
        }

        if ((this.recordingMode === 'single_user' || this.recordingMode === 'whitelist') && this.targetUserIds.length === 0) {
            this.log('error', 'TARGET_USER_ID required for single_user and whitelist modes');
            process.exit(1);
        }

        this.log('info', 'Starting Discord EAR bot...');
        this.client.login(process.env.BOT_TOKEN);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    process.exit(0);
});

// Start the bot
const recorder = new VoiceRecorder();
recorder.start();