# Firebase Private Key Setup Guide

## Problem
Firebase private keys contain newlines and special characters that can break when stored in `.env` files or cloud environment variables. Using base64 encoding solves this.

## Solution: Use Base64 Encoding

### Step 1: Get Your Firebase Private Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Open the JSON file and copy the `private_key` value (it should look like):
   ```
   "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
   ```

### Step 2: Encode to Base64

**Option A: Using the Helper Script (Recommended)**

```bash
cd backend
node scripts/encode-firebase-key.js
```

Then:
1. Paste your private key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
2. Press Enter, then `Ctrl+D` (Mac/Linux) or `Ctrl+Z` (Windows)
3. Copy the base64 output

**Option B: Using Command Line**

```bash
# Copy your private key to a file first
echo '-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----' | node scripts/encode-firebase-key.js
```

**Option C: Manual Base64 Encoding**

```bash
# On Mac/Linux
echo -n "YOUR_PRIVATE_KEY_HERE" | base64

# On Windows (PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("YOUR_PRIVATE_KEY_HERE"))
```

### Step 3: Add to .env File

Add this line to your `backend/.env` file:

```env
FIREBASE_PRIVATE_KEY_BASE64=<paste-the-base64-string-here>
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

**Important:**
- Do NOT wrap the base64 string in quotes
- Do NOT add spaces around the `=` sign
- The base64 string should be on a single line

### Step 4: Verify

Restart your server and check the logs. You should see:
```
✅ Firebase Admin SDK initialized successfully
```

If you see an error, check:
1. The base64 string doesn't have quotes around it
2. The base64 string is complete (not truncated)
3. The original private key included the BEGIN/END markers

## Troubleshooting

### Error: "Invalid PEM formatted message"

**Cause:** The decoded key is missing newlines or has incorrect format.

**Fix:**
1. Make sure you encoded the COMPLETE private key including:
   - `-----BEGIN PRIVATE KEY-----` (or `-----BEGIN RSA PRIVATE KEY-----`)
   - The actual key content
   - `-----END PRIVATE KEY-----` (or `-----END RSA PRIVATE KEY-----`)

2. Re-encode using the helper script:
   ```bash
   node scripts/encode-firebase-key.js
   ```

3. Make sure there are NO quotes in your `.env` file:
   ```env
   # ❌ WRONG
   FIREBASE_PRIVATE_KEY_BASE64="LS0tLS1CRUdJTi..."
   
   # ✅ CORRECT
   FIREBASE_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTi...
   ```

### Error: "Failed to decode base64 private key"

**Cause:** The base64 string is invalid or corrupted.

**Fix:**
1. Check if the base64 string was copied completely
2. Remove any line breaks or spaces from the base64 string
3. Re-encode the key using the helper script

## Example

**Original Private Key (from JSON):**
```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**After Base64 Encoding:**
```
LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHU3dVREFqRUNBQUFBQVNJQ0JLd3dnZ1NqQWdFQUFvSUJBQUMuLi4KLS0tLS1FTkQgUFJJVEFURSBLRVktLS0tLQo=
```

**In .env file:**
```env
FIREBASE_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHU3dVREFqRUNBQUFBQVNJQ0JLd3dnZ1NqQWdFQUFvSUJBQUMuLi4KLS0tLS1FTkQgUFJJVEFURSBLRVktLS0tLQo=
```

## For Cloud Deployments (Sevalla, etc.)

When setting environment variables in your cloud platform:

1. **Key:** `FIREBASE_PRIVATE_KEY_BASE64`
2. **Value:** The base64 string (no quotes, no spaces)
3. Make sure the value is set as a single-line string

The code will automatically:
- Decode the base64 string
- Format it properly with newlines
- Initialize Firebase Admin SDK

