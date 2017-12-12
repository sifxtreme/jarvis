import React from 'react';

import Button from 'material-ui/Button';

class ButtonBase2 extends React.Component {
  render() {
    return(
      <Button onClick={this.props.myClick}>
        Hello
      </Button>
    )  
  }  
} 

class ButtonBase1 extends React.Component {
  render() {
    return(<ButtonBase2 myClick={this.props.myClick}/>)  
  }  
}

export default class ButtonBase extends React.Component {
  render() {
    return(<ButtonBase1 myClick={this.props.myClick}/>)  
  }  
};