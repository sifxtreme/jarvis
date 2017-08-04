# plaid

[Plaid](https://plaid.com/) is an API that allows you to get info easily about transactions/balances on your credit card. Jarvis leverages Plaid's [legacy API](https://plaid.com/docs/legacy/api/)

To use Plaid in Jarvis you must:

1. Sign up on the Plaid website. You only need a developer account as long as you have less than 100 credit cards you wish to check.
2. For each of your credit cards, you must first authenticate with Plaid. Here are the steps:
    - Get a list of bank/credit card institutions
```curl -X GET \
  https://tartan.plaid.com/institutions \
  -H 'content-type: application/json'
```
    - Submit your credentials (auth call) to Plaid for your credit card
```
curl -X POST \
  https://tartan.plaid.com/auth \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'client_id=CLIENT_ID&secret=CLIENT_SECRET&username=BANK_USERNAME&password=YOUR_PASSWORD&type=YOUR_BANK_CARD'
```
    - Upgrade your account on Plaid so that you can hit the transactions endpoint
```
curl -X POST \
https://tartan.plaid.com/upgrade \
-H 'content-type: application/x-www-form-urlencoded' \
-d 'client_id=CLIENT_ID&secret=CLIENT_SECRET&access_token=YOUR_ACCESS_TOKEN&upgrade_to=connect'
```
    - Get your transactions (you don't need to do this in Jarvis, as Jarvis does this for you)
```
curl -X POST \
https://tartan.plaid.com/connect/get \
-H 'content-type: application/x-www-form-urlencoded' \
-d 'client_id=CLIENT_ID&secret=CLIENT_SECRET&access_token=YOUR_ACCESS_TOKEN'```
```
3. Save the token returned from the auth call in a the .env file AND/OR in a ENV variable (the current variable name is `JARVIS_PLAID_ACCESS_TOKENS`)

