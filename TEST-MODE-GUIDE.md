# Test Mode Guide

## Overview
Test Mode allows you to test the Connecteam and EmailJS integrations locally without processing real Stripe payments.

## How to Enable Test Mode

1. **Open `index.html`** (line 517)
2. **Set TEST_MODE flag:**
   ```javascript
   const TEST_MODE = true;  // Enable test mode
   ```

## How to Use Test Mode

### Starting Local Server
```cmd
node server.js
```

The server will start on `http://localhost:3000`

### Testing Flow

1. **Open the website** in your browser: `http://localhost:3000`

2. **Fill out the booking form:**
   - Enter customer details (name, surname, email, WhatsApp)
   - Select a service
   - Choose a date (must be tomorrow or later)
   - Select hours
   - Accept terms

3. **Click "Proceed to Payment"**

4. **What happens in Test Mode:**
   - ✅ **No Stripe checkout** - Payment is skipped
   - ✅ **Dummy payment simulation** - 1.5 second delay
   - ✅ **Connecteam API call** - Real API call to create job
   - ✅ **EmailJS API call** - Real email sent to customer
   - ✅ **Success message displayed** - Booking confirmed

5. **Check the results:**
   - Open browser **Console** (F12) to see detailed logs
   - Look for:
     - `🧪 TEST MODE: Using dummy checkout`
     - `✅ Connecteam booking created successfully`
     - `✅ Email receipt sent`

### Expected Console Output

```
🧪 TEST MODE: Using dummy checkout
📋 Booking data: {name: "John", surname: "Doe", email: "john@example.com", ...}
💰 Cost breakdown: {serviceName: "Hospital Support", hours: 2, ...}
🧪 Test mode - processing booking immediately
✅ Connecteam booking created successfully: {success: true, jobId: "..."}
✅ Email receipt sent: {success: true}
💚 Payment success - showing confirmation
```

## Verifying Integrations

### Connecteam Verification
1. Log into Connecteam dashboard
2. Navigate to **Time Clock** > **Jobs**
3. Look for the new job with:
   - Customer name as job title
   - Service address as location
   - Service date as scheduled date
   - Status: "Unassigned"

### EmailJS Verification
1. Check the customer's email inbox
2. Look for email from Dahab Services
3. Verify all booking details are correct:
   - Customer name, email, WhatsApp
   - Service type and date
   - Selected hours
   - Pricing breakdown (service cost + booking fee + VAT)

## Disabling Test Mode for Production

When ready to deploy to Railway with real payments:

1. **Open `index.html`** (line 517)
2. **Disable TEST_MODE:**
   ```javascript
   const TEST_MODE = false;  // Disable test mode for production
   ```

3. **Commit and push:**
   ```cmd
   git add index.html
   git commit -m "Disable test mode for production"
   git push origin main
   ```

4. **Deploy to Railway:**
   ```cmd
   railway up
   ```

## Troubleshooting

### Issue: Connecteam job not created

**Check:**
- Console shows `✅ Connecteam booking created successfully`?
- If shows `⚠️ Connecteam booking logged for manual processing` - check server logs
- Verify Connecteam API key in `server.js` (line 18)
- Verify Time Clock instance ID in `server.js` (line 19)

**Fix:**
```cmd
# Check server logs for errors
node server.js
# Look for "❌ Connecteam API Error" messages
```

### Issue: Email not received

**Check:**
- Console shows `✅ Email receipt sent`?
- Check spam folder
- Verify EmailJS credentials in `index.html`:
  - Service ID: `service_a7dgx7g` (line 1021)
  - Template ID: `template_2hvvc3w` (line 1022)
  - Public Key: `9GKGq43yXb4QNi39R` (line 607)

**Test EmailJS directly:**
```javascript
// Run in browser console
emailjs.send('service_a7dgx7g', 'template_2hvvc3w', {
  to_email: 'your-email@example.com',
  customer_name: 'Test',
  customer_surname: 'User'
}, '9GKGq43yXb4QNi39R')
.then(result => console.log('✅ Test email sent:', result))
.catch(error => console.error('❌ Test email failed:', error));
```

### Issue: Success message not showing

**Check:**
- Console for JavaScript errors
- Make sure TEST_MODE is set to `true`
- Verify `handlePaymentSuccess()` function is called

## API Credentials Reference

### Connecteam
- **API Key:** `729d2096-89a3-4ca0-b39d-9aa06d87cf01`
- **Time Clock Instance:** `13184053`
- **Base URL:** `https://api.connecteam.com`

### EmailJS
- **Service ID:** `service_a7dgx7g`
- **Template ID:** `template_2hvvc3w`
- **Public Key:** `9GKGq43yXb4QNi39R`

### Stripe (Production - NOT used in test mode)
- **Publishable Key:** `pk_live_51Rzdkv8gTeFhZ0UG6Am8eRIsO6V3om7C0OQb1XgIqFelTMQy4vZ5zDB4HTSYbGB9lkrnLTkhVXx7TT6nYfyvKlAL00sDG2ff3W`

## Important Notes

⚠️ **Test Mode still makes REAL API calls to:**
- Connecteam (creates actual jobs)
- EmailJS (sends actual emails)

Only Stripe payment processing is skipped.

✅ **Benefits:**
- Test integration logic without payment processing
- Verify API credentials are correct
- Debug email templates
- Test Connecteam job creation
- No risk of failed payments during testing

🔒 **Security:**
- Never commit API keys to public repositories
- Keep TEST_MODE = false in production
- Use environment variables for sensitive data (future improvement)
