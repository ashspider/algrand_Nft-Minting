const algosdk = require('algosdk');
const crypto = require('crypto');
const fs = require('fs').promises

const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        resolve()
    }))
}


const DISPENSERACCOUNT = "HZ57J3K46JIJXILONBBZOHX6BKPXEM2VVXNRFSUED6DKFD5ZD24PMJ3MVA";
async function createAsset(algodClient, alice) {
    console.log("");
    console.log("==> CREATE ASSET");
    //Check account balance    
    const accountInfo = await algodClient.accountInformation(alice.addr).do();
    const startingAmount = accountInfo.amount;
    console.log("Alice account balance: %d microAlgos", startingAmount);

    // Construct the transaction
    const params = await algodClient.getTransactionParams().do();
    

    
    const defaultFrozen = false;
    // Used to display asset units to user    
    const unitName = "ALICEART";
    // Friendly name of the asset    
    const assetName = "Alice's Artwork@arc3";
    // Optional string pointing to a URL relating to the asset
    const url = "https://s3.amazonaws.com/your-bucket/metadata.json";
    
    const managerAddr = alice.addr; 
    const reserveAddr = undefined;
    // Specified address can freeze or unfreeze user asset holdings   
    const freezeAddr = undefined;
    // Specified address can revoke user asset holdings and send 
    // them to other addresses    
    const clawbackAddr = undefined;

   
    const decimals = 0;
    const total = 1; // how many of this asset there will be

    
    const fullPath = __dirname + '/NFT/metadata.json';
    const metadatafile = (await fs.readFile(fullPath));

    const hash = crypto.createHash('sha256');
    hash.update(metadatafile);

    
    const metadata = new Uint8Array(hash.digest()); 

    const fullPathImage = __dirname + '/NFT/alice-nft.png';

    const metadatafileImage = (await fs.readFile(fullPathImage));
    const hashImage = crypto.createHash('sha256');
    hashImage.update(metadatafileImage);
    const hashImageBase64 = hashImage.digest("base64");
    const imageIntegrity = "sha256-" + hashImageBase64;

  
    console.log("image_integrity : " + imageIntegrity);


    // signing and sending "txn" allows "addr" to create an asset 
    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: alice.addr,
        total,
        decimals,
        assetName,
        unitName,
        assetURL: url,
        assetMetadataHash: metadata,
        defaultFrozen,
        freeze: freezeAddr,
        manager: managerAddr,
        clawback: clawbackAddr,
        reserve: reserveAddr,
        suggestedParams: params,
    });

    const rawSignedTxn = txn.signTxn(alice.sk);
    const tx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
    let assetID = null;
    // wait for transaction to be confirmed
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
    //Get the completed Transaction
    console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
    assetID = confirmedTxn["asset-index"];
    // console.log("AssetID = " + assetID);

    await printCreatedAsset(algodClient, alice.addr, assetID);
    await printAssetHolding(algodClient, alice.addr, assetID);
    console.log("You can verify the metadata-hash above in the asset creation details");
    console.log("Using terminal the Metadata hash should appear as identical to the output of");
    console.log("cat aliceAssetMetaData.json | openssl dgst -sha256 -binary | openssl base64 -A");
    console.log("That is: Cii04FOHWE4NiXQ4s4J02we2gnJop5dOfdkBvUoGHQ8=");

    return { assetID };

    
}

async function destroyAsset(algodClient, alice, assetID) {
    console.log("");
    console.log("==> DESTROY ASSET");
    
    const params = await algodClient.getTransactionParams().do();
    
    const addr = alice.addr;
    
    const txn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
        from: addr,
        note: undefined,
        assetIndex: assetID,
        suggestedParams: params
    });
    // The transaction must be signed by the manager which 
    // is currently set to alice
    const rawSignedTxn = txn.signTxn(alice.sk);
    const tx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
    // Wait for confirmation
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
    //Get the completed Transaction
    console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
    // The account3 and account1 should no longer contain the asset as it has been destroyed
    console.log("Asset ID: " + assetID);
    console.log("Alice = " + alice.addr);
    await printCreatedAsset(algodClient, alice.addr, assetID);
    await printAssetHolding(algodClient, alice.addr, assetID);

    return;
    
}
async function closeoutAliceAlgos(algodClient, alice) {
    console.log("");
    console.log("==> CLOSE OUT ALICE'S ALGOS TO DISPENSER");
    let accountInfo = await algodClient.accountInformation(alice.addr).do();
    console.log("Alice Account balance: %d microAlgos", accountInfo.amount);
    const startingAmount = accountInfo.amount;
    // Construct the transaction
    const params = await algodClient.getTransactionParams().do();
    
    const receiver = alice.addr;
    const enc = new TextEncoder();
    const amount = 0;
    const sender = alice.addr;
    // closeToRemainder will remove the assetholding from the account
    const closeRemainderTo = DISPENSERACCOUNT;
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: sender,
        to: receiver,
        amount,
        closeRemainderTo,
        note: undefined,
        suggestedParams: params
    });
    // Sign the transaction
    const rawSignedTxn = txn.signTxn(alice.sk);
    // Submit the transaction
    const tx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
    // Wait for confirmation
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
    //Get the completed Transaction
    console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
   
    accountInfo = await algodClient.accountInformation(alice.addr).do();
    let txAmount = confirmedTxn.txn.txn.amt;
    if (confirmedTxn.txn.txn.amt == undefined) {
        console.log("Transaction Amount: %d microAlgos", 0);
        txAmount = 0;
    }
    else {
        console.log("Transaction Amount: %d microAlgos", confirmedTxn.txn.txn.amt);

    }
    console.log("Transaction Fee: %d microAlgos", confirmedTxn.txn.txn.fee);
    const closeoutamt = startingAmount - txAmount - confirmedTxn.txn.txn.fee;
    console.log("Close To Amount: %d microAlgos", closeoutamt);
    console.log("Bobs Account balance: %d microAlgos", accountInfo.amount);
    return;
    
}

const createAccount = function () {
    try {
        
        const myaccount = algosdk.generateAccount();
        console.log("Account Address = " + myaccount.addr);
        let account_mnemonic = algosdk.secretKeyToMnemonic(myaccount.sk);
        console.log("Account Mnemonic = " + account_mnemonic);
        console.log("Account created. Save off Mnemonic and address");
        console.log("Add funds to account using the TestNet Dispenser: ");
        console.log("https://dispenser.testnet.aws.algodev.network/?account=" + myaccount.addr);

        return myaccount;
    }
    catch (err) {
        console.log("err", err);
    }
};



// Function used to print created asset for account and assetid
const printCreatedAsset = async function (algodClient, account, assetid) {
    
    let accountInfo = await algodClient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['created-assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['created-assets'][idx];
        if (scrutinizedAsset['index'] == assetid) {
            console.log("AssetID = " + scrutinizedAsset['index']);
            let myparms = JSON.stringify(scrutinizedAsset['params'], undefined, 2);
            console.log("parms = " + myparms);
            break;
        }
    }
};
// Function used to print asset holding for account and assetid
const printAssetHolding = async function (algodClient, account, assetid) {
    
    let accountInfo = await algodClient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['assets'][idx];
        if (scrutinizedAsset['asset-id'] == assetid) {
            let myassetholding = JSON.stringify(scrutinizedAsset, undefined, 2);
            console.log("assetholdinginfo = " + myassetholding);
            break;
        }
    }
};


async function createNFT() {

    try {
        let alice = createAccount();
        console.log("Press any key when the account is funded");
        await keypress();
       
        const algodToken = '2f3203f21e738a1de6110eba6984f9d03e5a95d7a577b34616854064cf2c0e7b';
        const algodServer = 'https://academy-algod.dev.aws.algodev.network';
        const algodPort = 443;

        let algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

        // CREATE ASSET
        const { assetID } = await createAsset(algodClient, alice);
        // DESTROY ASSET
        await destroyAsset(algodClient, alice, assetID);
        // CLOSEOUT ALGOS - Alice closes out Alogs to dispenser
        await closeoutAliceAlgos(algodClient, alice);


    }
    catch (err) {
        console.log("err", err);
    }
    process.exit();
};






createNFT();
