use nvm to switch to node 16.x before runnnig npm i && npm start


Before running npm install, you need to execute the following command in the terminal to set a parameter for Node.js:

export NODE_OPTIONS=--openssl-legacy-provider #if you have issues

Additionally, if you have copied the package.json file for the first time, instead of running npm install directly, you should first install React 17 with the following command:

npm install react@17 react-dom@17

After that, you can install the remaining packages by running:

npm install

You also need to integrate the necessary information into your application using:

amplify init

Make sure you have aws cli configured correctly before amplify init

https://catalog.us-east-1.prod.workshops.aws/workshops/2b414187-7e55-4729-a998-c698d9429876/en-US/30-adding-auth/10-adding-auth-back
