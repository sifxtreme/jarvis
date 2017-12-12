import React from 'react';

import { CircularProgress } from 'material-ui/Progress';

export default () => (
  <div className="centerFullScreen">
    <CircularProgress className="loading" size={100}/>
  </div>
);