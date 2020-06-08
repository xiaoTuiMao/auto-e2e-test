/* eslint-disable prefer-arrow-callback */
/* eslint-disable space-before-function-paren */
/* eslint-disable func-names */
// feature/WBICG-2019-5223641/blcakpearl-board-0401
const webdriverio = require('webdriverio');
const cheerio = require('cheerio');
const async = require('async');
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const iosOptions = require('./webio.conf');
// eslint-disable-next-line import/no-unresolved
const testCaseList = require('../data/record');

const DATA_FILE_PATH = path.resolve(__dirname, '../data/snapshot.js');

const deviceInfo = {};

const collectionCss = ['width', 'height', 'position', 'display', 'visibility'];
const mustBeEqualKeyList = ['tagName', 'childrenType', 'position', 'display', 'visibility', 'id', 'className', 'style'];

const getSelfIndex = (dom, viewId, $) => {
  let result = 0;
  const domList = $(viewId);

  [].slice.call(domList).some((item, index) => {
    if (item === dom) {
      result = index;
      return true;
    }
    return false;
  });

  return result;
};

const getDomViewId = (dom, $) => {
  let viewPath = dom.name.toLowerCase();
  let parentDom = dom.parent;
  if (viewPath === 'body') {
    return 'body_0';
  }
  while (parentDom && parentDom.name !== 'body') {
    viewPath = `${parentDom.name.toLowerCase()}>${viewPath}`;
    parentDom = parentDom.parent;
  }
  const index = getSelfIndex(dom, `body>${viewPath}`, $);
  return `body>${viewPath}_${index}`;
};

const getDomDescAttr = async (client, dom, $) => {
  const result = {
    id: dom.attribs.id || '',
    className: dom.attribs.class || '',
    style: dom.attribs.style || '',
  };

  const viewId = getDomViewId(dom, $);
  const ids = viewId.split('_');
  const eleList = await client.$$(ids[0]);
  const ele = eleList[ids[1]];
  const style = await Promise.all(collectionCss.map((key) => ele.getCSSProperty(key)));
  collectionCss.forEach((key, index) => {
    result[key] = (style[index] || {}).value;
  });
  result.widthRatio = Number.parseFloat(result.width) / deviceInfo.width;
  result.heightRatio = Number.parseFloat(result.height) / deviceInfo.height;
  return result;
};

// 判断是否是李彪元素
const checkChildIsList = (domList) => {
  if (domList.length <= 2) {
    return false;
  }
  const referenceDom = domList[0];
  return [].slice.call(domList).every((dom, index) => {
    // 防止最后一个是类似 loading /没有更多了的节点
    if (index === domList.length - 1) {
      return true;
    }

    return dom.name === referenceDom.name && dom.attribs.class === referenceDom.attribs.class;
  });
};

// 从 root 开始收集数据
const baseRecordFromRoot = async (client, $, dom, snapshot) => {
  if (!dom || dom.name === 'SCRIPT' || dom.type !== 'tag') {
    return null;
  }
  const attr = await getDomDescAttr(client, dom, $);
  const currentSnapshot = {
    tagName: dom.name,
    ...attr,
    childrenType: 'normal',
    // ele: dom,
    children: [],
  };

  let newSnapshot;
  if (!snapshot) {
    newSnapshot = currentSnapshot;
  } else {
    newSnapshot = snapshot;
    newSnapshot.children.push(currentSnapshot);
  }
  if (!dom.children || !dom.children.length) {
    return newSnapshot;
  }

  const childIsList = checkChildIsList(dom.children.filter((item) => item.type === 'tag'));
  if (childIsList) {
    currentSnapshot.childrenType = 'list';
    await baseRecordFromRoot(client, $, dom.children.filter((item) => item.type === 'tag')[0], currentSnapshot);
    return newSnapshot;
  }

  await async.series(
    [].slice
      .call(dom.children)
      .filter((item) => item.type === 'tag')
      .map((children) => async () => await baseRecordFromRoot(client, $, children, currentSnapshot)),
  );
  return newSnapshot;
};

const getSnapshot = async (client) => {
  const body = await client.$('body');
  const html = await body.getHTML();
  const $ = cheerio.load(html);
  const snapshot = await baseRecordFromRoot(client, $, $('body')[0]);
  return snapshot;
  // fs.writeFile(DATA_FILE_PATH, JSON.stringify(snapshot), { encoding: 'utf-8' }, () => {
  //   console.log('DONE');
  //   // shellJs.exec('npm run test');
  // });
};

const checkWidth = (playbackWith, playbackWithRatio, recordWidth, recordWidthRatio) => {
  if (
    playbackWith === recordWidth ||
    playbackWithRatio === recordWidthRatio ||
    (recordWidthRatio - 0.025 < playbackWithRatio && playbackWithRatio < recordWidthRatio + 0.025)
  ) {
    return true;
  }
  return false;
};

// 高度对比 存在问题
const checkHeight = (playbackHeight, playbackHeightRatio, recordHeight, recordHeightRatio) => {
  if (
    playbackHeight === recordHeight ||
    playbackHeightRatio === recordHeightRatio ||
    (recordHeightRatio === 1 && playbackHeightRatio > 0.9) ||
    (recordHeightRatio - 0.05 < playbackHeightRatio && playbackHeightRatio < recordHeightRatio + 0.05)
  ) {
    return true;
  }
  return false;
};

// 快照是 all 的情况下对比
const checkAllSnapshot = (playbackSnapshot, recordSnapshot) => {
  const mustBeEqual = mustBeEqualKeyList.every((key) => (playbackSnapshot[key] || '').toLowerCase() === (recordSnapshot[key] || '').toLowerCase());
  // 基础字段必须相等
  if (!mustBeEqual) {
    console.log('基础字段不匹配', playbackSnapshot, recordSnapshot);
    return false;
  }

  if (playbackSnapshot.children.length !== recordSnapshot.children.length) {
    console.log('子元素个数不一致', playbackSnapshot.children, recordSnapshot.children);
    return false;
  }
  // 宽高在不同的机型上面可能出现误差
  if (
    !checkWidth(playbackSnapshot.width, playbackSnapshot.widthRatio, recordSnapshot.width, recordSnapshot.widthRatio)
    // !checkHeight(playbackSnapshot.height, playbackSnapshot.heightRatio, recordSnapshot.height, recordSnapshot.heightRatio)
  ) {
    console.log('宽高不匹配', playbackSnapshot, recordSnapshot);
    return false;
  }

  return playbackSnapshot.children.every((children, index) => checkAllSnapshot(children, recordSnapshot.children[index]));
};

const checkSnapshotAttr = (prevSnapshot, nextSnapshot) => {
  const diffKeyList = [];
  // if (
  //   prevCompareSnapshot.ele !== nextCompareSnapshot.ele
  // ) {
  //   diffKey.push('ele');
  // }
  // if(prevCompareSnapshot.childrenType !== nextCompareSnapshot.childrenType
  //   prevCompareSnapshot.children.length !== nextCompareSnapshot.children.length){
  //   diffKey.push('ele');

  //   }
  ['tagName', 'width', 'height'].concat(mustBeEqualKeyList).some((key) => {
    if (prevSnapshot[key] !== nextSnapshot[key]) {
      diffKeyList.push(key);
    }
  });
  return diffKeyList;
};

// 肯定有元素增删 list => list list => normal normal => list
const findAddOrDelSnapshot = (prevCompareSnapshot, nextCompareSnapshot) => {
  const result = [];
  prevCompareSnapshot.children.forEach((prevItem) => {
    const hadSameItem = nextCompareSnapshot.children.some((nextItem) => {
      const diffKeyList = checkSnapshotAttr(prevItem, nextItem);
      return !diffKeyList.length;
    });

    // 极有【可能】是被删除的那一项
    if (!hadSameItem) {
      result.push({ item: { ...prevItem, children: [] }, type: 'del' });
    }
  });
  nextCompareSnapshot.children.forEach((nextItem) => {
    const hadSameItem = prevCompareSnapshot.children.some((prevItem) => {
      const diffKeyList = checkSnapshotAttr(prevItem, nextItem);
      return !diffKeyList.length;
    });

    // 极有【可能】是被删除的那一项
    if (!hadSameItem) {
      result.push({ item: nextItem, type: 'add' });
    }
  });
  return result;
};

const getPlaybackDiff = (prevSnapshot, nextSnapshot, diffResult) => {
  let result = diffResult;
  // 初始化一个结果
  if (!result) {
    result = [];
  }
  const diffKeyList = checkSnapshotAttr(prevSnapshot, nextSnapshot);
  // 交互导致节点不一致
  if (diffKeyList.length) {
    result.push({
      snapshot: { ...nextSnapshot, children: [] },
      diffKeyList,
      type: 'diff',
    });
  }

  // 表示节点有增删 找出增删的，然后再对比其他的
  if (prevSnapshot.children.length !== nextSnapshot.children.length /*  && prevSnapshot.childrenType === nextSnapshot.childrenType */) {
    const addOrDelSnapshot = findAddOrDelSnapshot(prevSnapshot, nextSnapshot);
    result.push({
      snapshot: { ...nextSnapshot, children: [] },
      type: 'childrenChange',
      diffKeyList: ['children', ...addOrDelSnapshot],
    });
    return result;
  }

  prevSnapshot.children.forEach((snapshot, index) => {
    getPlaybackDiff(snapshot, nextSnapshot.children[index], result);
  });

  return result;
};

const checkDiffSnapshot = (playbackDiff, recordDiff) => {
  // 首先数量一定要一致
  if (playbackDiff.length !== recordDiff.length) {
    return false;
  }
  // 变化的元素也要一样
  return playbackDiff.every((item, index) => {
    const recordDiffItem = recordDiff[index];
    console.log(item, recordDiffItem);
    console.log('=======================');

    if (item.diffKeyList.length !== recordDiffItem.diffKeyList.length || item.type !== recordDiffItem.type) {
      console.error('差量快照个数不一致');
      return false;
    }
    // 节点变化
    if (item.type === 'diff') {
      const result =
        item.diffKeyList.every((diffKey, idx) => diffKey === recordDiffItem.diffKeyList[idx]) &&
        checkAllSnapshot(item.snapshot, recordDiffItem.snapshot);
      if (!result) {
        console.error('前后快照信息不一致');
      }
      return result;
    }

    // 节点增删 对比
    return item.diffKeyList.every((diffKeyItem, idx) => {
      const recordDiffKeyItem = recordDiffItem.diffKeyList[idx];
      if (typeof diffKeyItem === 'string') {
        return diffKeyItem === recordDiffKeyItem;
      }

      return diffKeyItem.type === recordDiffKeyItem.type && checkAllSnapshot(diffKeyItem.item, recordDiffKeyItem.item);
    });
  });
};

describe('黑珍珠', function() {
  let client;
  let prevSnapshot;
  it('环境准备', async function() {
    // 建立连接
    client = await webdriverio.remote(iosOptions);
    // 进入mock 获取信息
    const [windowSize] = await Promise.all([client.getWindowSize(), client.url('http://meishi.test.meituan.com:4000')]);
    deviceInfo.width = windowSize.width;
    deviceInfo.height = windowSize.height;
    await client.pause(3000);
  });

  testCaseList.forEach(function(item, index) {
    it(item.page, async function() {
      if (index === 0) {
        await client.url(item.page);
      }
      await client.pause(5000);

      await async.series(
        item.pageCaseList.map(function(caseItem) {
          return async function() {
            if (caseItem.event === 'click') {
              const ids = caseItem.viewId.split('_');
              const findEleList = await client.$$(ids[0]);
              const current = findEleList[ids[1]];
              await current.click();
            }
            // 表示页面跳转 没有快照
            if (!caseItem.snapshot) {
              await client.pause(caseItem.expendTime || 1000);
              return;
            }

            await client.pause(caseItem.expendTime);
            const playbackSnapshot = await getSnapshot(client);

            if (caseItem.snapshotType === 'all') {
              // console.log(`trigger ${caseItem.event} and check all`)
              // const result = checkAllSnapshot(playbackSnapshot, caseItem.snapshot);
              // expect(result).to.be.true;
            }

            if (caseItem.snapshotType === 'diff') {
              const playbackDiff = getPlaybackDiff(prevSnapshot, playbackSnapshot);
              console.log(`${caseItem.viewId} trigger ${caseItem.event} and check diff`);
              expect(checkDiffSnapshot(playbackDiff, caseItem.snapshot)).to.be.true;
            }

            prevSnapshot = playbackSnapshot;

            // if (!caseItem.viewId) {
            //   return;
            // }
            // const ids = caseItem.viewId.split('_');
            // const body = await client.$$(ids[0]);
            // const current = body[ids[1]];
            // await current.click();
            // await client.pause(1000);
          };
        }),
      );
    });
  });
});

// it('运行case', async function() {
//   client.url('http://meishi.test.meituan.com:3000/rule.html?year=2020');
//   await client.pause(10000);
//   await getSnapshot(client);
//   // const ele = await client.$('.style_container__3FdVz');
//   // const style = await ele.getAttribute('style');
//   // const className = await ele.getAttribute('class');
//   // const id = await ele.getAttribute('id');
//   // const css = await ele.getCSSProperty('width');
//   // console.log(style, className, id, css);
//   // await client.pause(3000);
// });

// const url = await client.getUrl();
// console.log(index, url, item.page);

// if (url !== item.page) {
//   await client.url(item.page);
// }
// const dom = await client.$$('body>div>div>div>div>div');
// const current = dom[14];
// console.log(dom[14], '=====1');
// await current.click();
// await client.pause(5000);

// client.switchWindow('https://m.dianping.com/shop/1974673?msource=huodong');
// const body = await client.$('body');
// const title = await body.getHTML();
// console.log(title);
// await current.reloadSession();
// const body = await client.$('body');
// const html = await body.getHTML();
// console.log(html);
// await client.elementClick(dom[0].elementId);
// await dom[0].touchAction('tap');
// 开始测试
// const assert = require('chai').assert;
// describe(item.pageName, function () {
//   let client;
//   it('url', async function() {
//     const client = await webdriverio.remote(iosOptions);
//     await client.url(item.pageUrl);
//     client.pause(10000);
//   });
//   // item.pageCaseList.forEach((function (caseItem) {
//   //   it(`${item.pageName}_${caseItem.event}`, async function () {
//   //     const ids = caseItem.viewId.split('_');
//   //     const body = await client.$$(ids[0])[ids[1]];

//   //     console.log(body, '====1====');
//   //   });
//   // }));

//   it(`${item.pageName}_${item.pageCaseList[0].event}`, async function () {
//     const ids = item.pageCaseList[0].viewId.split('_');
//     const body = await client.$$(ids[0])[ids[1]];
//     console.log(body, '====2====');
//   });

// });

// testCaseList.forEach(item => {
//   describe(item.pageName, async function () {
//     const client = await webdriverio.remote(iosOptions);
//     await client.url(item.pageUrl);
//     client.pause(10000);
//     item.pageCaseList.forEach((function (caseItem) {
//       it(`${item.pageName}_${caseItem.event}`, async function () {
//         const ids = caseItem.viewId.split('_');
//         const body = await client.$$(ids[0])[ids[1]];

//         console.log(body, '====1====');
//       });
//     }));
//     it(`${item.pageName}_${item.pageCaseList[0].event}`, async function () {
//       const ids = item.pageCaseList[0].viewId.split('_');
//       const body = await client.$$(ids[0])[ids[1]];
//       console.log(body, '====2====');
//     });

//   });
// });

// describe('Create Safari session', function () {
//   it('testPageA', async function () {
//     const client = await webdriverio.remote(iosOptions);

//     await client.url('https://awp.meituan.com/meis/meishi-talos-h5/blackpearl-board/main.html');
//     // console.log(client.switchToAlert);
//     // client.execute(() => {
//     //   alert(window);
//     // });

//     await waitTime(10000);
//     // eslint-disable-next-line no-console

//     const body = await client.$('body');
//     // const html = await body.getHTML();
//     // eslint-disable-next
//     // const $ = cheerio.load(html);
//     // console.log($('body').children);
//     // const txt = await body.getText()
//     // console.log(body.children);
//     // await client.deleteSession();
//   });
// });

/*
  it('测试页面', async function() {
    await client.url('http://meishi.test.meituan.com:3000/testPage.html');
    await client.pause(1000);
    const ADD_BTN = await client.$('#ADD');
    console.log(ADD_BTN);
    const DEL_BTN = await client.$('#DEL');
    console.log(DEL_BTN);
    let LIST = await client.$$('.TEST_LIST');
    console.log(LIST.map((item) => item.elementId));
    await ADD_BTN.click();
    await client.pause(1000);
    const test =  await client.$('#ADD');
    console.log(test === ADD_BTN)
    LIST = await client.$$('.TEST_LIST');
    console.log(LIST.map((item) => item.elementId));
    await ADD_BTN.click();
    await client.pause(1000);

    LIST = await client.$$('.TEST_LIST');
    console.log(LIST.map((item) => item.elementId));
    await DEL_BTN.click();
    await client.pause(1000);

    LIST = await client.$$('.TEST_LIST');
    console.log(LIST.map((item) => item.elementId));
    await DEL_BTN.click();
    await client.pause(1000);

    LIST = await client.$$('.TEST_LIST');
    console.log(LIST.map((item) => item.elementId));
  });
*/
