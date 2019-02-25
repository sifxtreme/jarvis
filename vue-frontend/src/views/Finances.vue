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
      selectedYear: 2019,
      selectedMonth: 2,
    }
  },
  created: async function() {
    const today = new Date();
    this.selectedYear = today.getFullYear();
    this.selectedMonth = today.getMonth() + 1;

    const [transactions] = await Promise.all([
      getFinancialTransactions(this.selectedYear, this.selectedMonth),
    ]);

    this.transactions = transactions['results']
  },
}
</script>

<style lang="scss" scoped>

</style>
