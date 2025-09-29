const { spawn } = require('child_process');
const localtunnel = require('localtunnel');

// Configuration - LOCKED to specific domain
const CONFIG = {
    port: 3000,
    subdomain: 'azania',
    region: 'eu',
    restartDelay: 2500, //2.5 seconds
    allowedDomain: 'https://azania.loca.lt' // Only this domain is allowed
};

let attemptCount = 1;
let shouldRestart = true;

// Function to validate domain
const validateDomain = (url) => {
    if (!url) return false;
    return url === CONFIG.allowedDomain;
};

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
    
    const prefix = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : type === 'WARNING' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
};

// Function to start LocalTunnel with domain validation
const startTunnel = async () => {
    if (!shouldRestart) return;

    log(`[Attempt ${attemptCount}] Starting LocalTunnel...`);
    
    try {
        const tunnel = await localtunnel({
            port: CONFIG.port,
            subdomain: CONFIG.subdomain,
            region: CONFIG.region
        });

        // Validate the tunnel URL matches our allowed domain
        if (!validateDomain(tunnel.url)) {
            log(`SECURITY: Tunnel URL ${tunnel.url} does not match allowed domain ${CONFIG.allowedDomain}`, 'ERROR');
            log('Closing tunnel due to domain mismatch', 'ERROR');
            tunnel.close();
            
            if (shouldRestart) {
                setTimeout(() => {
                    attemptCount++;
                    startTunnel();
                }, CONFIG.restartDelay);
            }
            return;
        }

        log(`Tunnel started successfully: ${tunnel.url}`, 'SUCCESS');
        log(`Domain validation passed - using approved domain only`, 'SUCCESS');

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
            log('Subdomain "azania" not available - CANNOT continue as only this domain is allowed', 'ERROR');
            log('Will keep retrying for the required subdomain...', 'WARNING');
            // DO NOT remove subdomain as we must use the specific domain
        }

        // Restart after delay (only retry with the same subdomain)
        if (shouldRestart) {
            log(`Restarting in ${CONFIG.restartDelay / 1000} seconds...`);
            setTimeout(() => {
                attemptCount++;
                startTunnel();
            }, CONFIG.restartDelay);
        }
    }
};

// Function to prevent configuration tampering
const lockConfiguration = () => {
    // Freeze the CONFIG object to prevent modifications
    Object.freeze(CONFIG);
    
    // Additional validation
    if (CONFIG.subdomain !== 'azania') {
        log('SECURITY: Configuration has been tampered with - subdomain must be "azania"', 'ERROR');
        process.exit(1);
    }
    
    if (CONFIG.allowedDomain !== 'https://azania.loca.lt') {
        log('SECURITY: Configuration has been tampered with - only https://azania.loca.lt is allowed', 'ERROR');
        process.exit(1);
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

// Lock configuration and start the application
lockConfiguration();

console.log('🚀 LocalTunnel Auto-Restart Wrapper (Domain Restricted)');
console.log('=========================================================');
console.log(`Port: ${CONFIG.port}`);
console.log(`Subdomain: ${CONFIG.subdomain} (LOCKED)`);
console.log(`Region: ${CONFIG.region}`);
console.log(`Allowed Domain: ${CONFIG.allowedDomain} (ONLY)`);
console.log('=========================================================\n');

log('Security: Configuration locked to prevent domain changes', 'INFO');
startTunnel();