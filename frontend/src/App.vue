<template>
  <div id="app">
    <Finances />
  </div>
</template>

<script>
import Finances from './views/Finances.vue'

export default {
  name: 'app',
  components: {
    Finances
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
