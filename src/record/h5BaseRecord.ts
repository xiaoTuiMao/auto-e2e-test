import cookie from 'js-cookie';
import apiIntercept from './apiIntercept';
import DataControl from './dataControl';
import interRecordDom from './interRecordDom';
import { onLoadEvent, clickEvent, leaveEvent } from './event';

const dataControl = new DataControl();
const startMock = cookie.get('__APP_MOCK__');
const ignoreRegisterRecordSDK = cookie.get('__IGNORE_REGISTER_RECORD_SDK__');

const main = (rootDom: HTMLElement = document.body) => {
  // 请求收集拦截器
  apiIntercept(dataControl, '/blackpearl/', !!startMock);

  if (ignoreRegisterRecordSDK) {
    return;
  }
  // 操作界面
  interRecordDom(dataControl);

  // load 事件
  onLoadEvent(dataControl, rootDom);
  // click 事件
  clickEvent(dataControl, rootDom);
  // TODO:scroll 事件

  // leave 事件
  leaveEvent(dataControl);
};

export default main;
