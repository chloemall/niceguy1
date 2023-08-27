const functions = require("firebase-functions");
const admin = require('firebase-admin');

admin.initializeApp();


  exports.deleteLike = functions.https.onCall(async (data, context) => { //delete function
    const category = data.category;
    const uniquevideoid = data.uniquevideoid;
    const uid = data.uid;

    return new Promise((resolve, reject) => {
        admin.firestore() .collection('contents')
        .doc("videos")
        .collection(category)
        .doc(uniquevideoid)
        .collection("videoLikes")
        .doc(uid).delete().then(async () => {
                    resolve("success");
            }).catch((exc) => {
                resolve('error');
            });
    });
});



exports.subscribeToUser = functions.https.onCall(async (data, context) => {
    const category = data.category;
    const uniqueuserid = data.uniqueuserid;
    const uid = data.uid;

    try {
        const userRef = admin.firestore()
            .collection('users')
            .doc("email")
            .collection(category)
            .doc(uniqueuserid);

        const subscriberRef = userRef.collection("subscribers").doc(uid);

        await subscriberRef.set({ subscribedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Update the subscriber count
        await userRef.update({ subscriberCount: admin.firestore.FieldValue.increment(1) });

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "An error occurred while subscribing." };
    }
});

exports.unsubscribeFromUser = functions.https.onCall(async (data, context) => {
    const category = data.category;
    const uniqueuserid = data.uniqueuserid;
    const uid = data.uid;

    try {
        const userRef = admin.firestore()
            .collection('users')
            .doc("email")
            .collection(category)
            .doc(uniqueuserid);

        const subscriberRef = userRef.collection("subscribers").doc(uid);

        await subscriberRef.delete();

        // Update the subscriber count
        await userRef.update({ subscriberCount: admin.firestore.FieldValue.increment(-1) });

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "An error occurred while unsubscribing." };
    }
});


exports.likeVideo = functions.https.onCall(async (data, context) => {
    const category = data.category;
    const uniquevideoid = data.uniquevideoid;
    const uid = data.uid;

    try {
        const videoRef = admin.firestore()
            .collection('contents')
            .doc("videos")
            .collection(category)
            .doc(uniquevideoid);

        const likedByField = `likedBy.${uid}`;
        const dislikedByField = `dislikedBy.${uid}`;

        const videoDoc = await videoRef.get();
        const videoData = videoDoc.data();

        if (videoData.dislikedBy && videoData.dislikedBy[uid]) {
            // User previously disliked, remove the dislike
            await videoRef.update({
                [dislikedByField]: admin.firestore.FieldValue.delete(),
                likeCount: admin.firestore.FieldValue.increment(1),
                dislikeCount: admin.firestore.FieldValue.increment(-1)
            });
        } else if (!videoData.likedBy || !videoData.likedBy[uid]) {
            // User has not liked before
            await videoRef.update({
                [likedByField]: true,
                likeCount: admin.firestore.FieldValue.increment(1)
            });
        }

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "An error occurred while liking the video." };
    }
});

exports.dislikeVideo = functions.https.onCall(async (data, context) => {
    const category = data.category;
    const uniquevideoid = data.uniquevideoid;
    const uid = data.uid;

    try {
        const videoRef = admin.firestore()
            .collection('contents')
            .doc("videos")
            .collection(category)
            .doc(uniquevideoid);

        const likedByField = `likedBy.${uid}`;
        const dislikedByField = `dislikedBy.${uid}`;

        const videoDoc = await videoRef.get();
        const videoData = videoDoc.data();

        if (videoData.likedBy && videoData.likedBy[uid]) {
            // User previously liked, remove the like
            await videoRef.update({
                [likedByField]: admin.firestore.FieldValue.delete(),
                likeCount: admin.firestore.FieldValue.increment(-1),
                dislikeCount: admin.firestore.FieldValue.increment(1)
            });
        } else if (!videoData.dislikedBy || !videoData.dislikedBy[uid]) {
            // User has not disliked before
            await videoRef.update({
                [dislikedByField]: true,
                dislikeCount: admin.firestore.FieldValue.increment(1)
            });
        }

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "An error occurred while disliking the video." };
    }
});




exports.payWithMpesa = functions.https.onCall(async (data, context) => {  //mpesa payment function

    const email = data.user_email;
    const amount = data.amount;
    const phone = data.phone;
     const timeStamp = data.timeStamp;
    //add other details you need from front end


    let password = new Buffer.from(`${businessShortCode}${passKey}${timeStamp}`).toString('base64');
    //businessShortCode, passKey,consumerKey ,consumerSecret from safaricom daraja portal.
    

    // get a base64 encoded string from a buffer
    let buf = new Buffer.from(consumerKey + ":" + consumerSecret).toString("base64");
  
    // authentication string
    let auth = `Basic ${buf}`;


    return new Promise((resolve, reject) => {
        axios.default.get(tokenurl, {
            headers: {
                Accept: "application/json",
                Authorization: auth
            }
        }).then((response) => {
            var accessToken = response.data.access_token
            return axios.default.post(payendpoint, {
                BusinessShortCode: businessShortCode,
                Password: password,
                Timestamp: timeStamp,
                Amount: amount,
                PartyA: phone,
                PartyB: businessShortCode,
                PhoneNumber: phone,
                CallBackURL: "callback link below to that function",
                AccountReference: "reference",
                TransactionDesc: "details",
                TransactionType: "CustomerPayBillOnline"
            }, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + accessToken
                }
            }).then((res) => {
                if (res.data.ResponseCode == "0") {
                    const initData = {
                        "email": email,
                        "transaction_type": "Payment with Mpesa",
                        "transaction_code": res.data.CheckoutRequestID,  //data to store in firebase before the transaction is complete
                        "phone": phone,
                        "status": "incomplete",
                        'amountkes': String(amount),
                    }

                   //function to store data in firestore
                   //return succesfull request to front end after sending a push message
                } else {
                    resolve("error");
                }
            })
                .catch((err) => {
                    resolve("error");
                })
        }).catch((err) => {
            resolve("error");
        })
    });
});



exports.callbackFunction = functions.https.onRequest(async (req, res) => {  //receives payment results from safaricom api

    const callbackData = req.body.Body.stkCallback;
    console.log("Received payload: ", callbackData);
    const responseCode = callbackData.ResultCode;
    const mCheckoutRequestID = callbackData.CheckoutRequestID;

    if (responseCode === 0) {
        const details = callbackData.CallbackMetadata.Item

        var mReceipt;
        var mPhonePaidFrom;
        var mAmountPaid;

        await details.forEach(entry => {
            switch (entry.Name) {
                case "MpesaReceiptNumber":
                    mReceipt = entry.Value
                    break;

                case "PhoneNumber":
                    mPhonePaidFrom = entry.Value
                    break;

                case "Amount":
                    mAmountPaid = entry.Value
                    break;

                default:
                    break;
            }
        })

       
//code to implement if successful
        

    } else {
    //code to implement if not successful
    }
    res.json({ 'result': 'Payment for ${mCheckoutRequestID} response received.' });

});