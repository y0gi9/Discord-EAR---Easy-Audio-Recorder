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

        this.targetUserId = process.env.TARGET_USER_ID;
        this.connection = null;
        this.recordingStream = null;
        this.ffmpegProcess = null;
        this.recordingPath = './recordings';

        // Create recordings directory if it doesn't exist
        if (!fs.existsSync(this.recordingPath)) {
            fs.mkdirSync(this.recordingPath, { recursive: true });
        }

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}!`);
            console.log(`Monitoring user ID: ${this.targetUserId}`);
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.member.id;
        
        if (userId !== this.targetUserId) return;

        // Target user joined a voice channel
        if (!oldState.channel && newState.channel) {
            console.log(`Target user joined voice channel: ${newState.channel.name}`);
            await this.joinChannelAndRecord(newState.channel);
        }
        
        // Target user left a voice channel
        if (oldState.channel && !newState.channel) {
            console.log('Target user left voice channel');
            await this.stopRecording();
        }
        
        // Target user moved to a different channel
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            console.log(`Target user moved to: ${newState.channel.name}`);
            await this.stopRecording();
            await this.joinChannelAndRecord(newState.channel);
        }
    }

    async joinChannelAndRecord(channel) {
        try {
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
            });

            console.log('Joined voice channel, starting recording...');

            // Start recording the target user's audio
            this.startRecording();

        } catch (error) {
            console.error('Error joining voice channel:', error);
        }
    }

    startRecording() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-${timestamp}.wav`;
        const filepath = path.join(this.recordingPath, filename);
        
        console.log(`Recording to: ${filepath}`);

        // Subscribe to the target user's audio stream
        const opusStream = this.connection.receiver.subscribe(this.targetUserId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 100,
            },
        });

        console.log('Subscribed to target user audio stream');

        // Create Opus decoder
        const opusDecoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: 1,
            rate: 48000,
        });

        // Create FFmpeg process to convert decoded PCM to WAV
        const ffmpegArgs = [
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-f', 'wav',
            '-y',
            filepath
        ];

        this.ffmpegProcess = spawn(ffmpeg, ffmpegArgs, {
            stdio: ['pipe', 'inherit', 'inherit']
        });

        // Chain: Opus stream -> Opus decoder -> FFmpeg -> WAV file
        opusStream
            .pipe(opusDecoder)
            .pipe(this.ffmpegProcess.stdin);

        opusStream.on('error', (error) => {
            console.error('Opus stream error:', error);
        });

        opusDecoder.on('error', (error) => {
            console.error('Opus decoder error:', error);
        });

        this.ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process closed with code ${code}`);
        });

        // Listen for speaking events for logging
        this.connection.receiver.speaking.on('start', (userId) => {
            if (userId === this.targetUserId) {
                console.log('Target user started speaking');
            }
        });

        this.connection.receiver.speaking.on('end', (userId) => {
            if (userId === this.targetUserId) {
                console.log('Target user stopped speaking');
            }
        });
    }

    async stopRecording() {
        if (this.ffmpegProcess) {
            this.ffmpegProcess.stdin.end();
            this.ffmpegProcess = null;
            console.log('Recording stopped and saved');
        }

        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
            console.log('Left voice channel');
        }
    }

    start() {
        if (!process.env.BOT_TOKEN) {
            console.error('BOT_TOKEN not found in environment variables');
            process.exit(1);
        }

        if (!process.env.TARGET_USER_ID) {
            console.error('TARGET_USER_ID not found in environment variables');
            process.exit(1);
        }

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