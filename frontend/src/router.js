import Vue from 'vue'
import Router from 'vue-router'

import TransactionsView from '@/views/Finances'
import BalancesView from '@/views/Balances'

import { isAuthenticated } from '@/lib/api'

Vue.use(Router)

const router = new Router({
  base: process.env.BASE_URL,
  mode: 'history',
  routes: [
    {
      path: '/balances',
      name: 'BalancesView',
      component: BalancesView
    },
    {
      path: '*',
      name: 'TransactionsView',
      component: TransactionsView
    }
  ]
})

// before hooks
function authenticateUser(to, from, next) {
  if (!isAuthenticated()) {
    alert('You need to log in first!')
  }
  next()
}

router.beforeEach(authenticateUser)

export default router
