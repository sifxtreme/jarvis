<template>
  <div>
    <el-container style="border: 1px solid #eee">
      <el-header class="balance-header">Total Balances</el-header>
      <el-table :data="balancesWithTotal" style="width: 100%">
        <el-table-column prop="name" label="Name" width="180"> </el-table-column>
        <el-table-column prop="balance" align="right" label="Balance"> </el-table-column>
      </el-table>
    </el-container>
  </div>
</template>

<script>
import { getBalances } from '../lib/api.js'

export default {
  data: function() {
    return {
      balances: []
    }
  },
  computed: {
    balancesWithTotal() {
      return [...this.balances, { name: 'Total', balance: this.totalBalance }]
    },
    totalBalance() {
      return this.balances.reduce((acc, curr) => {
        return acc + curr.balance
      }, 0)
    }
  },
  created: async function() {
    this.balances = await getBalances()
  },
  methods: {}
}
</script>

<style lang="scss" scoped>
.balance-header {
  font-weight: bold;
  color: white;
}
</style>
