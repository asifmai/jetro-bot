const pupHelper = require('./puppeteerhelper');
const fs = require('fs');
const _ = require('underscore');
const path = require('path');
let browser;
const siteLink = "https://www.jetro.go.jp";
let companies = [];
companies = JSON.parse(fs.readFileSync('companiesfinal.json', 'utf8'));
let categories = [];
// categories = JSON.parse(fs.readFileSync('companies.json', 'utf8'));
let allcompanies = [];

(async () => {
  browser = await pupHelper.launchBrowser();
  // await fetchCategories();
  // await fetchCompaniesLinks();
  // await arrangeCompanies();
  await fetchCompaniesDetails();
  await browser.close();
})()

const fetchCompaniesDetails = () => new Promise(async (resolve, reject) => {
  try {
    if (!fs.existsSync('companies')) fs.mkdirSync('companies');
    if (fs.existsSync('allcompanies.csv')) allcompanies = JSON.parse(`[${fs.readFileSync('allcompanies.csv')}]`);

    for (let i = 0; i < companies.length; i++) {
      console.log(`${i+1}/${companies.length} - Fetching Companies Details from ${companies[i].url}`);
      if (!allcompanies.includes(companies[i].url)) {
        await fetchCompanyDetailsSingle(i);
      } else {
        console.log(`Company already scraped...`);
      }
    }

    resolve(true);
  } catch (error) {
    console.log(`fetchCompaniesDetails Error: ${error}`);
    reject(error);
  }
});

const fetchCompanyDetailsSingle = (compIdx) => new Promise(async (resolve, reject) => {
  let page;
  try {
    page = await pupHelper.launchPage(browser);
    await page.goto(companies[compIdx].url, {timeout: 0, waitUntil: 'load'});
    await page.waitForSelector('#elem_heading_lv1 > h1');

    companies[compIdx].events = await pupHelper.getTxt('#elem_heading_lv1 > h1', page);
    companies[compIdx].website = await pupHelper.getAttr('a.witharrow', 'href', page);
    companies[compIdx].from = '';
    companies[compIdx].to = '';

    const dt = await getCellVal('会期', page);
    if (dt !== '') {
      const twoDates = dt.split('～');
      companies[compIdx].from = twoDates[0].trim();
      companies[compIdx].to = twoDates[1].trim();
    }

    companies[compIdx].area = await getCellVal('開催地', page);
    companies[compIdx].facilityName = await getCellVal('会場', page);
    companies[compIdx].facilityUrl = await getCellVal('会場', page, true);
    companies[compIdx].item = await getCellVal('出展対象品目', page);
    companies[compIdx].forVisitor = await getCellVal('ご来場の方へ', page);
    companies[compIdx].organizar = await getCellVal('主催者', page);
    companies[compIdx].frequency = await getCellVal('開催頻度', page);
    companies[compIdx].history = await getCellVal('過去の実績', page);

    const compFileName = path.resolve(__dirname, `companies/${companies[compIdx].url.split('/').pop()}.json`);
    fs.writeFileSync(compFileName, JSON.stringify(companies[compIdx]));
    saveToFile('allcompanies.csv', companies[compIdx].url);

    await page.waitFor(5000);
    await page.close();
    resolve(true);
  } catch (error) {
    await page.close();
    console.log(`fetchCompanyDetailsSingle Error: ${error}`);
    reject(error);
  }
})

const getCellVal = (label, page, fetchUrl = false) => new Promise(async (resolve, reject) => {
  try {
    let returnVal = '';
    await page.waitForSelector('.elem_table_basic > table tr');
    const props = await page.$$('.elem_table_basic > table tr');
    for (let i = 0; i < props.length; i++) {
      const propLabel = await props[i].$eval('th', elm => elm.innerText.trim().toLowerCase());
      if (propLabel == label.toLowerCase()) {
        if (fetchUrl) {
          returnVal = await props[i].$eval('td a', elm => elm.getAttribute('href'));
          returnVal = siteLink + returnVal;
        } else {
          returnVal = await props[i].$eval('td', elm => elm.innerText); 
        }
        break;
      }
    };

    resolve(returnVal);
  } catch (error) {
    console.log(`getCellVal[${label}] Error: ${error.message}`);
    reject(error);
  }
})

const arrangeCompanies = () => new Promise((resolve, reject) => {
  for (let i = 0; i < categories.length; i++) {
    for (let j = 0; j < categories[i].companies.length; j++) {
      const company = {
        category: categories[i].category,
        subCategory: categories[i].subCategory,
        url: categories[i].companies[j]
      }
      companies.push(company);
    };
  };
  fs.writeFileSync('companiesfinal.json', JSON.stringify(companies));
});


const fetchCompaniesLinks = () => new Promise(async (resolve, reject) => {
  try {

    for (let i = 69; i < categories.length; i++) {
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
    page = await pupHelper.launchPage(browser);
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
      await page.waitForSelector('.elem_text_list > ul.var_blocklink > li > a', {timeout: 0});
      let pageLinks = await pupHelper.getAttrMultiple('.elem_text_list > ul.var_blocklink > li > a', 'href', page);
      pageLinks = pageLinks.map(pl => siteLink + pl);
      categories[catIdx].companies.push(...pageLinks);
    }
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

const saveToFile = (fileName, data) => {
  if (fs.existsSync(fileName)) {
    fs.appendFileSync(fileName, `,"${data}"`);
  } else {
    fs.writeFileSync(fileName, `"${data}"`)
  }
}