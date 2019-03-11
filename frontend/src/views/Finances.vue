<template>
  <div>
    <el-container style="border: 1px solid #eee">
      <el-aside width="160px" style="background-color: rgb(238, 241, 246)">
        <el-menu :default-openeds="['1']">
          <form @submit.prevent="searchAPI">
            <el-submenu index="1">
              <template slot="title">
                <h2>Search</h2>
              </template>
              <el-menu-item-group>
                <el-input placeholder="Search" v-model="query"></el-input>
              </el-menu-item-group>
              <el-menu-item-group>
                <el-select v-model="selectedYear" placeholder="Year">
                  <el-option v-for="year in years" :key="year" :label="year" :value="year"></el-option>
                </el-select>
                <el-select v-model="selectedMonth" placeholder="Year">
                  <el-option
                    v-for="month in months"
                    :key="month.name"
                    :label="month.name"
                    :value="month.value"
                  ></el-option>
                </el-select>
              </el-menu-item-group>
              <el-menu-item-group>
                <el-switch v-model="showHidden" inactive-text="SHOW HIDDEN?"></el-switch>
                <br>
                <br>
                <el-switch v-model="showNeedsReview" inactive-text="NEEDS REVIEW?"></el-switch>
              </el-menu-item-group>
              <el-menu-item-group>
                <button style="display:none;" type="submit">Submit</button>
                <el-button type="submit" @click="searchAPI">Search</el-button>
              </el-menu-item-group>
            </el-submenu>
          </form>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header></el-header>

        <el-main>
          <h2>
            Transactions
            <span>(${{total.toLocaleString()}})</span>
          </h2>
          <el-table
            border
            stripe
            :data="transactions"
            :row-class-name="tableRowClassName"
            :cell-class-name="cellClassName"
          >
            <el-table-column sortable prop="plaid_name" label="Plaid Name">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">{{scope.row.plaid_name}}</span>
                <el-input v-if="scope.row.editMode" v-model="scope.row.plaid_name"></el-input>
              </template>
            </el-table-column>

            <el-table-column sortable prop="merchant_name" label="Merchant Name">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">{{scope.row.merchant_name}}</span>
                <el-input v-if="scope.row.editMode" v-model="scope.row.merchant_name"></el-input>
              </template>
            </el-table-column>

            <el-table-column sortable prop="category" label="Category">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">{{scope.row.category}}</span>
                <el-input v-if="scope.row.editMode" v-model="scope.row.category"></el-input>
              </template>
            </el-table-column>

            <el-table-column sortable prop="amount" label="Amount">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">{{Number(scope.row.amount).toFixed(2)}}</span>
                <el-input v-if="scope.row.editMode" type="number" v-model="scope.row.amount"></el-input>
              </template>
            </el-table-column>

            <el-table-column sortable prop="transacted_at" label="Date">
              <template slot-scope="scope">
                <span
                  v-if="!scope.row.editMode"
                >{{new Date(scope.row.transacted_at).toISOString().substring(0, 10)}}</span>
                <el-input v-if="scope.row.editMode" type="date" v-model="scope.row.transacted_at"></el-input>
              </template>
            </el-table-column>

            <el-table-column sortable prop="source" label="Source">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">{{scope.row.source}}</span>
                <el-input v-if="scope.row.editMode" v-model="scope.row.source"></el-input>
              </template>
            </el-table-column>

            <el-table-column label="Metadata">
              <template slot-scope="scope">
                <span v-if="!scope.row.editMode">
                  Hidden: {{scope.row.hidden}}
                  <br>
                  Reviewed: {{scope.row.reviewed}}
                </span>
                <span v-if="scope.row.editMode">
                  <el-switch v-model="scope.row.hidden"></el-switch>Hidden
                  <br>
                  <el-switch v-model="scope.row.reviewed"></el-switch>Reviewed
                </span>
              </template>
            </el-table-column>

            <el-table-column label="Actions">
              <template slot-scope="scope">
                <el-button
                  v-if="!scope.row.editMode"
                  type="primary"
                  @click="editItem(scope.row.id)"
                >{{ scope.row.id ? "Edit" : "Add"}}</el-button>
                <el-button
                  v-if="scope.row.editMode"
                  type="primary"
                  @click="saveItem(scope.row)"
                >{{ scope.row.id ? "Save" : "Add"}}</el-button>
              </template>
            </el-table-column>
          </el-table>

          <h2>Categories Summary</h2>
          <el-table border stripe :data="categorySums">
            <el-table-column width="150" sortable prop="name" label="Name"></el-table-column>
            <el-table-column width="150" sortable prop="amount" label="Amount">
              <template slot-scope="scope">{{scope.row.amount.toFixed(2)}}</template>
            </el-table-column>
          </el-table>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import {
  getFinancialTransactions,
  createFinancialTransaction,
  updateFinancialTransaction
} from "../lib/api.js";
import { Loading } from "element-ui";

export default {
  data: function() {
    return {
      transactions: [],
      balances: [],
      query: "",
      years: [null, 2016, 2017, 2018, 2019, 2020],
      showNeedsReview: false,
      showHidden: false,
      months: [
        { value: null, name: "" },
        { value: 1, name: "Jan (01)" },
        { value: 2, name: "Feb (02)" },
        { value: 3, name: "Mar (03)" },
        { value: 4, name: "Apr (04)" },
        { value: 5, name: "May (05)" },
        { value: 6, name: "Jun (06)" },
        { value: 7, name: "Jul (07)" },
        { value: 8, name: "Aug (08)" },
        { value: 9, name: "Sep (09)" },
        { value: 10, name: "Oct (10)" },
        { value: 11, name: "Nov (11)" },
        { value: 12, name: "Dec (12)" }
      ],
      selectedYear: 2019,
      selectedMonth: 3,
      loading: true
    };
  },
  created: async function() {
    const today = new Date();
    this.selectedYear = today.getFullYear();
    this.selectedMonth = today.getMonth() + 1;

    this.searchAPI();
  },
  computed: {
    total() {
      return this.transactions.reduce((acc, curr) => {
        acc += parseFloat(curr.amount) || 0;
        return acc;
      }, 0);
    },
    categorySums() {
      const sums = this.transactions.reduce((acc, curr) => {
        if (curr.hidden == 1) {
          return acc;
        }
        const sum = (acc[curr.category] || 0) + (parseFloat(curr.amount) || 0);
        acc[curr.category] = sum;
        return acc;
      }, {});

      delete sums[""];

      return Object.keys(sums)
        .map(key => {
          let name = key;
          if (name === "null") name = "Uncategorized";
          return {
            name: name,
            amount: sums[key]
          };
        })
        .sort(function(a, b) {
          return a.amount > b.amount ? -1 : 1;
        });
    }
  },
  methods: {
    async saveItem(data) {
      data.id
        ? await updateFinancialTransaction(data)
        : await createFinancialTransaction(data);
      await this.searchAPI();
    },
    async editItem(id) {
      const newTransactions = [...this.transactions];

      const transactionIndex = newTransactions.findIndex(el => el.id === id);
      const transaction = newTransactions[transactionIndex];

      transaction.editMode = true;

      this.transactions = newTransactions;
    },
    async searchAPI() {
      let loadingInstance = Loading.service({ fullscreen: true });

      const data = {
        year: this.selectedYear,
        month: this.selectedMonth,
        show_hidden: this.showHidden,
        show_needs_review: this.showNeedsReview,
        query: this.query
      };

      let [transactions] = await Promise.all([getFinancialTransactions(data)]);

      transactions = transactions["results"];
      transactions.unshift(this.defaultTransaction());

      this.transactions = transactions;

      loadingInstance.close();
    },
    tableRowClassName({ row }) {
      if (!row.category) return "row-no-category";
      if (!row.reviewed) return "row-not-reviewed";
      return "";
    },
    cellClassName({ column }) {
      if (column.label == "Amount") return "right-align";
      return "";
    },
    defaultTransaction() {
      return {
        plaid_name: "",
        merchant_name: "",
        category: "",
        amount: 0,
        transacted_at: null,
        hidden: false,
        reviewed: false,
        editMode: true
      };
    }
  }
};
</script>

<style lang="scss">
.el-header {
  background-color: teal;
  color: #333;
  line-height: 60px;
}

.el-aside {
  color: #333;

  .el-button {
    margin-top: 10px;
  }
}

.el-menu {
  padding: 5px;
  padding-left: 5px !important;
}

.right-align {
  text-align: right !important;
}

.row-no-category,
.row-not-reviewed {
  background-color: #b3f0d1 !important;

  td {
    background-color: #b3f0d1 !important;
  }
}
</style>
