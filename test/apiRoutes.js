/* eslint-disable */
import t from 'tcomb';

export default [
  {
    method: 'get',
    name: ['fooController', 'foos'],
    authenticated: true,
    returnType: t.list(t.String),
    route: (...routeParams) => ['foos'].join('/'),
    routeParamTypes: [],
    params: { bar: t.String }
  },
  {
    method: 'get',
    name: ['fooController', 'fooos'],
    authenticated: false,
    returnType: t.Any,
    route: (...routeParams) => ['fooos'].join('/'),
    routeParamTypes: [],
    params: {}
  },
  {
    method: 'get',
    name: ['fooController', 'fooById'],
    authenticated: true,
    returnType: t.list(t.String),
    route: (...routeParams) => ['foos', routeParams[0]].join('/'),
    routeParamTypes: [t.Number],
    params: {}
  },
  {
    method: 'post',
    name: ['fooController', 'addFoos'],
    authenticated: true,
    returnType: t.Any,
    route: (...routeParams) => ['foos'].join('/'),
    params: {},
    body: t.struct({ foo: t.String })
  },
  {
    method: 'post',
    name: ['fooController', 'addFoos2'],
    authenticated: true,
    returnType: t.Any,
    route: (...routeParams) => ['foos2'].join('/'),
    params: {}
  },
];
