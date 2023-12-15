import React from 'react';
import { withAuthenticator} from '@aws-amplify/ui-react';
import './App.css';

import Amplify from 'aws-amplify';
import awsconfig from './aws-exports';
import KYCContainer from './components/KYCContainer'

Amplify.configure(awsconfig);

function App() {
  return (
    <div>
        <KYCContainer />
    </div>
  );
}

export default withAuthenticator(App);
