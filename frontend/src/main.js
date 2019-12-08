import Vue from 'vue'
import router from '@/router'

import ElementUI from 'element-ui'
import './element-variables.scss'

import App from './App.vue'

Vue.config.productionTip = false

Vue.use(ElementUI)

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
