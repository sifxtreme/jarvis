import React from 'react';

import { TableCell, TableRow } from 'material-ui/Table';

import Hidden from 'material-ui/Hidden';
import TextField from 'material-ui/TextField';
import Switch from 'material-ui/Switch';
import IconButton from 'material-ui/IconButton';
import Save from 'material-ui-icons/Save';
import ContentCopy from 'material-ui-icons/ContentCopy';
import ModeEdit from 'material-ui-icons/ModeEdit';
import Cancel from 'material-ui-icons/Cancel';

import { clone } from './utils';

export default class FinanceRow extends React.Component {
  constructor(props) {
    super(props);
    
    const editable = props.editable || false

    this.state = {
      editMode: editable,
      form: this.getFormData(props)
    }
  }

  getFormData(originalProps) {
    let props = clone(originalProps)

    let id = props.data.id || ""
    let amount = props.data.amount || 0 
    let transacted_at = this.formatDateTime(props.data.transacted_at)

    let form = {
      id: id,
      plaid_id: props.data.plaid_id,
      plaid_name: props.data.plaid_name,
      merchant_name: props.data.merchant_name || "",
      category: props.data.category || "",
      amount: amount.toString(),
      transacted_at: transacted_at,
      source: props.data.source || "",
      hidden: props.data.hidden,
      reviewed: props.data.reviewed,
    }

    return form
  }

  formatCurrency(numberString) {
    return parseFloat(numberString).toFixed(2)
  }

  formatDateTime(dateTimeString) {
    let d = new Date(Date.parse(dateTimeString))
    let date = d.getUTCDate()
    if(date < 10) date = "0" + date
    let month = d.getUTCMonth() + 1
    if(month < 10) month = "0" + month
    const dateString = `${d.getUTCFullYear()}-${month}-${date}`
    return dateString
  }

  formatBoolean(boolean) {
    if(boolean) return "True"
    return "False"
  }

  formatId(id) {
    if(id) return id.toString()
    return ""
  }

  convertClassName(obj) {
    const str = obj.category
    if(obj.hidden) return "hidden"
    if(!str) return "needsCategory"
    return str
      .replace(/\s(.)/g, function($1) { return $1.toUpperCase(); })
      .replace(/\s/g, '')
      .replace(/^(.)/, function($1) { return $1.toLowerCase(); });
  }

  enterEditMode = () => {
    this.setState({
      editMode: !this.state.editMode,
      form: this.getFormData(this.props)
    })
  }

  saveData = () => {
    let form = this.state.form

    this.props.handleSave(form)

    this.setState({
      editMode: !this.state.editMode
    })
  }

  duplicateData = () => {
    let data = this.props.data
    this.props.handleDuplicate(data)
  }

  cancel = () => {
    if(this.props.data.id.toString().includes("RANDOM")) {
      let data = this.props.data
      this.props.handleDelete(data)
    }
    else {
      this.setState({
        editMode: !this.state.editMode
      })
    }
  }

  handleChange = (event) => {
    let value = event.target.value
    if(event.target.type === "checkbox"){
      value = (event.target.value === "on" ? true : false)
    }

    let formState = this.state.form
    formState[event.target.name] = value

    this.setState({
      form: formState
    })
  }

  renderRow() {
    return (
      <TableRow key={this.props.data.id} className={this.convertClassName(this.props.data)}>
        <TableCell>{this.props.data.plaid_name}</TableCell>
        <TableCell>{this.props.data.merchant_name}</TableCell>
        <TableCell>{this.props.data.category}</TableCell>
        <TableCell numeric>{this.formatCurrency(this.props.data.amount)}</TableCell>
        <TableCell>{this.formatDateTime(this.props.data.transacted_at)}</TableCell>
        <TableCell>{this.props.data.source}</TableCell>
        <TableCell>{this.formatBoolean(this.props.data.hidden)}</TableCell>
        <TableCell>{this.formatBoolean(this.props.data.reviewed)}</TableCell>
        <TableCell>
          <IconButton color="primary" onClick={this.enterEditMode}><ModeEdit/></IconButton>
          <IconButton color="primary" onClick={this.duplicateData}><ContentCopy/></IconButton>
        </TableCell>
      </TableRow>
    )
  }

  renderForm() {
    return (
      <TableRow key={this.props.data.id}>
          <TableCell>{this.props.data.plaid_name}</TableCell>
          <Hidden xsUp>
            <TextField value={this.state.form.id.toString()}></TextField>
            <TextField value={this.state.form.plaid_id}></TextField>
            <TextField value={this.state.form.plaid_name}></TextField>
          </Hidden>
          <TableCell><TextField onChange={this.handleChange} type="text" name="merchant_name" value={this.state.form.merchant_name}></TextField></TableCell>
          <TableCell><TextField onChange={this.handleChange} type="text" name="category" value={this.state.form.category}></TextField></TableCell>
          <TableCell><TextField onChange={this.handleChange} type="number" name="amount" value={this.state.form.amount}></TextField></TableCell>
          <TableCell><TextField onChange={this.handleChange} type="date" name="transacted_at" value={this.state.form.transacted_at}></TextField></TableCell>
          <TableCell><TextField onChange={this.handleChange} type="text" name="source" value={this.state.form.source}></TextField></TableCell>
          <TableCell><Switch onChange={this.handleChange} name="hidden" checked={this.state.form.hidden}></Switch></TableCell>
          <TableCell><Switch onChange={this.handleChange} name="reviewed" checked={this.state.form.reviewed}></Switch></TableCell>
          <TableCell>
            <IconButton color="primary" onClick={this.saveData}><Save/></IconButton>
            <IconButton color="primary" onClick={this.cancel}><Cancel/></IconButton>
          </TableCell>
      </TableRow>
    )
  }

  render() {
    return ( this.state.editMode ? this.renderForm() : this.renderRow() )
  }
}