import { proxy } from 'ajax-hook';
import DataControl from './dataControl';

const proxyXHR = (dataControl: DataControl, interceptUri: string, startMock = false) => {
  proxy({
    onRequest: (config, handler) => {
      if (config.url.indexOf(interceptUri) === -1 || !startMock) {
        handler.next(config);
        return;
      }
      handler.next({
        ...config,
        url: 'http://localhost:4000/proxy',
        headers: {
          ...config.headers,
          'X-PROXY-ORIGIN-URL': config.url,
          'X-PROXY-ORIGIN-METHOD': config.method,
          'X-PROXY-REFERER': window.location.href,
        },
      });
    },
    onError: (err, handler) => {
      handler.next(err);
    },
    // 请求成功后进入
    onResponse: (response, handler) => {
      if (response.config.url.indexOf(interceptUri) === -1) {
        handler.next(response);
        return;
      }
      dataControl.pushData('api', {
        method: response.config.method,
        url: response.config.url,
        params: response.config.body,
        response: response.response,
      });
      handler.next(response);
    },
  });
};

export default proxyXHR;
