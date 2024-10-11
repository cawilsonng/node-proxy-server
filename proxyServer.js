const http = require('http');
const net = require('net');
const url = require('url');
const httpProxy = require('http-proxy');

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

function findFreePort(startPort, callback) {
    const server = net.createServer();

    server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => {
            callback(null, port);
        });
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && startPort < 65535) {
            findFreePort(startPort + 1, callback);  // Check the next port if in use
        } else {
            callback(err, null);
        }
    });
}

function createServer(port) {
    // Handle HTTP requests
    const server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url);
        console.log(`HTTP request for: ${parsedUrl.href}`);

        // Proxy the request to the target server
        proxy.web(req, res, { target: parsedUrl.href }, (err) => {
            if (err) {
                console.error('Error in proxying HTTP request:', err);
                res.writeHead(500);
                res.end('Error occurred in proxy.');
            }
        });
    });

    // Handle HTTPS (tunneling for HTTPS through CONNECT method)
    server.on('connect', (req, socket, head) => {
        const parsedUrl = url.parse(`http://${req.url}`);
        console.log(`HTTPS request for: ${req.url}`);

        // Create a connection to the target server
        const targetSocket = net.connect(parsedUrl.port || 443, parsedUrl.hostname, () => {
            socket.write('HTTP/1.1 200 Connection Established\r\n' +
                'Proxy-agent: Node.js-Proxy\r\n\r\n');
            targetSocket.write(head);
            targetSocket.pipe(socket);
            socket.pipe(targetSocket);
        });

        targetSocket.on('error', (err) => {
            console.error('Error in proxying HTTPS request:', err);
            socket.end('HTTP/1.1 500 Internal Server Error\r\n');
        });
    });

    server.on('clientError', (err, socket) => {
        console.error('Client error:', err.message);
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

// Example usage: Start searching from port 3000
findFreePort(3000, (err, freePort) => {
    if (err) {
        console.error('Error finding free port:', err);
    } else {
        console.log('Found free port:', freePort);
        createServer(freePort);  // Run server on the free port
    }
});