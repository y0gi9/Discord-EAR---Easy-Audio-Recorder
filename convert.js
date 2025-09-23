const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

function convertPcmToWav(pcmFile) {
    const outputFile = pcmFile.replace('.pcm', '.wav');
    
    console.log(`Converting ${pcmFile} to ${outputFile}...`);
    
    const ffmpegProcess = spawn(ffmpeg, [
        '-f', 's16le',           // Input format: signed 16-bit PCM
        '-ar', '48000',          // Sample rate: 48kHz
        '-ac', '1',              // Audio channels: mono
        '-i', pcmFile,           // Input file
        '-f', 'wav',             // Output format: WAV
        '-y',                    // Overwrite output file
        outputFile               // Output file
    ]);

    ffmpegProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Converted successfully: ${outputFile}`);
        } else {
            console.error(`Conversion failed with code ${code}`);
        }
    });

    ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg error:', error);
    });
}

// Convert all PCM files in recordings directory
const recordingsDir = './recordings';
if (fs.existsSync(recordingsDir)) {
    const files = fs.readdirSync(recordingsDir);
    const pcmFiles = files.filter(file => file.endsWith('.pcm'));
    
    console.log(`Found ${pcmFiles.length} PCM files to convert`);
    
    pcmFiles.forEach(file => {
        const fullPath = path.join(recordingsDir, file);
        convertPcmToWav(fullPath);
    });
} else {
    console.log('No recordings directory found');
}