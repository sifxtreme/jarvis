<template>
  <div class='table-row' :class="[transactionData.class_name]">
    <div><input type="text" v-model="transactionData.plaid_name" /></div>
    <div><input type="text" v-model="transactionData.merchant_name" /></div>
    <div><input type="text" v-model="transactionData.category" /></div>
    <div><input class="input-number" type="number" v-model="transactionData.amount" /></div>
    <div><input type="date" v-model="transactionData.transacted_at" /></div>
    <div><input type="text" v-model="transactionData.source" /></div>
    <div><input type="checkbox" v-model="transactionData.hidden" /></div>
    <div><input type="checkbox" v-model="transactionData.reviewed" /></div>
    <div><button>Save</button></div>
  </div>
</template>

<script>

export default {
  props: { 
    transaction: {}
  },
  data: function() {
    return {
      transactionData: {}
    }
  },
  computed: {
    // transacted_at: function() {
    //   return this.transactionData.transacted_at.split("T")[0]
    // }
  },
  created: function(){
    let data = this.transaction;
    data.transacted_at = data.transacted_at.split("T")[0]
    data.class_name = String(data.category).replace(/ /g,"_")
    data.amount = Number(data.amount).toFixed(2);

    this.transactionData = data;
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

input {
  padding: 0;
  margin: 0;
  width: 100%
}

.input-number {
  text-align: right;
}

.table-row div:nth-child(1) {
  width: 20%;
}
.table-row div:nth-child(2) {
  width: 20%;
}
.table-row div:nth-child(3) {
  width: 15%;
}
.table-row div:nth-child(4) {
  width: 10%;
}
.table-row div:nth-child(5) {
  width: 10%;
}
.table-row div:nth-child(6) {
  width: 10%;
}
.table-row div:nth-child(7) {
  width: 5%;
}
.table-row div:nth-child(8) {
  width: 5%;
}
.table-row div:nth-child(9) {
  width: 5%;
}
</style>
