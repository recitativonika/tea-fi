const Web3 = require('web3');
const wpolAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

module.exports = function(provider) {
  const web3 = new Web3(provider);
  return new web3.eth.Contract([
    {
      "constant": false,
      "inputs": [],
      "name": "deposit",
      "outputs": [],
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        { "name": "spender", "type": "address" },
        { "name": "value", "type": "uint256" }
      ],
      "name": "approve",
      "outputs": [{ "name": "", "type": "bool" }],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        { "name": "owner", "type": "address" },
        { "name": "spender", "type": "address" }
      ],
      "name": "allowance",
      "outputs": [{ "name": "", "type": "uint256" }],
      "type": "function"
    }
  ], wpolAddress);
};