import HTTPAPI from '../src';
import nock from 'nock';
import _apiRoutes from './apiRoutes';

const apiEndpoint = 'http://www.example.com';
const getApi = ({ apiRoutes = _apiRoutes } = {}) => HTTPAPI({ apiRoutes, apiEndpoint });

const expectToWarn = (call, message) => {
  const consoleWarn = console.warn;
  console.warn = jest.fn();
  return call().then(() => {
    if (console.warn.mock.calls.length !== 1) {
      throw new Error(
        `warned ${console.warn.mock.calls.length} times:
        ${console.warn.mock.calls.map(cs => cs.join(', ')).join('\n')}`
      );
    }
    if (console.warn.mock.calls[0].join('') !== message) {
      throw new Error(
        `didn't warn ${message}, warned ${console.warn.mock.calls[0].join('')} instead`
      );
    }
    console.warn = consoleWarn;
  });
};

describe('HTTPAPI', () => {
  afterAll(() => {
    nock.restore();
  });

  it('should work for a basic get', () => {
    nock(apiEndpoint).get('/foos?bar=asd').reply(200, { data: [] });
    return getApi().fooController_foos({ token: 'asd', query: { bar: 'asd' } });
  });

  it('should log a warning if api is marked as authenticated and no token is passed', () => {
    nock(apiEndpoint).get('/foos?bar=asd').reply(200, { data: [] });
    return expectToWarn(
      () => getApi().fooController_foos({ query: { bar: 'asd' } }),
      'HTTPAPI: No token provided for authenticated get http://www.example.com/foos'
    );
  });

  it('should throw if invoked with malformed/missing query params', () => {
    expect(() => getApi().fooController_foos({})).toThrow();
  });

  it('should throw if invoked with malformed/missing url params', () => {
    expect(() => getApi().fooController_getById({})).toThrow();
  });

  it('should throw if invoked with malformed/missing data (body)', () => {
    expect(() => getApi().fooController_addFoos({})).toThrow();
  });

  it('should log a warning if passing data (body) to an api with untyped data', () => {
    return expectToWarn(
      () => {
        getApi().fooController_addFoos2({ token: 'token', data: { foo: 'bar' } }).catch(() => {});
        return Promise.resolve();
      },
      'HTTPAPI: Passing data (body) to post http://www.example.com/foos2 but metarpheus doesn\'t specify a body type' // eslint-disable-line max-len
    );
  });

  it('should fail if api returns an incorrect response', () => {
    nock(apiEndpoint).get('/foos?bar=asd').reply(200, { data: 'invalid' });
    return getApi().fooController_foos({ token: 'asd', query: { bar: 'asd' } }).then(
      () => { throw new Error('it should have failed!'); },
      () => {} // ok, it failed
    );
  });

  it('should log a warning if there are duplicate api routes', () => {
    return expectToWarn(
      () => {
        getApi({ apiRoutes: _apiRoutes.concat(_apiRoutes[0]) });
        return Promise.resolve();
      },
      'HTTPAPI: Overriding api method \'fooController_foos\''
    );
  });

  it('should add cache control headers for get requests', () => {
    nock(apiEndpoint, {
      reqheaders: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache, no-store'
      }
    }).get('/fooos').reply(200, { data: [] });
    return getApi().fooController_fooos({});
  });

  it('should pass a token Authorization header if api is authenticated', () => {
    nock(apiEndpoint, {
      reqheaders: {
        Authorization: 'Token token="asd"'
      }
    }).get('/foos?bar=asd').reply(200, { data: [] });
    return getApi().fooController_foos({ token: 'asd', query: { bar: 'asd' } });
  });

  it('should add Content-Type=application/json for post calls', () => {
    nock(apiEndpoint, {
      reqheaders: {
        'Content-Type': 'application/json'
      }
    }).post('/foos').reply(200, { data: {} });
    return getApi().fooController_addFoos({ token: 'asd', data: { foo: 'bar' } });
  });

  xit('should warn if api returns non-gzipped content', () => {
    nock(apiEndpoint).post('/foos').reply(200, { data: {} });
    return expectToWarn(
      () => getApi().fooController_addFoos({ token: 'asd', data: { foo: 'bar' } }),
      'asd'
    );
  });

});