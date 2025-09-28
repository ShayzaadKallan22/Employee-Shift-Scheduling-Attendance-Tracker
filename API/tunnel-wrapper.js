const { spawn } = require('child_process');
const localtunnel = require('localtunnel');

// Configuration
const CONFIG = {
    port: 3000,
    subdomain: 'azania',
    region: 'eu',
    restartDelay: 1500 //1.5 seconds
};

let attemptCount = 1;
let shouldRestart = true;

// Function to log with timestamp
const log = (message, type = 'INFO') => {
    const timestamp = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const prefix = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
};

// Function to start LocalTunnel with proper error handling
const startTunnel = async () => {
    if (!shouldRestart) return;

    log(`[Attempt ${attemptCount}] Starting LocalTunnel...`);
    
    try {
        const tunnel = await localtunnel({
            port: CONFIG.port,
            subdomain: CONFIG.subdomain,
            region: CONFIG.region
        });

        log(`Tunnel started successfully: ${tunnel.url}`, 'SUCCESS');

        // Handle tunnel events
        tunnel.on('close', () => {
            log('Tunnel connection closed', 'ERROR');
            if (shouldRestart) {
                setTimeout(() => {
                    attemptCount++;
                    startTunnel();
                }, CONFIG.restartDelay);
            }
        });

        tunnel.on('error', (err) => {
            log(`Tunnel error: ${err.message}`, 'ERROR');
            tunnel.close();
        });

    } catch (error) {
        log(`Failed to start tunnel: ${error.message}`, 'ERROR');
        
        // Handle specific error cases
        if (error.message.includes('connection refused')) {
            log('Connection refused - this could be a firewall or network issue', 'ERROR');
        } else if (error.message.includes('not available')) {
            log('Subdomain not available - trying with random subdomain', 'ERROR');
            // Remove subdomain and try again
            CONFIG.subdomain = undefined;
        }

        // Restart after delay
        if (shouldRestart) {
            log(`Restarting in ${CONFIG.restartDelay / 1000} seconds...`);
            setTimeout(() => {
                attemptCount++;
                startTunnel();
            }, CONFIG.restartDelay);
        }
    }
};

// Graceful shutdown handling
const gracefulShutdown = () => {
    log('Shutting down gracefully...', 'INFO');
    shouldRestart = false;
    process.exit(0);
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);  // Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Kill signal
process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'ERROR');
    if (shouldRestart) {
        setTimeout(() => {
            attemptCount++;
            startTunnel();
        }, CONFIG.restartDelay);
    }
});

// Start the application
console.log('🚀 LocalTunnel Auto-Restart Wrapper');
console.log('====================================');
console.log(`Port: ${CONFIG.port}`);
console.log(`Subdomain: ${CONFIG.subdomain || 'random'}`);
console.log(`Region: ${CONFIG.region}`);
console.log('====================================\n');

startTunnel();