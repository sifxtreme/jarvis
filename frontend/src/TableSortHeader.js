import React from 'react';

import { TableCell } from 'material-ui/Table';

export default class TableSortHeader extends React.Component {
  handleClick = () => {
    this.props.handleClick(this.props.columnName)
  }

  render() {
    return (
      <TableCell onClick={this.handleClick}>{this.props.columnName}</TableCell>
    )
  }
}