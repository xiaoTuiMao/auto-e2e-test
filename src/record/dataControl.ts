// import KNB from '@src/lib/knb';
import fetch from 'axios';

const KNB = {
  getStorage: ({ key, success, fail }: any) => {
    try {
      success({ value: window.localStorage.getItem(key) || '' });
    } catch (e) {
      fail(e);
    }
  },
  setStorage: ({ key, value }: any) => {
    console.log(value);
    window.localStorage.setItem(key, value);
    // memoryData[key] = value;
  },
  clearStorage: ({ key }: any) => {
    window.localStorage.removeItem(key);
  },
};

interface PageCaseItem {
  event: 'load' | 'click' | 'scroll' | 'leave' | 'input';
  snapshot: any;
  expendTime: number;
  snapshotType: 'all' | 'diff' | '';
  viewId?: string;
}

interface ApiCaseItem {
  url: string;
  params: any;
  response: any;
}

interface CaseItem {
  page: string;
  type: 'native' | 'mrn' | 'h5';
  pageCaseList: Array<PageCaseItem>;
  apiCaseList: Array<ApiCaseItem>;
}

interface RecordData {
  recordSDK: {
    status: 'unStart' | 'recording' | 'end';
  };
  caseList: Array<CaseItem>;
}

const DATA_KEY = '__record_sdk__';

// 每个页面的录制数据管理
export default class DataControl {
  recordData: RecordData = {
    recordSDK: { status: 'unStart' },
    caseList: [],
  };

  private status: 'load' | 'leave' | '' = ''; // 页面状态扭转 load => leave 单向的不可逆转

  private apiCaseList: Array<ApiCaseItem> = [];

  private pageCaseList: Array<PageCaseItem> = [];

  // 同步数据
  getRecordDataFromKNB(cb?: Function) {
    KNB.getStorage({
      key: DATA_KEY, // 数据键，String类型
      success: (result: any) => {
        try {
          this.recordData = JSON.parse(result.value);
        } catch (ignore) {
          console.warn('解析KNB的数据失败', result);
        }

        if (cb) {
          cb(this.recordData.recordSDK);
        }
      }, // 优先使用内存数据，如果没有对应数据，返回 null
      fail(e: any) {
        alert(`dataControl.getData.KNB.getStorage Error：${e}`);
      },
    });
  }

  // 返回插入数据的索引
  pushData(type: 'api' | 'page', data: any): null | number {
    // api 类数据
    if (type === 'api') {
      this.apiCaseList.push(data);
      return this.apiCaseList.length - 1;
    }

    // 表示此页面数据录制完毕，理论上这个时候页面已经跳走了，后续操作不再接入
    if (this.status === 'leave') {
      return null;
    }

    this.pageCaseList.push(data);
    return this.pageCaseList.length - 1;
  }

  // 更新
  updatePageCaseList(index: number | null, data: any) {
    if (index !== null && this.pageCaseList[index]) {
      this.pageCaseList[index] = { ...this.pageCaseList[index], ...data };
    }
  }

  // 设置页面状态 只能从 load => leave
  setPageRecordStatus(status: 'load' | 'leave', data?: PageCaseItem) {
    // 表示整个链路录制完成，不用再记录了
    if (this.recordData.recordSDK.status === 'end') {
      return;
    }

    if (status === 'load') {
      if (!data) {
        return;
      }
      this.pageCaseList.unshift(data);
      this.status = 'load';
      return;
    }

    this.status = 'leave';
    // 将拿到的数据同步到 native 中，只有录制状态才需要同步
    if (this.recordData.recordSDK.status === 'recording') {
      this.asyncPageCaseToKNB();
    }
  }

  getPageCase() {
    const caseItem: CaseItem = {
      page: window.location.href,
      type: 'h5',
      pageCaseList: this.pageCaseList,
      apiCaseList: this.apiCaseList,
    };
    return caseItem;
  }

  // 同步数据到内存
  asyncPageCaseToKNB() {
    this.recordData.caseList.push(this.getPageCase());
    KNB.setStorage({
      key: DATA_KEY, // 数据键，String类型
      value: JSON.stringify(this.recordData),
      level: 0, // 存储级别，Interger类型，0 - 内存【默认】，1 - 设备，2 - 云端【11.7 暂缓】
    });
  }

  // 上报数据
  report() {
    this.recordData.caseList.push(this.getPageCase());
    KNB.clearStorage({ key: DATA_KEY });
    // TODO: 接口上传
    fetch.post('http://localhost:4000/report', this.recordData.caseList);
  }

  // 开始录制
  startRecord() {
    this.recordData.recordSDK.status = 'recording';
  }

  // 结束录制
  endRecord() {
    this.recordData.recordSDK.status = 'end';
    this.report();
  }
}
