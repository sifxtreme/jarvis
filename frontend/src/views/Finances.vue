<template>
  <div>
    <el-container style="border: 1px solid #eee">
      <el-aside width="200px" style="background-color: rgb(238, 241, 246)">
        <el-menu :default-openeds="['1']">
          <el-submenu index="1">
            <template slot="title">
              <i class="el-icon-menu"></i>Search
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
              <el-switch v-model="showNeedsReview" inactive-text="NEEDS REVIEW?"></el-switch>
            </el-menu-item-group>
            <el-menu-item-group>
              <el-button type="primary" @click="searchAPI">Search</el-button>
            </el-menu-item-group>
            <el-menu-item-group>${{total.toLocaleString()}}</el-menu-item-group>
          </el-submenu>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header style="text-align: right">
          <span>Finances</span>
        </el-header>

        <el-main>
          <el-table
            border
            stripe
            :data="transactions"
            :row-class-name="tableRowClassName"
            :cell-class-name="cellClassName"
          >
            <el-table-column sortable prop="plaid_name" label="Plaid Name"></el-table-column>
            <el-table-column sortable prop="merchant_name" label="Merchant Name"></el-table-column>
            <el-table-column sortable prop="category" label="Category"></el-table-column>
            <el-table-column sortable prop="amount" label="Amount">
              <template slot-scope="scope">{{Number(scope.row.amount).toFixed(2)}}</template>
            </el-table-column>
            <el-table-column sortable prop="transacted_at" label="Date">
              <template slot-scope="scope">{{scope.row.transacted_at.split("T")[0]}}</template>
            </el-table-column>
            <el-table-column sortable prop="source" label="Source"></el-table-column>
            <el-table-column label="Metadata">
              <template slot-scope="scope">
                Hidden: {{scope.row.hidden}}
                <br>
                Reviewed: {{scope.row.reviewed}}
              </template>
            </el-table-column>
          </el-table>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import { getFinancialTransactions } from "../lib/api.js";
import { Loading } from "element-ui";

export default {
  data: function() {
    return {
      transactions: [],
      categories: [],
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
      selectedMonth: 2,
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
    }
  },
  methods: {
    async searchAPI() {
      let loadingInstance = Loading.service({ fullscreen: true });

      const data = {
        year: this.selectedYear,
        month: this.selectedMonth,
        show_hidden: this.showHidden,
        show_needs_review: this.showNeedsReview,
        query: this.query
      };

      const [transactions] = await Promise.all([
        getFinancialTransactions(data)
      ]);

      this.transactions = transactions["results"];

      loadingInstance.close();
    },
    tableRowClassName({ row }) {
      if (!row.category) return "row-no-category";
      if (!row.reviewed) return "row-not-reviewed";
      return "";
    },
    cellClassName({ columnIndex }) {
      if (columnIndex == "3") return "right-align";
      return "";
    }
  }
};
</script>

<style lang="scss">
.el-header {
  background-color: #b3c0d1;
  color: #333;
  line-height: 60px;
}

.el-aside {
  color: #333;
}

.el-menu {
  padding: 5px;
  padding-left: 5px !important;
}

.right-align {
  text-align: right !important;
}
</style>
