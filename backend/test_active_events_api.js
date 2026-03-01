const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/events/active',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log('Response:', JSON.stringify(parsed, null, 2));

            if (parsed.success && parsed.data.length > 0) {
                console.log('✅ Success: Received active events.');
                const event = parsed.data[0];
                if (event.id === "33333333-3333-3333-3333-333333333333") {
                    console.log('✅ Verified: Century Park Event ID matches.');
                } else {
                    console.error('❌ Mismatch: Event ID does not match seed.');
                }
            } else {
                console.error('❌ Failed: No active events returned.');
            }
        } catch (e) {
            console.error('Error parsing response:', e);
            console.log('Raw data:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
