const fs = require('fs');
const os = require('os');
const path = require('path');

// Function to get local IP address (192.168.x.x)
function getLocalIP() {
    const interfaces = os.networkInterfaces();

    for (const interfaceName of Object.keys(interfaces)) {
        for (const iface of interfaces[interfaceName]) {
            // Skip over non-IPv4 and internal (loopback) addresses
            if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168')) {
                return iface.address;
            }
        }
    }
    return null; // No 192.168.x.x IP found
}

function changeIOSLocalIp(appDelegatePath) {
    // Get local IP
    const localIP = getLocalIP();

    if (!localIP) {
        console.error('No local IP address starting with 192.168.x.x found!');
        process.exit(1);
    }

    console.log(`Found local IP: ${localIP}`);

    // Read the AppDelegate.mm file
    fs.readFile(appDelegatePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading file: ${err.message}`);
            process.exit(1);
        }

        // Replace the IP address in the URL
        const oldUrlRegex = /\[NSURL URLWithString:@"http:\/\/192\.168\.[0-9]+\.[0-9]+:8081\/index\.bundle\?platform=ios"\]/;
        const newUrl = `[NSURL URLWithString:@"http://${localIP}:8081/index.bundle?platform=ios"]`;

        const updatedContent = data.replace(oldUrlRegex, newUrl);

        // Write the updated content back to the file
        fs.writeFile(appDelegatePath, updatedContent, 'utf8', (err) => {
            if (err) {
                console.error(`Error writing file: ${err.message}`);
                process.exit(1);
            }

            console.log(`Successfully updated AppDelegate.mm with IP: ${localIP}`);
        });
    });
}



module.exports = changeIOSLocalIp
