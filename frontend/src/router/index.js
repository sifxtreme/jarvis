import Vue from 'vue'
import VueRouter from 'vue-router'
import Transactions from '@/views/Transactions.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/*',
    name: 'transactions',
    component: Transactions
  }
]

import { isAuthenticated } from '@/lib/api'

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

// before hooks
const authenticateUser = (to, from, next) => {
  if (!isAuthenticated()) {
    alert('You need to log in first!')
  }
  next()
}

router.beforeEach(authenticateUser)

export default router
