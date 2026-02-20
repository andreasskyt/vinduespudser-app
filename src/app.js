const express = require('express');
const path = require('path');

const quoteRouter = require('./routes/quote');
const adminRouter = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/admin', adminRouter);
app.use('/', quoteRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Der opstod en fejl',
    message: 'Vi beklager – noget gik galt. Prøv igen senere.',
  });
});

module.exports = app;
