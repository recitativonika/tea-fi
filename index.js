const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const contractABI = require('./src/abi');
const config = require('./config');
const headers = require('./src/headers');
const { verifyAccountIdentity, verifyWallet, claimOneTimeReward } = require('./src/walletconnect');

const rpcUrl = 'https://polygon.llamarpc.com';
const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
const wpolContract = require('./src/wpol')(web3.currentProvider);

const contractAddress = '0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1';
const spenderAddress = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const contract = new web3.eth.Contract(contractABI, contractAddress);
const amount = web3.utils.toWei(config.amountToWrap.toString(), 'ether');

function displayHeader() {
  const width = process.stdout.columns;
  const headerLines = [
    "<|============================================|>",
    " Tea-fi Bot ",
    " github.com/recitativonika ",
    "<|============================================|>"
  ];
  headerLines.forEach(line => {
    console.log(`\x1b[36m${line.padStart((width + line.length) / 2)}\x1b[0m`);
  });
}

async function claimDailyReward(walletAddress, walletNumber) {
  const url = `https://api.tea-fi.com/wallet/check-in/current?address=${walletAddress}`;
  try {
    const response = await Promise.race([
      axios.get(url, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    if (response.status === 200) {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Claim daily points success!`);
    }
  } catch (error) {
    let errorMessage = error.response ? error.response.data : error.message;
    if (errorMessage.includes('<title>504 Gateway Time-out</title>')) {
      errorMessage = '504 Gateway Time-out';
    }
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error claiming daily reward: ${errorMessage}`);
  }
}

async function approveWPOLIfNeeded(account, walletNumber) {
  try {
    const allowance = await wpolContract.methods.allowance(account.address, spenderAddress).call();
    const maxUint256 = '1461501637330902918203684832716283019655932542975';

    if (allowance < amount) {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Approving WPOL...`);
      const data = wpolContract.methods.approve(spenderAddress, maxUint256).encodeABI();
      const tx = {
        from: account.address,
        to: wpolContract.options.address,
        gas: 100000,
        data: data
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m WPOL approved with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);
    } else {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Sufficient WPOL allowance available.`);
    }
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error approving WPOL:`, error);
  }
}

async function isBalanceSufficient(account, requiredAmount, walletNumber) {
  try {
    const balance = await web3.eth.getBalance(account.address);
    const gasPrice = await web3.eth.getGasPrice();
    const estimatedGas = 2000000;
    const requiredGasFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(estimatedGas));

    if (web3.utils.toBN(balance).lt(web3.utils.toBN(requiredAmount).add(requiredGasFee))) {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Insufficient balance or gas fee for \x1b[33m${account.address}\x1b[0m. Skipping transaction.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error checking balance:`, error);
    return false;
  }
}

async function wrapTokens(account, walletNumber, numTransactions) {
  try {
    await approveWPOLIfNeeded(account, walletNumber);

    for (let i = 0; i < numTransactions; i++) {
      if (!(await isBalanceSufficient(account, amount, walletNumber))) {
        continue;
      }

      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Executing transaction ${i + 1} of ${numTransactions}`);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Converting ${web3.utils.fromWei(amount, 'ether')} WPOL to tPOL`);

      const data = contract.methods.wrap(amount, account.address).encodeABI();
      const tx = {
        from: account.address,
        to: contractAddress,
        gas: 2000000,
        data: data
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Transaction successful with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);

      const gasUsed = receipt.gasUsed;
      const gasPrice = await web3.eth.getGasPrice();
      const gasFeeAmount = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPrice)).toString();

      await verifyTransaction(receipt.transactionHash, account.address, gasFeeAmount, walletNumber);
    }
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error executing transaction:`, error);
  }
}

async function unwrapTokens(account, walletNumber) {
  try {
    const balance = await contract.methods.balanceOf(account.address).call();
    if (balance === '0') {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m No tPOL balance to unwrap. Skipping account.`);
      return;
    }

    if (!(await isBalanceSufficient(account, balance, walletNumber))) {
      return;
    }

    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Preparing to unwrap tokens and sending transaction...`);
    const data = contract.methods.unwrap(balance, account.address).encodeABI();
    const tx = {
      from: account.address,
      to: contractAddress,
      gas: 2000000,
      data: data
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Transaction successful with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error executing transaction:`, error);
  }
}

async function convertPOLToWPOL(account, walletNumber, polAmount) {
  try {
    const weiAmount = web3.utils.toWei(polAmount.toString(), 'ether');
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Converting ${polAmount} POL to WPOL...`);

    if (!(await isBalanceSufficient(account, weiAmount, walletNumber))) {
      return;
    }

    const data = wpolContract.methods.deposit().encodeABI();
    const tx = {
      from: account.address,
      to: wpolContract.options.address,
      value: weiAmount,
      gas: 100000,
      data: data
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Conversion successful with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error converting POL to WPOL:`, error);
  }
}

async function verifyTransaction(txHash, walletAddress, gasFeeAmount, walletNumber) {
  const url = 'https://api.tea-fi.com/transaction';
  const payload = {
    blockchainId: 137,
    fromAmount: amount,
    fromTokenAddress: wpolContract.options.address,
    fromTokenSymbol: "WPOL",
    gasFeeAmount: gasFeeAmount,
    gasFeeTokenAddress: "0x0000000000000000000000000000000000000000",
    gasFeeTokenSymbol: "POL",
    hash: txHash,
    toAmount: amount,
    toTokenAddress: contractAddress,
    toTokenSymbol: "tPOL",
    type: 2,
    walletAddress: walletAddress
  };

  try {
    const response = await axios.post(url, payload, { headers });
    const statusText = response.status === 201 ? '\x1b[32m(OK)\x1b[0m' : '';
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Verification Status: \x1b[33m${response.status}\x1b[0m ${statusText}, id: \x1b[33m${response.data.id}\x1b[0m, points: \x1b[32m${response.data.pointsAmount}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error verifying transaction:`, error.response ? error.response.data : error.message);
  }
}

async function displayVerifiedPoints(walletAddress, walletNumber) {
  const url = `https://api.tea-fi.com/points/${walletAddress}`;
  try {
    const response = await Promise.race([
      axios.get(url, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Wallet \x1b[33m${walletAddress}\x1b[0m Verified points (not pending): \x1b[32m${response.data.pointsAmount}\x1b[0m`);
  } catch (error) {
    const errorMessage = error.response ? error.response.statusText : error.message;
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error fetching verified points: ${errorMessage}`);
  }
}

async function executeMultipleTransactions(autoRestart = false, initialChoice = null, initialNumTransactions = 1, initialPolAmount = 0) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (!autoRestart) {
    rl.question('Do you want to auto-restart the process after completion? (y/n): ', async (restartAnswer) => {
      const autoRestart = restartAnswer.trim().toLowerCase();
      if (!['y', 'n'].includes(autoRestart)) {
        console.error('Invalid choice. Please enter "y" or "n".');
        rl.close();
        return;
      }

      await processTransactions(autoRestart === 'y', rl);
    });
  } else {
    await processTransactions(true, rl, initialChoice, initialNumTransactions, initialPolAmount);
  }
}

async function processTransactions(autoRestart, rl, initialChoice = null, initialNumTransactions = 1, initialPolAmount = 0) {
  let choice = initialChoice;
  let numTransactions = initialNumTransactions;
  let polAmount = initialPolAmount;

  if (!choice) {
    console.log('1. Convert POL to WPOL');
    console.log('2. Wrap WPOL to tPOL');
    console.log('3. Unwrap all tPOL to WPOL');
    console.log('4. Claim Daily Reward');
    console.log('5. Execute options 2, 3, and 4 sequentially');
    choice = await new Promise(resolve => {
      rl.question('Please select an option (1/2/3/4/5): ', resolve);
    });
  }

  if (!['1', '2', '3', '4', '5'].includes(choice)) {
    console.error('Invalid choice. Please enter "1", "2", "3", "4", or "5".');
    rl.close();
    return;
  }

  if (choice === '1' && !polAmount) {
    polAmount = await new Promise(resolve => {
      rl.question('How many POL would you like to convert to WPOL? (Example: 0.01) ', (answer) => {
        resolve(parseFloat(answer));
      });
    });
  } else if ((choice === '2' || choice === '5') && numTransactions === 1) {
    numTransactions = await new Promise(resolve => {
      rl.question('How many transactions would you like to execute per account? ', (answer) => {
        resolve(parseInt(answer, 10));
      });
    });
  }

  const privateKeys = fs.readFileSync(path.join(__dirname, 'priv.txt'), 'utf-8')
    .split('\n')
    .map(key => key.trim())
    .map(key => key.startsWith('0x') ? key.slice(2) : key)
    .filter(key => key.length === 64);

  if (privateKeys.length === 0) {
    console.error('No valid private keys found in priv.txt.');
    rl.close();
    return;
  }

  for (const [index, privateKey] of privateKeys.entries()) {
    const walletNumber = index + 1;
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);

    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Processing transactions for account: \x1b[32m${account.address}\x1b[0m`);

    if (!autoRestart || index === 0) {
      await verifyAccountIdentity(account.address);
      const referralCode = 'qaikt6';
      await verifyWallet(account.address, referralCode, walletNumber);
      await claimOneTimeReward(account.address);
    }

    if (choice === '1') {
      await convertPOLToWPOL(account, walletNumber, polAmount);
    } else if (choice === '2') {
      await wrapTokens(account, walletNumber, numTransactions);
    } else if (choice === '3') {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Executing unwrap transaction`);
      await unwrapTokens(account, walletNumber);
    } else if (choice === '4') {
      await claimDailyReward(account.address, walletNumber);
    } else if (choice === '5') {
      await wrapTokens(account, walletNumber, numTransactions);
      await unwrapTokens(account, walletNumber);
      await claimDailyReward(account.address, walletNumber);
    }

    await displayVerifiedPoints(account.address, walletNumber);
  }

  if (autoRestart) {
    const delay = config.autoRestartDelay;
    console.log(`Auto-restarting in ${delay} seconds...`);
    let countdown = delay;
    const countdownInterval = setInterval(() => {
      countdown -= 1;
      process.stdout.write(`\rAuto-restarting in ${countdown} seconds...`);
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        executeMultipleTransactions(true, choice, numTransactions, polAmount);
      }
    }, 1000);
  } else {
    rl.close();
  }
}

displayHeader();
executeMultipleTransactions();