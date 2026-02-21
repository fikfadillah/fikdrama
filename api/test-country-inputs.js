const axios = require('axios');
const cheerio = require('cheerio');

axios.get('http://45.11.57.31/series/')
    .then(res => {
        const $ = cheerio.load(res.data);
        const countries = [];
        $('input[name="country[]"]').each((i, el) => {
            countries.push($(el).attr('value'));
        });
        console.log('Country filter values:', countries);
    })
    .catch(console.error);
