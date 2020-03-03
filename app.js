const pupHelper = require('./puppeteerhelper');
const fs = require('fs');
const _ = require('underscore');
let browser;
const siteLink = "https://www.jetro.go.jp";
let companies = [];
let categories = [];
categories = JSON.parse(fs.readFileSync('categories.json', 'utf8'));

(async () => {
  browser = await pupHelper.launchBrowser(true);
  // await fetchCategories();
  await fetchCompaniesLinks();
  await browser.close();
})()

const fetchCompaniesLinks = () => new Promise(async (resolve, reject) => {
  try {

    for (let i = 0; i < categories.length; i++) {
    // for (let i = 0; i < 2; i++) {
      console.log(`${i+1}/${categories.length} - Fetching Companies Links from Category`);
      await fetchCompaniesFromCategory(i);
      fs.writeFileSync('companies.json', JSON.stringify(categories));
    }
    
    resolve(true);
  } catch (error) {
    console.log(`fetchCompaniesLinks Error: ${error}`);
    reject(error);
  }
})

const fetchCompaniesFromCategory = (catIdx) => new Promise(async (resolve, reject) => {
  let page;
  try {
    categories[catIdx].companies = [];
    page = await pupHelper.launchPage(browser, true);
    await page.goto(categories[catIdx].url, {timeout: 0, waitUntil: 'load'});
    await page.waitForSelector('.elem_pagination');
    
    let noOfPages = 1;
    const gotPagination = await page.$('.elem_pagination > ul > li:nth-last-child(2)');
    if (gotPagination) {
      noOfPages = await page.$eval('.elem_pagination > ul > li:nth-last-child(2)', elm => parseInt(elm.innerText.trim()));
    }

    for (let i = 1; i <= noOfPages; i++) {
      console.log(`Fetching Companies Links from page: ${i}/${noOfPages}`);
      if (i > 1) {
        await page.goto(`${categories[catIdx].url}?&dnumber=&sort=&_page=${i}`);
      }
      await page.waitForSelector('.elem_text_list > ul.var_blocklink > li > a');
      let pageLinks = await pupHelper.getAttrMultiple('.elem_text_list > ul.var_blocklink > li > a', 'href', page);
      pageLinks = pageLinks.map(pl => siteLink + pl);
      categories[catIdx].companies.push(...pageLinks);
    }
    console.log(`No of Companies Found in Category: ${categories[catIdx].companies.length}`);
    categories[catIdx].companies = _.uniq(categories[catIdx].companies);
    console.log(`No of Companies Found in Category(after removing duplicates): ${categories[catIdx].companies.length}`);
    
    await page.waitFor(5000);
    await page.close();
    resolve(true);
  } catch (error) {
    await page.close();
    console.log(`fetchCompaniesFromCategory Error: ${error}`);
    reject(error);
  }
});

const fetchCategories = () => new Promise(async (resolve, reject) => {
  let page;
  try {
    page = await pupHelper.launchPage(browser);
    await page.goto(`${siteLink}/j-messe/industries.html`, {timeout: 0, waitUntil: 'load'});
  
    await page.waitForSelector('.content_divide_col3 .elem_content_divide_box > div');
    const lines = await page.$$('.content_divide_col3 .elem_content_divide_box > div');
    let categoryName = '';
    for (let i = 0; i < lines.length; i++) {
      const isCategory = await lines[i].$('ul.more');
      if (isCategory) {
        categoryName = await lines[i].$eval('h3', elm => elm.innerText.trim())
      } else {
        const subCatsNodes = await lines[i].$$('ul > li');
        for (let j = 0; j < subCatsNodes.length; j++) {
          const subCat = {category: categoryName};
          subCat.subCategory = await subCatsNodes[j].$eval('a', elm => elm.innerText.trim());
          subCat.url = await subCatsNodes[j].$eval('a', (elm, siteLink) => siteLink + elm.getAttribute('href'), siteLink);
          categories.push(subCat);
        }
      }
    }
  
    fs.writeFileSync('categories.json', JSON.stringify(categories));
  
    await page.close();
    resolve(true);
  } catch (error) {
    await page.close();
    console.log(`fetchCategories Error: ${error}`);
    reject(error);
  }
});
