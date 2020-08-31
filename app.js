const express = require('express')
const readXlsxFile = require('read-excel-file/node');
const hbs = require('hbs');

const app = express()

const {
  resolve
} = require('path');
// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({
  path: './.env'
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


app.use(express.static(process.env.STATIC_DIR));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

hbs.registerPartials(__dirname + '/views/partials');

hbs.registerHelper('match', function(val1,val2) {
  // console.log(val1,val2);
  return val1.toUpperCase() == val2.toUpperCase() ? true : false;
})

app.get('/', function (req, res) {
  res.status(200).render('index.hbs');
})

app.get('/blogstreak', (req,res) => {

  readXlsxFile(__dirname+'/static/1.quranDaily.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0);

    sorted = sorted.map(val => {
      if (!val.Content) return;
      val.Content = val.Content.split('\r\n').map(val => {
        // console.log(val, val.split(': ')[0].indexOf('.'));
        return {
          type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
          msg: val.split(': ')[1].trim(),
          class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[1] : ''
        }
      });
      return val;
    })
    let days = [];
    for (var i = 1; i <= sorted.length; i++) {
      // console.log(sorted[0]);
      // console.log(req.session.token, req.session.hasOwnProperty('token'));
      days.push({
        index: i,
        data: sorted[i-1] != undefined ? 'active' : 'inactive',
        locked: (sorted.length - i) < 3 || ''
      })
    };

    res.status(200).render('blogstreak.hbs', {
      data: sorted,
      days,
      // token: req.session.token,
      note: req.note
    });
  })
})

app.get('/blogpost', (req,res,next) => {

  // req.query.serialNo

  readXlsxFile(__dirname+'/static/1.quranDaily.xlsx').then((rows) => {

    // console.log(req.query.serialNo,rows.length, req.session.hasOwnProperty('token'), req.query.serialNo < (rows.length - 4) && req.session.hasOwnProperty('token') == false);

    // if (req.query.serialNo < (rows.length - 4) && req.session.hasOwnProperty('token') == false && freeBlogs(req.query.serialNo)) {
    //   req.url = `/quranDaily`;
    //   req.note = `Article ${req.query.serialNo} is a premium article. Please join the community to read this article.`;
    //   return app._router.handle(req, res, next);
    // }


    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0 && val.Ser == req.query.serialNo);

    sorted = sorted.map(val => {
      if (!val.Content) return;
      val.Content = val.Content.split('\r\n').map(val => {
        // console.log(val);
        return {
          type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
          msg: val.split(': ')[1].trim(),
          class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.').slice(1,4).join(' ') : ''
        }
      });
      val.Date = val.Date.toString().split(' ').slice(1,3).join(' ')
      return val;
    })


    res.render('blogpost.hbs',{
      data: sorted[0],
      tags: sorted[0].Tags.split(',')
    });
  })
})

app.get('/linkMedium', (req,res) => {
  res.status(200).render('linkMedium.hbs');
})

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  const {
    sessionId
  } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {
  const domainURL = process.env.DOMAIN;

  const {
    quantity,
    locale,
    userInput
  } = req.body;
  console.log(userInput);
  // Create new Checkout Session for the order
  // Other optional params include:
  // [billing_address_collection] - to display billing address details on the page
  // [customer] - if you have an existing Stripe Customer ID
  // [customer_email] - lets you prefill the email input in the Checkout page
  // For full details see https://stripe.com/docs/api/checkout/sessions/create
  const session = await stripe.checkout.sessions.create({
    payment_method_types: process.env.PAYMENT_METHODS.split(', '),
    mode: 'subscription',
    locale: locale,
    line_items: [{
      price: process.env.PRICE,
      quantity: quantity
    }],
    // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
    // payment_intent_data: {
    //   metadata: {
    //     userInput: userInput
    //   },
    // },
    success_url: `${domainURL}/profile?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domainURL}/`,
  });

  res.send({
    sessionId: session.id,
  });
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'checkout.session.completed') {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.get('/config', async (req, res) => {
  const price = await stripe.prices.retrieve(process.env.PRICE);

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    unitAmount: price.unit_amount,
    currency: price.currency,
  });
});

app.get('/profile', (req,res) => {
  return res.status(200).render('profile.hbs')
})


app.listen(3000)
