<template>
  <v-app id="inspire">
    <v-navigation-drawer :clipped="$vuetify.breakpoint.lgAndUp" app right>
      <template>
        <v-row align="center">
          <v-col>
            <v-data-table
              class="summary-table"
              :headers="summaryHeaders"
              :items="categorySums"
              disable-pagination
              dense
            >
              <template v-slot:item.amount="props">${{ props.item.amount.toFixed(2) }}</template>
            </v-data-table>
          </v-col>
        </v-row>
      </template>
    </v-navigation-drawer>

    <v-navigation-drawer v-model="drawer" :clipped="$vuetify.breakpoint.lgAndUp" app>
      <v-list dense>
        <template>
          <form @submit.prevent="searchAPI">
            <v-row align="center">
              <v-col>
                <v-list-item>
                  <v-list-item-content>
                    <v-text-field type="month" v-model="monthYear" label="Month/Year"></v-text-field>
                    <v-text-field type="query" v-model="query" label="Search Query"></v-text-field>
                    <v-switch v-model="showHidden" label="Show Hidden?"></v-switch>
                    <v-switch v-model="showNeedsReview" label="Needs Review?"></v-switch>
                    <v-btn type="submit" color="success">Search</v-btn>
                  </v-list-item-content>
                </v-list-item>
              </v-col>
            </v-row>
          </form>
        </template>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      :clipped-left="$vuetify.breakpoint.lgAndUp"
      :clipped-right="$vuetify.breakpoint.lgAndUp"
      app
      color="green darken-3"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title style="width: 300px" class="ml-0 pl-4">
        <span>Jarvis Finances (${{ total.toFixed(2) }})</span>
      </v-toolbar-title>
    </v-app-bar>

    <v-content>
      <v-container class="fill-height" fluid>
        <v-layout row wrap>
          <v-data-table :headers="headers" :items="transactions" :loading="loading" disable-pagination>
            <template v-slot:item.review="props">
              <v-icon v-if="props.item.reviewed" color="green">mdi-eye</v-icon>
            </template>
            <template v-slot:item.amount="props">${{ props.item.amount.toFixed(2) }}</template>

            <template v-slot:item.transacted_at="props">{{ props.item.transacted_at.split('T')[0] }}</template>

            <template v-slot:item.actions="props">
              <v-icon color="green" @click="editItem(props.item)">mdi-pencil</v-icon>
            </template>
          </v-data-table>
        </v-layout>
      </v-container>
    </v-content>

    <v-btn bottom color="success" dark fab fixed right @click="dialog = !dialog">
      <v-icon>mdi-plus</v-icon>
    </v-btn>

    <v-dialog v-model="dialog" max-width="500px">
      <form @submit.prevent="saveItem">
        <v-card>
          <v-card-text>
            <v-container>
              <v-row>
                <v-col cols="12" sm="6" md="6">
                  <v-text-field v-model="editedItem.merchant_name" label="Merchant Name"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="6">
                  <v-text-field v-model="editedItem.category" label="Category"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="6">
                  <v-text-field type="number" step="0.01" v-model="editedItem.amount" label="Amount"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="6">
                  <v-text-field type="date" v-model="editedItem.transacted_at" label="Date"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="6">
                  <v-text-field v-model="editedItem.source" label="source"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="6">
                  <v-switch v-model="editedItem.hidden" label="Hidden?"></v-switch>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="success" text type="submit">Save</v-btn>
          </v-card-actions>
        </v-card>
      </form>
    </v-dialog>
  </v-app>
</template>

<script>
import { getFinancialTransactions, createFinancialTransaction, updateFinancialTransaction } from '../lib/api.js'

export default {
  created() {
    const today = new Date()
    this.monthYear = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`

    this.searchAPI()
  },
  computed: {
    month() {
      if (!this.monthYear) return null
      return this.monthYear.split('-')[1]
    },
    year() {
      if (!this.monthYear) return null
      return this.monthYear.split('-')[0]
    },
    total() {
      return this.transactions.reduce((acc, curr) => {
        const amount = curr.amount

        if (curr && curr.category && curr.category.includes('Income')) {
          acc += 0
        } else {
          acc += parseFloat(amount) || 0
        }

        return acc
      }, 0)
    },
    categorySums() {
      const sums = this.transactions.reduce((acc, curr) => {
        if (curr.hidden == 1) {
          return acc
        }
        const sum = (acc[curr.category] || 0) + (parseFloat(curr.amount) || 0)
        acc[curr.category] = sum
        return acc
      }, {})

      delete sums['']

      const sumOfCategories = Object.keys(sums).map(key => {
        let name = key
        if (name === 'null') name = 'Uncategorized'
        return {
          name: name,
          amount: sums[key]
        }
      })

      return sumOfCategories.sort((a, b) => {
        return a.amount > b.amount ? -1 : 1
      })
    }
  },
  methods: {
    closeDialog() {
      this.dialog = false
      this.editedItem = { ...this.defaultItem }
      this.editedIndex = -1
    },

    editItem(item) {
      this.editedIndex = this.transactions.indexOf(item)
      this.editedItem = { ...item, transacted_at: item.transacted_at.split('T')[0] }
      this.dialog = true
    },

    async saveItem() {
      const data = { ...this.editedItem }
      data.id ? await updateFinancialTransaction(data) : await createFinancialTransaction(data)
      await this.searchAPI()
      this.closeDialog()
    },

    async searchAPI() {
      this.loading = true

      const data = {
        year: this.year,
        month: this.month,
        show_hidden: this.showHidden,
        show_needs_review: this.showNeedsReview,
        query: this.query
      }

      const { results } = await getFinancialTransactions(data)
      this.loading = false

      this.transactions = results
    }
  },
  data: () => ({
    editedIndex: -1,
    editedItem: {
      id: null,
      plaid_name: '',
      merchant_name: '',
      category: '',
      amount: 0,
      transacted_at: new Date().toISOString().split('T')[0],
      source: 'cash',
      hidden: false,
      reviewed: true
    },
    defaultItem: {
      id: null,
      plaid_name: '',
      merchant_name: '',
      category: '',
      amount: 0,
      transacted_at: new Date().toISOString().split('T')[0],
      source: 'cash',
      hidden: false,
      reviewed: true
    },

    transactions: [],
    balances: [],

    query: '',
    monthYear: null,
    showNeedsReview: false,
    showHidden: false,

    loading: true,
    dialog: false,
    drawer: true,

    summaryHeaders: [
      { text: 'Amount', value: 'amount', align: 'right' },
      { text: 'Name', value: 'name' }
    ],

    headers: [
      {
        text: 'Reviewed',
        value: 'review',
        sortable: false
      },
      {
        text: 'Plaid Name',
        value: 'plaid_name'
      },
      {
        text: 'Merchant Name',
        value: 'merchant_name'
      },
      {
        text: 'Category',
        value: 'category'
      },
      {
        align: 'right',
        text: 'Amount',
        value: 'amount'
      },
      {
        text: 'Date',
        value: 'transacted_at'
      },
      {
        text: 'Source',
        value: 'source'
      },
      {
        text: 'Actions',
        value: 'actions'
      }
    ]
  })
}
</script>

<style lang="scss">
.v-data-table .v-data-footer {
  display: none;
}
.v-data-table {
  margin: 0 auto;
}
.layout.row.wrap.align-center {
  margin: 0 auto;
}
.summary-table {
  margin-top: 20px;
}
</style>
