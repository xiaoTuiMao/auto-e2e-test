import DataControl from './dataControl';

// 后续如果使用 native 的组件，这里可以删除了
export const INTER_DOM_CONTAINER_CLASS_NAME = '__interDomContainer';
export const INTERCEPT_ACTION = '__interceptAction';

const css: any = {
  [`.${INTER_DOM_CONTAINER_CLASS_NAME}`]: {
    position: 'fixed',
    top: '40%',
    right: 0,
    'z-index': 999999,
  },
  [`.${INTER_DOM_CONTAINER_CLASS_NAME} div`]: {
    width: '50px',
    height: '50px',
    'border-radius': '50%',
    'line-height': '50px',
    'text-align': 'center',
    'font-size': '12px',
    'margin-bottom': '10px',
    'background-color': '#ccc',
  },
  [`.${INTER_DOM_CONTAINER_CLASS_NAME} .recording, .${INTER_DOM_CONTAINER_CLASS_NAME} .startDom`]: { 'background-color': '#b80401', color: '#fff' },
  [`.${INTERCEPT_ACTION}`]: {
    top: 0,
    left: 0,
    'z-index': 9999,
    position: 'fixed',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.7)',
    'text-align': 'center',
    'line-height': '100vh',
    'font-size': '14px',
    color: '#fff',
  },
};

const parseCssObjToString = () =>
  Object.keys(css).reduce((prev, next) => {
    const hash = css[next];
    const cssAttr = Object.keys(hash).reduce((p, n) => `${p}${n}: ${hash[n]};\n`, '');
    return `${prev}${next} { ${cssAttr} }\n`;
  }, '');

const interStyle = () => {
  const style = document.createElement('style');
  style.type = 'text/css';
  const textNode = document.createTextNode(parseCssObjToString());
  style.appendChild(textNode);
  document.head.appendChild(style);
};

const interRecordDom = (dataControl: DataControl): void => {
  interStyle();
  const container = document.createElement('div');
  container.className = INTER_DOM_CONTAINER_CLASS_NAME;

  const statusDom = document.createElement('div');
  const startDom = document.createElement('div');
  const endDom = document.createElement('div');

  container.appendChild(startDom);
  container.appendChild(statusDom);
  container.appendChild(endDom);

  startDom.innerText = '开始';
  endDom.innerText = '结束';
  statusDom.innerText = '未录制';
  startDom.className = 'startDom';
  const startRecord = () => {
    statusDom.className = 'recording';
    statusDom.innerText = '录制中';
  };
  startDom.addEventListener('click', (e: any) => {
    e.stopPropagation();
    startRecord();
    dataControl.startRecord();
  });

  endDom.addEventListener('click', (e: any) => {
    e.stopPropagation();
    statusDom.className = '';
    statusDom.innerText = '录制结束';
    dataControl.endRecord();
  });

  document.body.appendChild(container);
  dataControl.getRecordDataFromKNB(() => {
    if (dataControl.recordData.recordSDK.status === 'recording') {
      startRecord();
    }
  });
};

const editCase = () => {
  const container = document.createElement('div');
};

export const startRecording = (cb: Function): void => {
  const interceptDomMask = document.createElement('div');
  interceptDomMask.className = INTERCEPT_ACTION;
  interceptDomMask.innerHTML = '页面调整完成后，点击消除弹窗继续操作';
  document.body.appendChild(interceptDomMask);
  interceptDomMask.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    document.body.removeChild(interceptDomMask);
    cb();
  });
};

export default interRecordDom;
