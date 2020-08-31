const express = require('express')
const readXlsxFile = require('read-excel-file/node');
const hbs = require('hbs');

const app = express()

hbs.registerHelper('match', function(val1,val2) {
  // console.log(val1,val2);
  return val1.toUpperCase() == val2.toUpperCase() ? true : false;
})

app.get('/', function (req, res) {
  res.send('Hello World')
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

    res.status(200).render('index.hbs', {
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


app.listen(3000)
