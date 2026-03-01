const axios = require('axios');

async function testClaim() {
    const ports = [3000, 3001];
    let baseUrl = '';

    for (const port of ports) {
        try {
            await axios.get(`http://localhost:${port}/api/health`);
            baseUrl = `http://localhost:${port}/api`;
            console.log(`Server found at ${baseUrl}`);
            break;
        } catch (e) {
            // ignore
        }
    }

    if (!baseUrl) {
        console.error('Could not find running server on port 3000 or 3001');
        process.exit(1);
    }

    console.log('Testing Claim Endpoint existence...');
    try {
        // We expect 401 because we are not authenticated. 
        // This confirms the route exists (otherwise it would be 404).
        await axios.post(`${baseUrl}/currency/achievements/1/claim`);
    } catch (error) {
        if (error.response) {
            if (error.response.status === 401 || error.response.status === 403) {
                console.log('✅ SUCCESS: Route exists (returned 401/403 as expected for unauthenticated request).');
            } else if (error.response.status === 404) {
                console.error('❌ FAILURE: Route not found (404).');
            } else {
                console.log(`⚠️ Unexpected status ${error.response.status}, but route likely exists.`);
            }
        } else {
            console.error('Error hitting endpoint:', error.message);
        }
    }
}

testClaim();
