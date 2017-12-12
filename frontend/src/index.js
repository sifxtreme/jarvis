import React from 'react';
import { render } from 'react-dom';

import Paper from 'material-ui/Paper';
import Table, { TableBody, TableHead, TableRow, TableCell } from 'material-ui/Table';

import LoadingScreen from './LoadingScreen';
import TitleBar from './TitleBar';
import Controls from './Controls';

import TableSortHeader from './TableSortHeader';
import FinanceRow from './FinanceRow';


import { getFinancialTransactions, createFinancialTransaction, updateFinancialTransaction } from './api';

import { sortByKey, clone } from './utils';


import './index.css';


class FinancesTable extends React.Component {
  constructor() {
    super();

    this.state = {
      loading: true,
      allTransactions: [],
      displayedTransactions: [],
      currentSort: {
        key: null,
        orderAsc: true
      },
      currentFilters: {
        searchValue: "",
        month: 0,
        year: 0,
        showHidden: false,
        showPendingReviewOnly: false,
      },
      sortableColumns: ['plaid_name', 'merchant_name', 'category', 'amount', 'transacted_at'],
      otherColumns: ['source', 'hidden', 'reviewed', 'actions']
    }
  }

  componentDidMount() {
    getFinancialTransactions().then(data => {
      const transactions = data.results
      const filteredTransactions = this.filterTransactions(transactions, this.state.currentFilters)

      this.setState({
        loading: false,
        allTransactions: transactions,
        displayedTransactions: filteredTransactions
      })
    })
  }

  updateTransactions(newFilters, newSort, transactionsX = this.state.allTransactions) {
    const transactions = clone(transactionsX)

    // filter, then sort
    const filteredTransactions = this.filterTransactions(transactions, newFilters)
    const sortedTransactions = this.sortTransactions(filteredTransactions, newSort)

    this.setState({
      allTransactions: transactionsX,
      displayedTransactions: sortedTransactions,
      currentFilters: newFilters,
      currentSort: newSort
    })
  }

  filterTransactions(t0, newFilters) {
    let t1 = this.filterSearch(t0, newFilters.searchValue)
    let t2 = this.filterDate(t1, newFilters.month, newFilters.year)
    let t3 = this.filterHidden(t2, newFilters.showHidden)
    let t4 = this.filterReviewed(t3, newFilters.showPendingReviewOnly)

    return t4
  }

  filterSearch(transactions, searchValue) {
    return transactions.filter(function(transaction){
      if(transaction.id.toString().includes("-RANDOM")) return true
      if(searchValue === null || searchValue === "") return true

      let plaidName = transaction.plaid_name || ""
      let merchantName = transaction.merchant_name || ""
      let category = transaction.category || ""
      
      return plaidName.toLowerCase().includes(searchValue) || 
          merchantName.toLowerCase().includes(searchValue) || 
          category.toLowerCase().includes(searchValue)
    })
  }

  filterDate(transactions, month, year) {
    return transactions.filter(function(transaction){
      if(transaction.id.toString().includes("-RANDOM")) return true
      let show = true

      let date = new Date(transaction.transacted_at)

      if(month.toString() !== "0") {
        show = (date.getUTCMonth() + 1) === parseInt(month, 10)
      }
      else if(year.toString() !== "0") {
        // change this
        show = date.getUTCFullYear() === parseInt(year + 2015, 10)
      }

      return show      
    })
  }

  filterHidden(transactions, showHidden) {
    return transactions.filter(function(transaction){
      if(transaction.id.toString().includes("-RANDOM")) return true
      if(showHidden) return true
      return !transaction.hidden
    }) 
  }

  filterReviewed(transactions, showPendingReviewOnly) {
    return transactions.filter(function(transaction){
      if(transaction.id.toString().includes("-RANDOM")) return true
      if(showPendingReviewOnly) return !transaction.reviewed
      return true
    })  
  }

  sortTransactions(transactions, newSort) {
    if(!newSort.key) return transactions
    
    let sorted = sortByKey(transactions, newSort.key)

    if(!newSort.orderAsc) return sorted.reverse()

    return sorted
  }

  handleSearchBarChange = (event) => {
    const searchValue = event.target.value.toLowerCase()

    let newFilters = clone(this.state.currentFilters)
    newFilters.searchValue = searchValue

    this.updateTransactions(newFilters, this.state.currentSort)
  }

  handleSortColumnClick = (columnName) => {
    let currentSort = clone(this.state.currentSort)

    if(currentSort.key === columnName){
      currentSort.orderAsc = !currentSort.orderAsc
    }
    else {
      currentSort.key = columnName
      currentSort.orderAsc = true
    }

    this.updateTransactions(this.state.currentFilters, currentSort)
  }

  handleMonthChange = (event) => {
    let newFilters = clone(this.state.currentFilters)
    newFilters.month = event.target.value

    this.updateTransactions(newFilters, this.state.currentSort)
  }

  handleYearChange = (event) => {
    let newFilters = clone(this.state.currentFilters)
    newFilters.year = event.target.value

    this.updateTransactions(newFilters, this.state.currentSort)
  }

  handleHiddenChange = (event, booleanValue) => {
    let newFilters = clone(this.state.currentFilters)
    newFilters.showHidden = booleanValue

    this.updateTransactions(newFilters, this.state.currentSort)
  }

  handleReviewChange = (event, booleanValue) => {
    let newFilters = clone(this.state.currentFilters)
    newFilters.showPendingReviewOnly = booleanValue

    this.updateTransactions(newFilters, this.state.currentSort)
  }

  renderLoading() {
    return(<LoadingScreen/>)
  }

  // api save/edit operation
  saveItem = (data) => {
    let transactions = clone(this.state.allTransactions)
    let index = transactions.findIndex(transaction => transaction.id === data.id)

    // hit api here
    if(data.id.toString().includes("-RANDOM")) {
      createFinancialTransaction(data).then(serverData => {
        console.log("ADD SUCCESS")
        console.log(serverData)
        transactions.splice(index, 1, serverData)
        this.updateTransactions(this.state.currentFilters, this.state.currentSort, transactions)
      })
    }
    else {
      updateFinancialTransaction(data).then(serverData => {
        console.log("UPDATE SUCCESS")
        console.log(serverData)
        transactions.splice(index, 1, serverData)
        this.updateTransactions(this.state.currentFilters, this.state.currentSort, transactions)
      })
    }
  }

  // add, duplicate, delete rows
  addItem = () => {
    let transactions = clone(this.state.allTransactions)

    let x = {}
    x.id = `${Math.random()}-RANDOM`
    x.plaid_id = `USERGENERATED-${Math.random().toString(36).substring(2,13)}`
    x.editable = true

    transactions.splice(0, 0, x)

    this.updateTransactions(this.state.currentFilters, this.state.currentSort, transactions)
  }

  duplicateItem = (data) => {
    let transactions = clone(this.state.allTransactions)
    let index = transactions.findIndex(transaction => transaction.id === data.id)
    
    let x = clone(data)
    x.id = `${Math.random()}-RANDOM`
    x.plaid_id = data.plaid_id + "-1"
    x.editable = true
    transactions.splice(index, 0, x)

    this.updateTransactions(this.state.currentFilters, this.state.currentSort, transactions)
  }

  deleteItem = (data) => {
    let transactions = clone(this.state.allTransactions)
    let index = transactions.findIndex(transaction => transaction.id === data.id)

    transactions.splice(index, 1)

    this.updateTransactions(this.state.currentFilters, this.state.currentSort, transactions)
  }

  renderTable() {
    return (
      <div>
        <Controls
          handleSearchBarChange={this.handleSearchBarChange}
          handleMonthChange={this.handleMonthChange}
          handleYearChange={this.handleYearChange}
          handleHiddenChange={this.handleHiddenChange}
          handleReviewChange={this.handleReviewChange}
          addItem={this.addItem}
          transactions={this.state.displayedTransactions}
          month={this.state.currentFilters.month}
          year={this.state.currentFilters.year}
        />
        <br /><br />
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                {this.state.sortableColumns.map(columnName => <TableSortHeader key={columnName} columnName={columnName} handleClick={this.handleSortColumnClick}/>)}
                {this.state.otherColumns.map(columnName => <TableCell key={columnName}>{columnName}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {this.state.displayedTransactions.map(item => 
                <FinanceRow 
                  key={item.id} 
                  data={item} 
                  columns={this.state.columns} 
                  handleSave={this.saveItem}
                  handleDuplicate={this.duplicateItem}
                  handleDelete={this.deleteItem}
                  editable={item.editable}
                />
              )} 
            </TableBody>
          </Table>
        </Paper>
      </div>
    );
  }

  render() {
    return ( this.state.loading ? this.renderLoading() : this.renderTable() )
  }

}

class FinancesPage extends React.Component {
  render() {
    return (
      <Paper>
        <TitleBar/>
        <FinancesTable/>
      </Paper>
    )
  }
}

render(<FinancesPage/>, document.querySelector('#app'));
