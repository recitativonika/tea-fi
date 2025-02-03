const axios = require('axios');
const headers = require('./headers');

async function verifyAccountIdentity(walletAddress) {
  const url = `https://rpc.walletconnect.org/v1/identity/${walletAddress}?projectId=c4c07616f2ce534e3f61779c51f3d3aa&sender=${walletAddress}`;
  try {
    await Promise.race([
      axios.get(url, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
  } catch (error) {

  }
}

async function verifyWallet(walletAddress, referralCode, walletNumber) {
  const url = 'https://api.tea-fi.com/referrals';
  const payload = {
    address: walletAddress,
    code: referralCode
  };

  try {
    await Promise.race([
      axios.post(url, payload, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Success verify/register wallet \x1b[33m${walletAddress}\x1b[0m`);
  } catch (error) {
    if (error.response && error.response.data.message === 'Already referred!') {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Error verify/register wallet \x1b[33m${walletAddress}\x1b[0m, already registered!`);
    }
  }
}

async function claimOneTimeReward(walletAddress) {
  const url = 'https://api.tea-fi.com/points/one-time-action';
  const payload = {
    action: 0,
    walletAddress: walletAddress
  };

  try {
    await Promise.race([
      axios.post(url, payload, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
  } catch (error) {

  }
}

module.exports = {
  verifyAccountIdentity,
  verifyWallet,
  claimOneTimeReward
};