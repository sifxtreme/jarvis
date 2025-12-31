# Teller Integration

Teller is the primary API for syncing bank transactions (replaced Plaid for most accounts).

## Architecture

### Key Files
- `backend/app/lib/teller/api.rb` - Teller API client
- `backend/app/jobs/sync_transactions_for_banks.rb` - Background job that runs every 3 hours
- `teller/certificate.pem` - mTLS certificate (NOT committed to repo)
- `teller/private_key.pem` - mTLS private key (NOT committed to repo)
- `teller-repair.html` - Browser tool to repair disconnected enrollments

### Authentication
Teller uses **mutual TLS (mTLS)** + access token:
1. Certificate + private key (downloaded from Teller dashboard)
2. Access token (starts with `token_`) - received when completing enrollment

All three are required to make API calls. The token alone is useless without the certificates.

### Current Limitations
- Hardcoded account ID: `acc_p0lv582dt0rb4t46fi000` (Amex)
- Hardcoded date limit: Only syncs transactions after `2024-06-15`
- Single account support (unlike Plaid integration which supports multiple)

## Supported Banks
Teller supports 5,000+ US institutions including:
- American Express
- Chase
- Bank of America
- Citi
- Capital One

## Troubleshooting

### Error: "Enrollment is not healthy" / "mfa_required"

**Symptoms:**
```
Teller::API::TellerError
Error: {"error":{"message":"Enrollment is not healthy","code":"enrollment.disconnected.user_action.mfa_required"}}
```

This appears in Resque (`/resque`) when the `SyncTransactionsForBanks` job fails.

**Cause:**
The bank connection has become stale. Banks periodically require re-authentication for security (password change, periodic MFA verification, terms update, etc.).

**Solution:**

1. Start a local server:
   ```bash
   cd /Users/asifahmed/code/experiments/jarvis
   python3 -m http.server 8080
   ```

2. Open http://localhost:8080/teller-repair.html

3. Get your credentials from [teller.io/dashboard](https://teller.io/dashboard):
   - **Application ID** (starts with `app_`)
   - **Enrollment ID** (starts with `enr_`) - find under Enrollments section

4. Enter credentials in the repair tool and click "Repair Enrollment"

5. Complete the bank's MFA challenge (text/email code)

6. If you get a NEW access token, update `backend/app/lib/teller/api.rb` line 18

**Important:** The repair tool uses `environment: 'development'` which is free (up to 100 enrollments). Production requires payment setup.

### Error: "your application needs payment setup"

You're using production environment. The `teller-repair.html` tool should be set to `environment: 'development'`. Check that line 202 and 242 in the HTML file say `development`, not `production`.

### Adding a New Bank (e.g., Chase)

1. Open http://localhost:8080/teller-repair.html
2. Enter your Application ID
3. Click "Create New Enrollment"
4. Select the bank and complete authentication
5. Copy the new access token
6. Currently requires code changes to support multiple accounts (TODO)

### Refreshing Teller Certificates

When your Teller certificates expire:
1. Go to [teller.io/dashboard](https://teller.io/dashboard)
2. Download new certificate bundle
3. Extract `certificate.pem` and `private_key.pem` to the `teller/` folder
4. Restart the API/worker containers

## API Reference

### Endpoints Used
- `GET /accounts` - List accounts (includes `enrollment_id`)
- `GET /accounts/:id/transactions` - Fetch transactions

### Transaction Filtering
The sync only imports:
- Type: `card_payment` or `refund`
- Status: `posted` (not pending)
- Date: After the hardcoded date limit

### Rate Limits
Teller has rate limits. The job runs every 3 hours (`0 */3 * * *` in `config/resque_schedule.yml`).

## Future Improvements

- [ ] Support multiple accounts/enrollments (like Plaid integration)
- [ ] Move access token to environment variable or database
- [ ] Make date limit configurable
- [ ] Add webhook support for real-time disconnection alerts
