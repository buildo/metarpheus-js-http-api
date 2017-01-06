/* eslint-disable */
import t from 'tcomb';

export default [
  {
    method: 'get',
    name: ['fooController', 'foos'],
    authenticated: false,
    returnType: t.Any,
    route: (...routeParams) => ['foos'].join('/'),
    routeParamTypes: [],
    params: {}
  },
];
