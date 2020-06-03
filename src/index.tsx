import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App/index';
import record from './record/h5BaseRecord';

record();

ReactDOM.render(<App />, document.getElementById('root'));
