<template>
  <div>
    <div v-for="transaction in transactions" :key="transaction.id">
      <FinanceTableRow :transaction="transaction" />
    </div>
  </div>
  
</template>

<script>

import { getFinancialTransactions } from '../lib/api.js'
import FinanceTableRow from '../components/FinanceTableRow'

export default {
  components: { FinanceTableRow },
  data: function() {
    return {
      transactions: [],
      categories: [],
    }
  },
  created: async function() {
    const [transactions] = await Promise.all([
      getFinancialTransactions(),
    ]);

    this.transactions = transactions['results']
  },
}
</script>

<style lang="scss" scoped>

</style>
