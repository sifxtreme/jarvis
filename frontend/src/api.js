const DEV_URL = 'http://localhost:3000'
const PROD_URL = '/api'
const RAILS_PASSWORD_KEY = 'JARVIS_RAILS_PASS'

const URL_ROOT = process.env.REACT_APP_ENV === 'development' ? DEV_URL : PROD_URL

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function headers() {
  var myHeaders = new Headers();
  if(getParameterByName('p')){
    localStorage.setItem(RAILS_PASSWORD_KEY, getParameterByName('p'))
  }
  const authorizationKey = localStorage.getItem(RAILS_PASSWORD_KEY)
  myHeaders.append("Authorization", authorizationKey);
  return myHeaders
}

export getFinancialTransactions = async function getFinancialTransactions() {
  const url = `${URL_ROOT}/financial_transactions`;

  const response = await fetch(url, {
          method: 'GET',
          headers: headers()
        })
  
  return response.json()
}

export async function createFinancialTransaction(data) {
  const url = `${URL_ROOT}/financial_transactions`;

  const response = await fetch(url, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(data)
        })
  
  return response.json()
}

export async function updateFinancialTransaction(data) {
  const url = `${URL_ROOT}/financial_transactions/${data.id}`;

  const response = await fetch(url, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(data)
        })
  
  return response.json()
}