const DEV_URL = 'http://localhost:3000'
const PROD_URL = '/api'
const RAILS_PASSWORD_KEY = 'JARVIS_RAILS_PASS'

const URL_ROOT = process.env.REACT_APP_ENV === 'development' ? DEV_URL : PROD_URL

function headers() {
  var myHeaders = new Headers();
  var authorizationKey = localStorage.getItem(RAILS_PASSWORD_KEY)
  myHeaders.append("Authorization", authorizationKey);
  return myHeaders
}

export async function getFinancialTransactions() {
  let url = `${URL_ROOT}/financial_transactions`;

  const response = await fetch(url, {
          method: 'GET',
          headers: headers()
        })
  
  return response.json()
}

export async function createFinancialTransaction(data) {
  let url = `${URL_ROOT}/financial_transactions`;

  const response = await fetch(url, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(data)
        })
  
  return response.json()
}

export async function updateFinancialTransaction(data) {
  let url = `${URL_ROOT}/financial_transactions/${data.id}`;

  const response = await fetch(url, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(data)
        })
  
  return response.json()
}