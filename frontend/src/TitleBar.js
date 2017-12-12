import React from 'react';
import AppBar from 'material-ui/AppBar';
import Toolbar from 'material-ui/Toolbar';
import Typography from 'material-ui/Typography';

export default function TitleBar(props) {
  return (
    <div>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography type="title" color="inherit">
            My Finances
          </Typography>
        </Toolbar>
      </AppBar>
    </div>
  );
}