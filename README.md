# Tea-fi Bot
Tea-fi Bot is a simple tool designed to automate the account registration, TX and daily reward claim interaction.

## Features
- **Automated TX interaction**
- **Auto claim daily rewards**
- **Auto connect/regist wallet/account**

## Prerequisites
- [Node.js](https://nodejs.org/) (version 14 or higher)

## Installation

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/recitativonika/tea-fi.git
   ```
2. Navigate to the project directory:
   ```bash
   cd tea-fi
   ```
4. Install the necessary dependencies:
   ```bash
   npm install
   ```

## Usage

1. Ensure you have POL (Matic) in your wallet, and you can register/connect your wallet in tea-fi in [this link](https://app.tea-fi.com/?ref=qaikt6
   ) or just put your priv key in `priv.txt`, the script will auto register/connect your account.
2. Set the `priv.txt` before running the script. Below how to setup this fie.
3. Modify the `priv.txt` file with your wallet priv key:
```
wallet1
wallet2
```
4. Set the `config.json` file for configuration
```aiignore
module.exports = {
  amountToWrap: 0.0001, // Amount WPOL to wrap/convert to tPOL
  autoRestartDelay: 21600 // Delay time in seconds for auto-restart
};
```
4. Run the script:
```bash
node index.js
```
5. Swap POL to WPOL first to process the option 2, 3, 4 and 5. You can swap manually or using option 1 in the script. If error, try swap WPOL to tPOL manually first in tea-fi website.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Note
This script only for testing purpose, using this script might violates ToS and may get your account permanently banned.

My reff code if you want to use :) : https://app.tea-fi.com/?ref=qaikt6

