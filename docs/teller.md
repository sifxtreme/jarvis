# Teller Integration
Date: 2026-01-02

Teller is the primary API for syncing bank transactions (replaced Plaid for most accounts).

## Architecture

### Key Files
- `backend/app/lib/teller/api.rb` - Teller API client
- `backend/app/jobs/sync_transactions_for_banks.rb` - Background job that runs every 3 hours
- `backend/app/lib/teller/certificate.pem` - mTLS certificate (NOT committed to repo)
- `backend/app/lib/teller/private_key.pem` - mTLS private key (NOT committed to repo)
- `finance-tracker-app/.../pages/TellerRepairPage.tsx` - In-app tool to repair disconnected enrollments

### Authentication
Teller uses **mutual TLS (mTLS)** + access token:
1. Certificate + private key (downloaded from Teller dashboard)
2. Access token (starts with `token_`) - received when completing enrollment

All three are required to make API calls. The token alone is useless without the certificates.

### Bank Connections Table
Multi-account support is managed via the `bank_connections` database table:
- `name` - Bank identifier (e.g., "chase", "amex")
- `token` - Teller access token
- `account_id` - Teller account ID (acc_xxx)
- `sync_from_date` - Optional date to limit transaction sync
- `is_active` - Toggle syncing on/off
- `provider` - `teller` or `plaid` (Teller rows should be `teller`)

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

1. Go to the Teller Repair page in the app: `/teller-repair`
   - Or locally: http://localhost:3001/teller-repair

2. Get your credentials from [teller.io/dashboard](https://teller.io/dashboard):
   - **Application ID** (starts with `app_`)
   - **Enrollment ID** (starts with `enr_`) - find under Enrollments section

3. Enter credentials in the repair tool and click "Repair Enrollment"

4. Complete the bank's MFA challenge (text/email code)

5. Copy the new access token shown after success

6. Update the token in the `bank_connections` database table

**Important:** The repair tool uses `environment: 'development'` which is free (up to 100 enrollments). Production requires payment setup.

### Error: "your application needs payment setup"

You're using production environment. The in-app Teller Repair tool is hardcoded to use `environment: 'development'`, so this shouldn't happen unless you modified the code.

### Adding a New Bank (e.g., Chase)

1. Go to the Teller Repair page: `/teller-repair`
2. Enter your Application ID (from Teller dashboard)
3. Click "New Enrollment"
4. Select the bank and complete authentication
5. Copy the new access token
6. Use "Lookup Account ID" to get the account ID
7. Add a new row to `bank_connections` table with the token and account ID

### Refreshing Teller Certificates

When your Teller certificates expire:
1. Go to [teller.io/dashboard](https://teller.io/dashboard)
2. Download new certificate bundle
3. Extract `certificate.pem` and `private_key.pem` to `backend/app/lib/teller/`
4. Restart the API/worker containers

## API Reference

### Endpoints Used
- `GET /accounts` - List accounts (includes `enrollment_id`)
- `GET /accounts/:id/transactions` - Fetch transactions

### Transaction Filtering
The sync only imports:
- Status: `posted` (not pending)
- Date: After `bank_connections.sync_from_date` if set

### Rate Limits
Teller has rate limits. The job runs every 3 hours (`0 */3 * * *` in `config/resque_schedule.yml`).

## Future Improvements

- [x] Support multiple accounts/enrollments (via `bank_connections` table)
- [x] Move access token to database (`bank_connections.token`)
- [x] Make date limit configurable (`bank_connections.sync_from_date`)
- [ ] Add webhook support for real-time disconnection alerts
