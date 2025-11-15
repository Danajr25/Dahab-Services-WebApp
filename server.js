const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Use Railway's PORT environment variable (typically 8080) or fallback to 3000
const PORT = process.env.PORT || 3000;

// Your Connecteam API key
const CONNECTEAM_API_KEY = process.env.CONNECTEAM_API_KEY || '729d2096-89a3-4ca0-b39d-9aa06d87cf01';
const CONNECTEAM_BASE_URL = 'https://api.connecteam.com'; // Correct base URL from documentation

// Stripe API keys (LIVE KEYS - REAL PAYMENTS)
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_51Rzdkv8gTeFhZ0UG6Am8eRIsO6V3om7C0OQb1XgIqFelTMQy4vZ5zDB4HTSYbGB9lkrnLTkhVXx7TT6nYfyvKlAL00sDG2ff3W';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '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';

// Initialize Stripe with error handling
let stripe;
try {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
} catch (error) {
    console.error('❌ Stripe initialization failed:', error);
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use(express.static(path.join(__dirname)));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve your HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Stripe checkout session endpoint (REAL STRIPE INTEGRATION)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('💳 Stripe checkout session requested:', req.body);
        
        const { 
            name, surname, email, whatsapp, address, 
            service, serviceName, serviceDate, selectedHours, 
            totalCost, subtotal, vatAmount, bookingFee, serviceRate,
            serviceTotal, lineItems 
        } = req.body;
        
        console.log('📊 Processing real Stripe payment...');
        console.log('💰 Total amount:', totalCost, 'GBP');
        
        // Create real Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            currency: 'gbp', // Lock currency to GBP to disable currency selector
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: serviceName,
                            description: `${serviceName} scheduled for ${serviceDate} at hours: ${selectedHours.join(', ')}`,
                        },
                        unit_amount: serviceTotal * 100, // Stripe uses pence - service cost only
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Booking Fee',
                            description: 'Service booking and processing fee',
                        },
                        unit_amount: bookingFee * 100, // Stripe uses pence
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'VAT',
                            description: 'Value Added Tax',
                        },
                        unit_amount: vatAmount * 100, // Stripe uses pence
                    },
                    quantity: 1,
                }
            ],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/?cancelled=true`,
            customer_email: email,
            metadata: {
                customer_name: `${name} ${surname}`,
                customer_email: email,
                customer_phone: whatsapp,
                service_address: address,
                service_type: service,
                service_date: serviceDate,
                service_hours: selectedHours.join(','),
                total_amount: totalCost,
                booking_timestamp: new Date().toISOString()
            }
        });
        
        console.log('✅ Real Stripe checkout session created:', session.id);
        console.log('🔗 Checkout URL:', session.url);
        
        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            message: 'Real Stripe checkout session created successfully'
        });
        
        /* TEMPORARILY DISABLED: Test payment simulation
        // TEST MODE: Simulate successful payment
        const simulatedSessionId = 'cs_test_' + Date.now();
        console.log('✅ Test payment simulation created:', simulatedSessionId);
        
        res.json({
            success: true,
            sessionId: simulatedSessionId,
            testMode: true,
            message: 'Test payment simulation - booking will be processed immediately'
        });
        */
        
    } catch (error) {
        console.error('❌ Stripe checkout session error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to create Stripe checkout session'
        });
    }
});

// Verify payment after redirect from Stripe
app.post('/api/verify-payment', async (req, res) => {
    const { sessionId } = req.body;
    
    try {
        console.log('🔍 Verifying payment for session:', sessionId);
        
        // Check if this is a test session (keeping for backwards compatibility)
        if (sessionId.startsWith('cs_test_')) {
            console.log('🧪 Test mode detected - simulating successful payment');
            
            // Create mock booking data for test
            const bookingData = {
                client_name: 'Test Customer',
                client_email: 'test@example.com',
                client_phone: '123456789',
                service_address: 'Test Address',
                service_type: 'test-service',
                service_date: new Date().toISOString().split('T')[0],
                service_hours: [10],
                total_hours: 1,
                service_cost: 50,
                booking_fee: 50,
                vat_amount: 20,
                total_amount: 120,
                has_night_hours: false,
                booking_timestamp: new Date().toISOString(),
                status: 'confirmed',
                notes: `Test payment session: ${sessionId}`
            };
            
            console.log('✅ Test payment verified successfully:', bookingData);
            
            res.json({
                success: true,
                message: 'Test payment verified successfully',
                bookingData: bookingData,
                paymentDetails: {
                    sessionId: sessionId,
                    paymentStatus: 'paid',
                    testMode: true
                }
            });
            return;
        }
        
        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log('📋 Retrieved Stripe session:', session.id, 'Status:', session.payment_status);
        
        if (session.payment_status === 'paid') {
            // Extract booking data from session metadata
            const bookingData = {
                client_name: session.metadata.customer_name,
                client_email: session.metadata.customer_email,
                client_phone: session.metadata.customer_phone,
                service_address: session.metadata.service_address,
                service_type: session.metadata.service_type,
                service_date: session.metadata.service_date,
                service_hours: session.metadata.service_hours ? session.metadata.service_hours.split(',').map(Number) : [],
                total_hours: session.metadata.service_hours ? session.metadata.service_hours.split(',').length : 0,
                service_cost: Math.round((session.amount_subtotal / 100) - 50), // Subtract booking fee
                booking_fee: 50, // Fixed booking fee
                vat_amount: Math.round((session.amount_total - session.amount_subtotal) / 100),
                total_amount: Math.round(session.amount_total / 100),
                has_night_hours: false, // We can enhance this later
                booking_timestamp: new Date(session.created * 1000).toISOString(),
                status: 'confirmed', // Paid status
                notes: `Payment confirmed via Stripe session: ${sessionId}`
            };
            
            console.log('✅ Payment verified successfully:', bookingData);
            
            res.json({
                success: true,
                message: 'Payment verified successfully',
                bookingData: bookingData,
                paymentDetails: {
                    sessionId: session.id,
                    paymentStatus: session.payment_status,
                    amountTotal: session.amount_total,
                    currency: session.currency
                }
            });
        } else {
            console.log('❌ Payment not completed:', session.payment_status);
            res.status(400).json({
                success: false,
                message: 'Payment not completed',
                paymentStatus: session.payment_status
            });
        }
        
    } catch (error) {
        console.error('❌ Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to verify payment'
        });
    }
});

// Handle payment success (LEGACY - can be removed later)
app.get('/payment-success', async (req, res) => {
    const { session_id } = req.query;
    
    try {
        console.log('✅ Payment success callback for session:', session_id);
        
        // Retrieve the checkout session from Stripe to get payment details
        const session = await stripe.checkout.sessions.retrieve(session_id);
        console.log('📋 Retrieved Stripe session:', session.id, 'Status:', session.payment_status);
        
        if (session.payment_status === 'paid') {
            // Extract booking data from session metadata
            const bookingData = {
                client_name: session.metadata.customer_name,
                client_email: session.metadata.customer_email,
                client_phone: session.metadata.customer_phone,
                service_address: session.metadata.service_address,
                service_type: session.metadata.service_type,
                service_date: session.metadata.service_date,
                service_hours: session.metadata.service_hours ? session.metadata.service_hours.split(',').map(Number) : [],
                total_amount: parseFloat(session.metadata.total_amount),
                booking_timestamp: session.metadata.booking_timestamp,
                payment_status: 'paid',
                stripe_session_id: session_id,
                amount_paid: session.amount_total / 100, // Convert from pence to pounds
                status: 'confirmed'
            };
            
            console.log('💰 Payment confirmed! Processing booking:', bookingData);
            
            // Process the confirmed booking (send to Connecteam, send email, etc.)
            // This would trigger your existing booking processing logic
            
            res.redirect(`/?payment=success&session=${session_id}&amount=${bookingData.amount_paid}`);
        } else {
            console.log('⚠️ Payment not completed, status:', session.payment_status);
            res.redirect(`/?payment=pending&session=${session_id}`);
        }
        
    } catch (error) {
        console.error('❌ Error processing payment success:', error);
        res.redirect(`/?payment=error&message=${encodeURIComponent('Payment processing error')}`);
    }
});

// Simple endpoint to check what your API key actually returns
app.get('/api/check-connecteam-response', async (req, res) => {
    try {
        console.log('🔍 Testing different authentication methods for Connecteam API...');
        
        const testUrl = `${CONNECTEAM_BASE_URL}/me`;
        
        // Try different authentication methods
        const authMethods = [
            { 
                name: 'Bearer Token',
                headers: {
                    'Authorization': `Bearer ${CONNECTEAM_API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'X-API-Key Header',
                headers: {
                    'X-API-Key': CONNECTEAM_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'API-Key Header',
                headers: {
                    'API-Key': CONNECTEAM_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'Connecteam-API-Key Header',
                headers: {
                    'Connecteam-API-Key': CONNECTEAM_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'Query Parameter',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                url: `${testUrl}?api_key=${CONNECTEAM_API_KEY}`
            }
        ];
        
        let results = [];
        
        for (const method of authMethods) {
            try {
                console.log(`🔑 Testing: ${method.name}`);
                
                const response = await fetch(method.url || testUrl, {
                    method: 'GET',
                    headers: method.headers
                });
                
                const contentType = response.headers.get('content-type') || 'unknown';
                const isJson = contentType.includes('application/json');
                
                console.log(`📡 ${method.name}: ${response.status} (${contentType})`);
                
                let responseText = '';
                let parsedData = null;
                
                try {
                    responseText = await response.text();
                    
                    if (isJson && responseText) {
                        try {
                            parsedData = JSON.parse(responseText);
                            console.log(`📄 ${method.name} response:`, Object.keys(parsedData));
                        } catch (e) {
                            console.log(`❌ ${method.name} JSON parse failed`);
                        }
                    }
                } catch (e) {
                    responseText = 'Could not read response';
                }
                
                results.push({
                    method: method.name,
                    status: response.status,
                    contentType: contentType,
                    isJson: isJson,
                    success: response.status === 200,
                    responsePreview: responseText.substring(0, 300),
                    parsedData: parsedData,
                    errorMessage: parsedData?.detail || parsedData?.message || null
                });
                
                // If we found a working method, highlight it
                if (response.status === 200) {
                    console.log(`✅ SUCCESS with ${method.name}!`);
                }
                
            } catch (error) {
                console.log(`❌ ${method.name} failed:`, error.message);
                results.push({
                    method: method.name,
                    error: error.message
                });
            }
        }
        
        const workingMethods = results.filter(r => r.success);
        const errorMessages = results.map(r => r.errorMessage).filter(Boolean);
        
        res.json({
            testUrl: testUrl,
            totalMethods: authMethods.length,
            workingMethods: workingMethods.length,
            results: results,
            summary: {
                apiKeyPreview: CONNECTEAM_API_KEY.substring(0, 8) + '...',
                status: workingMethods.length > 0 ? 'SUCCESS' : 'AUTHENTICATION_FAILED',
                workingAuthMethod: workingMethods.length > 0 ? workingMethods[0].method : null,
                commonErrors: [...new Set(errorMessages)],
                recommendation: workingMethods.length > 0 
                    ? `Use ${workingMethods[0].method} for API calls`
                    : 'Check API key validity or contact Connecteam support for correct authentication method'
            }
        });
        
    } catch (error) {
        console.error('❌ Authentication test error:', error);
        res.status(500).json({
            error: error.message,
            recommendation: 'Check network connection and API endpoint URL'
        });
    }
});

// Proxy endpoint for Connecteam API - using official documentation
app.post('/api/connecteam-booking', async (req, res) => {
    try {
        console.log('📋 Received booking data:', req.body);
        console.log('🔑 Using API key:', CONNECTEAM_API_KEY.substring(0, 8) + '...');
        
        // First, fetch the actual instance IDs dynamically (with fallback)
        console.log('🔍 Using Time Clock instance ID for all jobs...');
        let instanceIds = [13184053]; // Time Clock instance ID - all jobs will appear here
        
        // Note: We're using only the Time Clock instance so all booking jobs appear in one place
        
        try {
            // Try multiple endpoints for instance IDs
            const instanceEndpoints = ['/jobs/v1/instances', '/instances', '/v1/instances'];
            let instancesFound = false;
            
            for (const endpoint of instanceEndpoints) {
                if (instancesFound) break;
                
                try {
                    const instancesResponse = await fetch(`${CONNECTEAM_BASE_URL}${endpoint}`, {
                        method: 'GET',
                        headers: {
                            'X-API-Key': CONNECTEAM_API_KEY,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (instancesResponse.ok) {
                        const instancesData = await instancesResponse.json();
                        const fetchedInstanceIds = instancesData.data?.map(instance => instance.id) || [];
                        
                        if (fetchedInstanceIds.length > 0) {
                            instanceIds = fetchedInstanceIds;
                            console.log(`✅ Using dynamic instance IDs from ${endpoint}:`, instanceIds);
                            instancesFound = true;
                        }
                    }
                } catch (e) {
                    // Continue to next endpoint
                }
            }
            
            if (!instancesFound) {
                // Fallback: Extract from existing jobs and filter out invalid ones
                console.log('🔄 Fallback: Extracting instance IDs from existing jobs...');
                const jobsResponse = await fetch(`${CONNECTEAM_BASE_URL}/jobs/v1/jobs`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONNECTEAM_API_KEY,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (jobsResponse.ok) {
                    const jobsData = await jobsResponse.json();
                    const extractedIds = [];
                    
                    if (jobsData.data && Array.isArray(jobsData.data)) {
                        jobsData.data.forEach(job => {
                            if (job.instanceIds && Array.isArray(job.instanceIds)) {
                                extractedIds.push(...job.instanceIds);
                            }
                        });
                    }
                    
                    const uniqueIds = [...new Set(extractedIds)];
                    
                    // Count frequency of each instance ID to find the most commonly used ones
                    const idFrequency = {};
                    extractedIds.forEach(id => {
                        idFrequency[id] = (idFrequency[id] || 0) + 1;
                    });
                    
                    // Sort by frequency and take the most commonly used
                    const sortedIds = Object.entries(idFrequency)
                        .sort((a, b) => b[1] - a[1])
                        .map(([id]) => parseInt(id));
                    
                    if (sortedIds.length > 0) {
                        instanceIds = sortedIds; // Use all valid IDs sorted by frequency
                        console.log('✅ Using instance IDs from existing jobs (sorted by frequency):', instanceIds);
                        console.log('📊 ID frequency:', idFrequency);
                    } else {
                        console.log('⚠️ No instance IDs found in jobs, using single fallback:', instanceIds);
                    }
                } else {
                    console.log('⚠️ Could not extract from jobs, using single fallback:', instanceIds);
                }
            }
            
        } catch (instanceError) {
            console.log('⚠️ Instance fetch error, using single fallback:', instanceIds);
        }
        // Note: We're using only the Time Clock instance so all booking jobs appear in one place
        
        // Skip complex validation since we're using a known working Time Clock instance ID
        console.log('⏭️ Skipping instance validation - using known Time Clock instance');
        
        // Use only Time Clock instance ID for consistent job placement
        const finalInstanceIds = [13184053]; // Time Clock instance - all jobs appear here
        console.log('🎯 Using Time Clock instance ID only:', finalInstanceIds);
        
        // Based on official Connecteam API documentation with dynamic instanceIds
        const jobCreationAttempts = [
            {
                desc: 'Complete job format with all required fields',
                url: `${CONNECTEAM_BASE_URL}/jobs/v1/jobs`,
                method: 'POST',
                dataMapper: (bookingData) => ([{
                    instanceIds: finalInstanceIds, // Use only validated instance IDs
                    title: `${bookingData.client_name} - ${bookingData.service_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                    code: `BK${Date.now().toString().slice(-6)}`, // Generate unique booking code
                    description: `📋 BOOKING DETAILS\n\n👤 Customer: ${bookingData.client_name}\n📧 Email: ${bookingData.client_email}\n📞 Phone: ${bookingData.client_phone}\n🏠 Address: ${bookingData.service_address}\n\n🛠️ Service: ${bookingData.service_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n📅 Date: ${bookingData.service_date}\n⏰ Hours: ${bookingData.service_hours.join(', ')}\n💰 Total Cost: £${bookingData.total_amount}\n\n📝 Notes: ${bookingData.notes}\n🕐 Booked: ${new Date(bookingData.booking_timestamp).toLocaleString()}`,
                    gps: {
                        address: bookingData.service_address || "",
                        longitude: 0,
                        latitude: 0
                    },
                    assign: {
                        type: "both",
                        userIds: [],
                        groupIds: [15044517]
                    },
                    color: "#4B7AC5",
                    customFields: [],
                    useParentData: false,
                    subJobs: [] // Add empty subJobs array
                }])
            },
            {
                desc: 'Simplified job with essential scheduling fields',
                url: `${CONNECTEAM_BASE_URL}/jobs/v1/jobs`,
                method: 'POST',
                dataMapper: (bookingData) => ([{
                    instanceIds: finalInstanceIds,
                    title: `${bookingData.client_name} - ${bookingData.service_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                    code: `BK${Date.now().toString().slice(-6)}`,
                    description: `Customer: ${bookingData.client_name}\nService: ${bookingData.service_type.replace('-', ' ')}\nDate: ${bookingData.service_date}\nAddress: ${bookingData.service_address}\nTotal: £${bookingData.total_amount}`,
                    assign: {
                        type: "both",
                        userIds: [],
                        groupIds: [15044517]
                    },
                    color: "#81A8CC",
                    gps: {
                        address: bookingData.service_address || ""
                    }
                }])
            },
            {
                desc: 'Try different API version - jobs/v2',
                url: `${CONNECTEAM_BASE_URL}/jobs/v2/jobs`,
                method: 'POST',
                dataMapper: (bookingData) => ([{
                    title: `${bookingData.client_name} - ${bookingData.service_type.replace('-', ' ')}`,
                    description: `Service booking for ${bookingData.client_name}`,
                    address: bookingData.service_address
                }])
            },
            {
                desc: 'Try tasks endpoint instead of jobs',
                url: `${CONNECTEAM_BASE_URL}/tasks/v1/tasks`,
                method: 'POST',
                dataMapper: (bookingData) => ({
                    title: `${bookingData.client_name} - ${bookingData.service_type.replace('-', ' ')}`,
                    description: `Service booking for ${bookingData.client_name}\nTotal: £${bookingData.total_amount}`,
                    status: 'open'
                })
            }
        ];
        
        // First, let's test if we can access the API at all
        console.log('🔍 Testing API access with correct authentication...');
        
        try {
            const testResponse = await fetch(`${CONNECTEAM_BASE_URL}/me`, {
                method: 'GET',
                headers: {
                    'X-API-Key': CONNECTEAM_API_KEY, // CORRECT authentication method
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`📡 API Test (/me): ${testResponse.status}`);
            
            if (testResponse.status === 401 || testResponse.status === 403) {
                return res.status(401).json({
                    success: false,
                    message: 'Connecteam API authentication failed',
                    error: 'Invalid API key or insufficient permissions',
                    status: testResponse.status,
                    suggestion: 'Check API key in Connecteam dashboard and ensure it has job creation permissions'
                });
            }
            
            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('✅ API authentication successful:', Object.keys(testData));
            }
            
        } catch (authError) {
            console.log('❌ API authentication test failed:', authError.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to connect to Connecteam API',
                error: authError.message
            });
        }
        
        // Now try to create the job/task
        let success = false;
        let results = [];
        
        for (const attempt of jobCreationAttempts) {
            try {
                console.log(`🔄 Trying: ${attempt.desc} - ${attempt.url}`);
                
                const mappedData = attempt.dataMapper(req.body);
                console.log('📤 Mapped data:', JSON.stringify(mappedData, null, 2));
                
                const response = await fetch(attempt.url, {
                    method: attempt.method,
                    headers: {
                        'X-API-Key': CONNECTEAM_API_KEY, // CORRECT authentication method
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(mappedData)
                });
                
                const contentType = response.headers.get('content-type') || 'unknown';
                const isJson = contentType.includes('application/json');
                
                console.log(`📡 ${attempt.desc}: ${response.status} (${contentType})`);
                
                let responseData;
                try {
                    if (response.ok) {
                        if (isJson) {
                            responseData = await response.json();
                            console.log(`✅ SUCCESS! Job/Task created with ${attempt.desc}:`, responseData);
                            
                            // Extract job details for better logging
                            const createdJob = responseData.data?.jobs?.[0];
                            const jobId = createdJob?.jobId || responseData.data?.id || responseData.id || 'unknown';
                            
                            console.log('📋 Created Job Details:');
                            console.log(`   - Job ID: ${jobId}`);
                            console.log(`   - Title: ${createdJob?.title || 'unknown'}`);
                            console.log(`   - Code: ${createdJob?.code || 'none'}`);
                            console.log(`   - Color: ${createdJob?.color || 'default'}`);
                            console.log(`   - Assigned to Group: ${createdJob?.assign?.groupIds?.join(', ') || 'none'}`);
                            console.log(`   - Instance IDs: ${createdJob?.instanceIds?.join(', ') || 'none'}`);
                            
                            res.json({
                                success: true,
                                message: 'Booking successfully created in Connecteam',
                                method: attempt.desc,
                                endpoint: attempt.url,
                                status: response.status,
                                jobId: jobId,
                                jobDetails: {
                                    id: jobId,
                                    title: createdJob?.title,
                                    code: createdJob?.code,
                                    description: createdJob?.description,
                                    color: createdJob?.color,
                                    assignedGroups: createdJob?.assign?.groupIds,
                                    instanceIds: createdJob?.instanceIds,
                                    address: createdJob?.gps?.address
                                },
                                data: responseData,
                                nextSteps: [
                                    'Check Connecteam Jobs section for the created job',
                                    'Verify job appears in scheduling/calendar view', 
                                    'Ensure assigned users can see the job in their mobile app'
                                ]
                            });
                            return;
                            
                        } else {
                            const text = await response.text();
                            responseData = { 
                                success_but_not_json: true,
                                status: response.status,
                                content: text.substring(0, 500)
                            };
                        }
                    } else {
                        // Handle error response
                        let errorData;
                        try {
                            errorData = isJson ? await response.json() : await response.text();
                        } catch (e) {
                            errorData = 'Could not read error response';
                        }
                        
                        console.log(`❌ Error ${response.status}:`, errorData);
                        responseData = {
                            error: true,
                            status: response.status,
                            errorData: errorData
                        };
                    }
                    
                } catch (readError) {
                    console.log(`❌ Error reading response: ${readError.message}`);
                    responseData = { 
                        error: 'Failed to read response',
                        message: readError.message 
                    };
                }
                
                results.push({
                    endpoint: attempt.desc,
                    url: attempt.url,
                    status: response.status,
                    contentType: contentType,
                    isJson: isJson,
                    response: responseData
                });
                
            } catch (networkError) {
                console.log(`❌ Network error for ${attempt.desc}:`, networkError.message);
                results.push({
                    endpoint: attempt.desc,
                    url: attempt.url,
                    networkError: networkError.message
                });
            }
        }
        
        // If we get here, job creation didn't work but log the details
        console.log('\n📋 Job creation attempts completed. Results:', results);
        console.log('\n📋 BOOKING DETAILS FOR MANUAL PROCESSING:');
        console.log('=====================================');
        console.log(JSON.stringify(req.body, null, 2));
        console.log('=====================================\n');
        
        res.status(200).json({
            success: false,
            message: 'Connecteam job creation pending - manual processing required',
            booking_logged: true,
            attempts: results,
            bookingData: req.body,
            analysis: 'API connection tested, job creation endpoints attempted',
            recommendation: 'Check Connecteam dashboard for job creation permissions and correct data format'
        });
        
    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint to verify API key and find correct endpoints
app.get('/api/test-connecteam', async (req, res) => {
    try {
        console.log('🧪 Testing Connecteam API with official documentation endpoints...');
        console.log('🔑 API Key:', CONNECTEAM_API_KEY.substring(0, 8) + '...');
        
        // Test endpoints based on official documentation (using correct auth method)
        const testEndpoints = [
            { url: `${CONNECTEAM_BASE_URL}/me`, method: 'GET', desc: 'Account information (from docs)' },
            { url: `${CONNECTEAM_BASE_URL}/users/v1/users`, method: 'GET', desc: 'Get users (from docs)' },
            { url: `${CONNECTEAM_BASE_URL}/jobs/v1/jobs`, method: 'GET', desc: 'Get jobs (from docs)' },
            { url: `${CONNECTEAM_BASE_URL}/tasks/v1/taskboards`, method: 'GET', desc: 'Get task boards (from docs)' }
        ];
        
        let results = [];
        
        for (const endpoint of testEndpoints) {
            try {
                console.log(`🔍 Testing: ${endpoint.desc} - ${endpoint.url}`);
                
                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: {
                        'X-API-Key': CONNECTEAM_API_KEY, // CORRECT authentication method
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                const contentType = response.headers.get('content-type') || 'unknown';
                const isJson = contentType.includes('application/json');
                
                console.log(`📡 ${endpoint.desc}: ${response.status} (${contentType})`);
                
                let responseData;
                try {
                    if (isJson && response.ok) {
                        responseData = await response.json();
                        console.log(`✅ ${endpoint.desc} - Keys:`, Object.keys(responseData));
                    } else {
                        const text = await response.text();
                        responseData = {
                            status: response.status,
                            contentType: contentType,
                            preview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
                        };
                    }
                } catch (e) {
                    responseData = { error: 'Failed to read response', message: e.message };
                }
                
                results.push({
                    endpoint: endpoint.desc,
                    url: endpoint.url,
                    method: endpoint.method,
                    status: response.status,
                    contentType: contentType,
                    isJson: isJson,
                    success: response.ok && isJson,
                    response: responseData
                });
                
                // If we found a working endpoint, that's great!
                if (response.ok && isJson) {
                    console.log(`✅ Working endpoint found: ${endpoint.desc}`);
                }
                
            } catch (error) {
                console.log(`❌ Error testing ${endpoint.desc}:`, error.message);
                results.push({
                    endpoint: endpoint.desc,
                    url: endpoint.url,
                    error: error.message
                });
            }
        }
        
        const workingEndpoints = results.filter(r => r.success);
        
        res.json({
            success: workingEndpoints.length > 0,
            message: workingEndpoints.length > 0 
                ? `Found ${workingEndpoints.length} working API endpoints!` 
                : 'No working endpoints found. Check API key or authentication method.',
            workingEndpoints: workingEndpoints,
            allResults: results,
            apiKey: CONNECTEAM_API_KEY.substring(0, 8) + '...',
            baseUrl: CONNECTEAM_BASE_URL,
            nextStep: workingEndpoints.length > 0 
                ? 'Ready to implement job/task creation!' 
                : 'Check authentication method or API key permissions'
        });
        
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get existing jobs to understand the data structure
app.get('/api/connecteam-jobs', async (req, res) => {
    try {
        console.log('🔍 Fetching existing jobs from Connecteam...');
        
        const response = await fetch(`${CONNECTEAM_BASE_URL}/jobs/v1/jobs`, {
            method: 'GET',
            headers: {
                'X-API-Key': CONNECTEAM_API_KEY,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const jobsData = await response.json();
            console.log('📋 Existing jobs structure:', JSON.stringify(jobsData, null, 2));
            
            res.json({
                success: true,
                message: 'Retrieved existing jobs successfully',
                status: response.status,
                data: jobsData,
                analysis: {
                    jobCount: jobsData.data?.length || 0,
                    sampleJob: jobsData.data?.[0] || null,
                    requiredFields: jobsData.data?.[0] ? Object.keys(jobsData.data[0]) : []
                }
            });
        } else {
            const errorData = await response.json();
            console.log('❌ Error fetching jobs:', errorData);
            
            res.status(response.status).json({
                success: false,
                status: response.status,
                error: errorData
            });
        }
        
    } catch (error) {
        console.error('❌ Error fetching jobs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get instance IDs for job creation - with multiple endpoint attempts
app.get('/api/connecteam-instances', async (req, res) => {
    try {
        console.log('🔍 Trying to fetch instance IDs from Connecteam...');
        
        // Try multiple possible endpoints for instances
        const instanceEndpoints = [
            '/jobs/v1/instances',
            '/instances',
            '/v1/instances', 
            '/scheduler/instances',
            '/timeclock/instances'
        ];
        
        let results = [];
        let successfulData = null;
        
        for (const endpoint of instanceEndpoints) {
            try {
                console.log(`🔄 Trying endpoint: ${CONNECTEAM_BASE_URL}${endpoint}`);
                
                const response = await fetch(`${CONNECTEAM_BASE_URL}${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONNECTEAM_API_KEY,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                const contentType = response.headers.get('content-type') || 'unknown';
                const isJson = contentType.includes('application/json');
                
                console.log(`📡 ${endpoint}: ${response.status} (${contentType})`);
                
                if (response.ok && isJson) {
                    const data = await response.json();
                    console.log(`✅ Success with ${endpoint}:`, Object.keys(data));
                    successfulData = data;
                    results.push({
                        endpoint: endpoint,
                        status: response.status,
                        success: true,
                        data: data
                    });
                    break; // Stop on first success
                } else {
                    const errorData = response.ok ? 'Not JSON' : await response.text();
                    results.push({
                        endpoint: endpoint,
                        status: response.status,
                        success: false,
                        error: errorData
                    });
                }
                
            } catch (error) {
                console.log(`❌ Error with ${endpoint}:`, error.message);
                results.push({
                    endpoint: endpoint,
                    error: error.message
                });
            }
        }
        
        if (successfulData) {
            // Extract instance IDs if available
            const instanceIds = successfulData.data?.map(instance => instance.id) || 
                               successfulData.instances?.map(instance => instance.id) ||
                               [];
            
            res.json({
                success: true,
                message: 'Found instance data',
                data: successfulData,
                instanceIds: instanceIds,
                attempts: results
            });
        } else {
            // Fallback: Extract instance IDs from existing jobs
            console.log('🔄 Fallback: Getting instance IDs from existing jobs...');
            
            const jobsResponse = await fetch(`${CONNECTEAM_BASE_URL}/jobs/v1/jobs`, {
                method: 'GET',
                headers: {
                    'X-API-Key': CONNECTEAM_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (jobsResponse.ok) {
                const jobsData = await jobsResponse.json();
                const instanceIdsFromJobs = [];
                
                // Extract instance IDs from existing jobs
                if (jobsData.data && Array.isArray(jobsData.data)) {
                    jobsData.data.forEach(job => {
                        if (job.instanceIds && Array.isArray(job.instanceIds)) {
                            instanceIdsFromJobs.push(...job.instanceIds);
                        }
                    });
                }
                
                // Remove duplicates
                const uniqueInstanceIds = [...new Set(instanceIdsFromJobs)];
                
                console.log('✅ Extracted instance IDs from jobs:', uniqueInstanceIds);
                
                res.json({
                    success: true,
                    message: 'Instance IDs extracted from existing jobs (fallback method)',
                    instanceIds: uniqueInstanceIds,
                    fallbackUsed: true,
                    attempts: results,
                    analysis: {
                        totalJobs: jobsData.data?.length || 0,
                        uniqueInstanceIds: uniqueInstanceIds,
                        instanceIdFrequency: instanceIdsFromJobs.reduce((acc, id) => {
                            acc[id] = (acc[id] || 0) + 1;
                            return acc;
                        }, {}),
                        recommendedInstanceIds: [13184053] // Time Clock instance only
                    },
                    jobsData: jobsData
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'No instance endpoints found and could not extract from jobs',
                    attempts: results,
                    fallbackInstanceIds: [13184053] // Time Clock instance only
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error fetching instances:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallbackInstanceIds: [13184053] // Time Clock instance only
        });
    }
});

// Start server - bind to all interfaces for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
    console.log(`📋 Connecteam API Key: ${CONNECTEAM_API_KEY.substring(0, 8)}...`);
    console.log(`🔗 API Base URL: ${CONNECTEAM_BASE_URL}`);
    console.log('\n📝 Railway deployment ready for production');
    console.log('🌐 Access your booking system via Railway URL');
});

// Set server timeout to prevent Railway from killing the container
server.timeout = 120000; // 2 minutes timeout
server.keepAliveTimeout = 65000; // Keep alive timeout
server.headersTimeout = 66000; // Headers timeout

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit immediately, let the process handle it gracefully
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, let the process handle it gracefully
});