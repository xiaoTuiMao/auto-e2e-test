let prevSnapshot: any;
const collectionCss = ['width', 'height', 'position', 'display', 'visibility'];
const collectionBase = ['id', 'className', 'style'];

const getSelfIndex = (dom: HTMLElement, viewId: string) => {
  let result = 0;
  const domList = document.querySelectorAll(viewId);

  [].slice.call(domList).some((item: any, index) => {
    if (item === dom) {
      result = index;
      return true;
    }
    return false;
  });

  return result;
};

export const findViewPath = (dom: HTMLElement) => {
  let viewPath = dom.tagName.toLowerCase();
  let parentDom = dom.parentElement;
  while (parentDom && parentDom !== document.body) {
    viewPath = `${parentDom.tagName.toLowerCase()}>${viewPath}`;
    parentDom = parentDom.parentElement;
  }
  const index = getSelfIndex(dom, `body>${viewPath}`);
  return `body>${viewPath}_${index}`;
};

const getDomDescAttr = (dom: any) => {
  const result: any = {};

  collectionBase.forEach((key: any) => {
    if (key === 'style') {
      result[key] = dom[key].cssText;
    } else {
      result[key] = dom[key];
    }
  });

  collectionCss.forEach((key: any) => {
    result[key] = window.getComputedStyle(dom, null)[key];
  });
  result.widthRatio = Number.parseFloat(result.width) / window.screen.width;
  result.heightRatio = Number.parseFloat(result.height) / window.screen.height;
  return result;
};

const checkChildIsList = (domList: HTMLCollection) => {
  if (domList.length <= 2) {
    return false;
  }
  const referenceDom = domList[0];
  return [].slice.call(domList).every((dom: HTMLElement, index: number) => {
    // 防止最后一个是类似 loading /没有更多了的节点
    if (index === domList.length - 1) {
      return true;
    }

    return dom.tagName === referenceDom.tagName && dom.className === referenceDom.className;
  });
};

const baseRecordFromRoot = (excludeDomClassName = '', dom: HTMLElement | null, snapshot?: any) => {
  if (!dom || dom.className === excludeDomClassName || dom.tagName === 'SCRIPT') {
    return null;
  }
  const currentSnapshot = {
    tagName: dom.tagName,
    ...getDomDescAttr(dom),
    childrenType: 'normal',
    // ele: dom,
    children: [],
  };

  let newSnapshot: any;
  if (!snapshot) {
    newSnapshot = currentSnapshot;
  } else {
    newSnapshot = snapshot;
    newSnapshot.children.push(currentSnapshot);
  }
  if (!dom.children || !dom.children.length) {
    return newSnapshot;
  }

  const childIsList = checkChildIsList(dom.children);
  if (childIsList) {
    currentSnapshot.childrenType = 'list';
    baseRecordFromRoot(excludeDomClassName, dom.children[0] as HTMLElement, currentSnapshot);
    return newSnapshot;
  }

  [].slice.call(dom.children).forEach((children: HTMLElement) => baseRecordFromRoot(excludeDomClassName, children, currentSnapshot));
  return newSnapshot;
};

const checkSnapshotAttr = (prevCompareSnapshot: any, nextCompareSnapshot: any): Array<string> => {
  const diffKeyList: Array<string> = [];
  // if (
  //   prevCompareSnapshot.ele !== nextCompareSnapshot.ele
  // ) {
  //   diffKey.push('ele');
  // }
  // if(prevCompareSnapshot.childrenType !== nextCompareSnapshot.childrenType
  //   prevCompareSnapshot.children.length !== nextCompareSnapshot.children.length){
  //   diffKey.push('ele');

  //   }
  // console.log(prevCompareSnapshot, nextCompareSnapshot);
  ['ele', 'childrenType'].concat(collectionCss, collectionBase).forEach((key: string) => {
    if (prevCompareSnapshot[key] !== nextCompareSnapshot[key]) {
      diffKeyList.push(key);
    }
  });
  return diffKeyList;
};

// 肯定有元素增删 list => list list => normal normal => list
const findAddOrDelSnapshot = (prevCompareSnapshot: any, nextCompareSnapshot: any): Array<any> => {
  const result: Array<any> = [];
  prevCompareSnapshot.children.forEach((prevItem: any) => {
    const hadSameItem = nextCompareSnapshot.children.some((nextItem: any) => {
      const diffKeyList = checkSnapshotAttr(prevItem, nextItem);
      return !diffKeyList.length;
    });

    // 极有【可能】是被删除的那一项
    if (!hadSameItem) {
      result.push({ item: { ...prevItem, children: [] }, type: 'del' });
    }
  });
  nextCompareSnapshot.children.forEach((nextItem: any) => {
    const hadSameItem = prevCompareSnapshot.children.some((prevItem: any) => {
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

// 会存在两种情况，1.能找到变化的 2.不能找到
const compareSnapshotAfterInteraction = (prevCompareSnapshot: any, nextCompareSnapshot: any, diffResult?: Array<any>): Array<any> => {
  let result = diffResult;
  // 初始化一个结果
  if (!result) {
    result = [];
  }
  const diffKeyList = checkSnapshotAttr(prevCompareSnapshot, nextCompareSnapshot);
  // 交互导致节点不一致
  if (diffKeyList.length) {
    result.push({
      // children 置为空数组是为了，减少不必要的对比，只对比变化的
      snapshot: { ...nextCompareSnapshot, children: [] },
      diffKeyList,
      type: 'diff',
    });
    // return result;
  }
  // 表示节点有增删 找出增删的，然后再对比其他的 如果childType 不相等，那么children肯定就不相等 childrenType 前面做过校验了，这里就不再做对比
  if (
    prevCompareSnapshot.children.length !== nextCompareSnapshot.children.length
    // prevCompareSnapshot.childrenType === nextCompareSnapshot.childrenType TODO: 这里可以优化处理
  ) {
    const addOrDelSnapshot = findAddOrDelSnapshot(prevCompareSnapshot, nextCompareSnapshot);
    result.push({
      snapshot: { ...nextCompareSnapshot, children: [] },
      type: 'childrenChange',
      diffKeyList: ['children', ...addOrDelSnapshot],
    });
    return result;
  }

  prevCompareSnapshot.children.forEach((snapshot: any, index: number) => {
    compareSnapshotAfterInteraction(snapshot, nextCompareSnapshot.children[index], result);
  });

  return result;
};

interface RecordData {
  snapshotType: 'all' | 'diff' | '';
  snapshot: any;
}

const main = (root: HTMLElement, event: string, excludeDomClassName = ''): RecordData => {
  const nextSnapshot = baseRecordFromRoot(excludeDomClassName, root);

  if (event === 'load') {
    prevSnapshot = nextSnapshot;
    return { snapshotType: 'all', snapshot: nextSnapshot };
  }

  // 后续扩展数据扩展在这里增加即可
  // click 只需找出出现变化的 DOM 如果DOM 没有出现变化 怎么办？那么多半是数据发生了变化，后期可以校验数据
  if (event === 'click') {
    const diffResult = compareSnapshotAfterInteraction(prevSnapshot, nextSnapshot);
    console.log(diffResult);
    prevSnapshot = nextSnapshot;
    return { snapshotType: 'diff', snapshot: diffResult };
  }

  return { snapshotType: '', snapshot: null };
};

export default main;
