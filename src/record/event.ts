// import KNB from '@dp/knb';
import recordDom, { findViewPath } from './baseRecord';
import DataControl from './dataControl';

import { INTER_DOM_CONTAINER_CLASS_NAME, startRecording } from './interRecordDom';

// onLoad 页面进入后，等待页面元素加载完成，再开始记录
export const onLoadEvent = (dataControl: DataControl, rootDom: HTMLElement) => {
  const startTime = Date.now();
  startRecording(() => {
    const recordData = recordDom(rootDom, 'load', INTER_DOM_CONTAINER_CLASS_NAME);
    console.log(recordData);
    dataControl.setPageRecordStatus('load', {
      event: 'load',
      expendTime: Date.now() - startTime,
      ...recordData,
    });
  });
};

export const clickEvent = (dataControl: DataControl, rootDom: HTMLElement) => {
  // click 记录
  document.body.addEventListener('click', (e: any) => {
    if (dataControl.recordData.recordSDK.status === 'unStart' || dataControl.recordData.recordSDK.status === 'end') {
      return;
    }
    console.log(e);
    if (e.target.tagName === 'INPUT') {
      const fn = () => {
        console.log(e.target.value);
        e.target.removeEventListener('blur', fn);
      };
      e.target.addEventListener('blur', fn);
      e.target.addEventListener('change', () => {
        console.log(1222);
      });
      return;
    }
    // TODO:且要触发的节点是有插入ID的才记录
    // viewId 要替换成插入的 ID
    const viewId = findViewPath(e.target as HTMLElement);

    const index = dataControl.pushData('page', {
      event: 'click',
      viewId,
    });

    const startTime = Date.now();

    startRecording(() => {
      const recordData = recordDom(rootDom, 'click', INTER_DOM_CONTAINER_CLASS_NAME);
      dataControl.updatePageCaseList(index, {
        ...recordData,
        expendTime: Date.now() - startTime,
      });
      // cacheClickData.push(viewId);
    });
  });
};

export const leaveEvent = (dataControl: DataControl) => {
  const recordLeaveData = () => {
    dataControl.setPageRecordStatus('leave');
  };

  // 利用浏览器的跳转方式
  window.addEventListener('beforeunload', () => {
    recordLeaveData();
  });

  // KNB.subscribe({
  //   action: 'disappear',
  //   handle() {
  //     recordLeaveData();
  //   },
  // });
};
