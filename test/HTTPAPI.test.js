import axios from 'axios';
axios.defaults.adapter = require('axios/lib/adapters/http');
import HTTPAPI from '../src';
import nock from 'nock';
import apiRoutes from './apiRoutes';

const apiEndpoint = 'http://www.example.com';

const getApi = () => HTTPAPI({ apiRoutes, apiEndpoint });

describe('HTTPAPI', () => {
  afterAll(() => {
    nock.restore();
  });

  it('should work for a basic get', () => {
    nock(apiEndpoint).get('/foos').reply(200, { data: [] });
    return getApi().fooController_foos();
  });
});