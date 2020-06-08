const express = require('express');
const fs = require('fs');
const util = require('util');
const path = require('path');
const fetch = require('axios');

const router = express.Router();

const readFile = util.promisify(fs.readFile);
const DATA_FILE_PATH = path.resolve(__dirname, '../../data/record.txt');

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

const checkParams = (cacheParams, reqParams) => {
  if (cacheParams === null) {
    return true;
  }

  try {
    console.log(cacheParams, JSON.stringify(reqParams));
    return cacheParams === JSON.stringify(reqParams);
  } catch (e) {
    return false;
  }
};

const findProxyApi = async (referer, url, method, params) => {
  const record = await readFile(DATA_FILE_PATH, { encoding: 'utf-8' });
  let result;
  JSON.parse(record).some((item) => {
    if (item.page === referer) {
      return item.apiCaseList.some((api) => {
        if (api.url === url && method === api.method && checkParams(api.params, params)) {
          result = api.response;
          return true;
        }
        return false;
      });
    }
    return false;
  });
  return result;
};

router.all('/proxy', async (req, res) => {
  const originMethod = req.headers['x-proxy-origin-method'];
  const originUrl = req.headers['x-proxy-origin-url'];
  const referer = req.headers['x-proxy-referer'];

  const proxyRes = await findProxyApi(referer, originUrl, originMethod, req.body);
  console.log(originUrl);
  if (proxyRes) {
    console.log('run in cache');
    res.send(JSON.parse(proxyRes));
    return;
  }
  try {
    const proxyRealRes = await fetch({ method: originMethod, url: originUrl, data: req.body });
    res.send(proxyRealRes.data);
  } catch (e) {
    res.status(500).send({ msg: 'server error' });
  }
});

router.post('/report', (req, res) => {
  console.log('in this mid');
  res.send('ok');
  fs.writeFile(DATA_FILE_PATH, JSON.stringify(req.body), { encoding: 'utf-8' }, () => {
    console.log('DONE');
    // shellJs.exec('npm run test');
  });
});

module.exports = router;
