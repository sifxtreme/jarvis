<template>
  <div>
    <div class='table-row'>
      <div>{{transaction.plaid_name}}</div>
      <div>{{transaction.merchant_name}}</div>
      <div>{{transaction.category}}</div>
      <div>{{transacted_at}}</div>
      <div>{{transaction.source}}</div>
      <div>{{transaction.hidden}}</div>
      <div>{{transaction.reviewed}}</div>
    </div>
    
  </div>
  
</template>

<script>

export default {
  props: { 
    transaction: {}
  },
  data: function() {
    return {
    }
  },
  computed: {
    transacted_at: function() {
      return this.transaction.transacted_at.split("T")[0]
    }
  }
}
</script>

<style lang="scss" scoped>
.table-row {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 3px;
  border: 1px solid black;
}

.table-row div:nth-child(1) {
  width: 20%;
}
.table-row div:nth-child(2) {
  width: 20%;
}
.table-row div:nth-child(3) {
  width: 20%;
}
.table-row div:nth-child(4) {
  width: 20%;
}
.table-row div:nth-child(5) {
  width: 10%;
}
.table-row div:nth-child(6) {
  width: 5%;
}
.table-row div:nth-child(0) {
  width: 5%;
}
</style>
