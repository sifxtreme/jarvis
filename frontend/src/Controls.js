import React from 'react';

import { FormLabel } from 'material-ui/Form';
import Switch from 'material-ui/Switch';
import TextField from 'material-ui/TextField';
import Button from 'material-ui/Button';
import Add from 'material-ui-icons/Add';
import Input from 'material-ui/Input';
import { MenuItem } from 'material-ui/Menu';
import Select from 'material-ui/Select';

import Paper from 'material-ui/Paper';
import Grid from 'material-ui/Grid';

export default class Controls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      years: ["--", 2016, 2017, 2018],
      months: ["--", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]
    }
  }
  
  getTotal() {
    let sum = this.props.transactions.reduce(function(accumulator, t) {
        return accumulator + parseFloat(t.amount || 0);
    }, 0);

    return sum.toLocaleString('en-US', {style: 'currency', currency: 'USD'})
  }

  render() {
    return (
      <Paper className="searchBar">
        <Grid container spacing={24}>
          <Grid item xs={2}>
            <FormLabel>TOTAL</FormLabel>
            <TextField type="disabled" value={this.getTotal()}></TextField>
          </Grid>
          <Grid item xs={2}>
            <FormLabel>SEARCH</FormLabel>
            <TextField onChange={this.props.handleSearchBarChange}/>
          </Grid> 
          <Grid item xs={2}>
            <FormLabel>DATE</FormLabel>
            <Select
              value={this.props.month}
              onChange={this.props.handleMonthChange}
              input={<Input name="month" id="month" />}
            >
              {this.state.months.map((month, index) => <MenuItem key={index} value={index}>{month}</MenuItem>)}
            </Select>
            <Select
              value={this.props.year}
              onChange={this.props.handleYearChange}
              input={<Input name="month" id="month" />}
            >
              {this.state.years.map((year, index) => <MenuItem key={year} value={index}>{year}</MenuItem>)}
            </Select>
            
          </Grid> 
          <Grid item xs={2}>
            <FormLabel>SHOW HIDDEN?</FormLabel>
            <Switch onChange={this.props.handleHiddenChange}/>
          </Grid> 
          <Grid item xs={2}>
            <FormLabel>NEEDS REVIEW?</FormLabel>
            <Switch onChange={this.props.handleReviewChange}/>
          </Grid>
          <Grid item xs={2}>
            <Button fab color="primary" onClick={this.props.addItem}><Add/></Button>
          </Grid> 
        </Grid>
      </Paper>
    )
  }
}