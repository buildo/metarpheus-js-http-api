import find from 'lodash/find';
import axios from 'axios';
import t from 'tcomb';
import _LocalDate from 'local-date';

const warn = message => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`HTTPAPI: ${message}`); // eslint-disable-line no-console
  }
};

const matchDateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3}Z)?$/;
const DateTime = {
  test: v => Boolean(matchDateTime.exec(v)),
  parse: v => new Date(v)
};

const LocalDate = {
  test: _LocalDate.test,
  parse: v => new _LocalDate(v)
};

export default function HTTPAPI({
  apiRoutes,

  apiEndpoint,

  timeout = 60000,

  unwrapApiResponse = resp => resp && resp.data ? resp.data : null,

  parsers = [LocalDate, DateTime],

  parseError = err => {
    try {
      const { errors = [] } = JSON.parse(err.response.data);
      return { status: err.response.status, errors };
    } catch (e) {
      return { status: err && err.response && err.response.status || 0, errors: [] };
    }
  }

}) {
  const axiosInstance = axios.create();

  // we are deserializing here:
  axiosInstance.interceptors.response.use(
    response => ({
      ...response,
      data: JSON.parse(response.data, (_, v) => {
        const tbp = find(parsers, ({ test }) => test(v));
        if (tbp) {
          return tbp.parse(v);
        } else {
          return v;
        }
      })
    }),
    error => Promise.reject(parseError(error))
  );

  const impls = apiRoutes.map(({
    method,
    name,
    route,
    routeParamTypes,
    params: queryParamTypes,
    body: bodyParamType,
    returnType,
    authenticated
  }) => {
    const methodName = name.join('_');
    return {
      methodName,
      impl: ({
        token = null,
        params: urlParams = [],
        data,
        query: queryParams = {}
      } = {}) => {
        if (process.env.NODE_ENV !== 'production') {
          urlParams.forEach((p, i) => {
            const routeParamObj = routeParamTypes[i];
            const routeParamName = Object.keys(routeParamObj)[0];
            const routeParamType = routeParamObj[routeParamName];
            t.assert(
              routeParamType.is(p),
              `HTTPAPI: Invalid path param ${routeParamName}=${p} provided to ${methodName}`
            );
          });
        }

        if (process.env.NODE_ENV !== 'production') {
          Object.keys(queryParamTypes).forEach(k => {
            t.assert(
              queryParamTypes[k].is(queryParams[k]),
              `HTTPAPI: Invalid query param ${k}=${queryParams[k]} provided to ${methodName}`
            );
          });
        }

        const url = `${apiEndpoint}/${route(
          ...urlParams/* .map(stringifyParam) */.map(encodeURIComponent)
        )}`;

        if (process.env.NODE_ENV !== 'production' && data && !bodyParamType) {
          warn(
            `Passing data (body) to ${method} ${url} but metarpheus doesn't specify a body type`
          );
        }

        if (process.env.NODE_ENV !== 'production' && bodyParamType) {
          try {
            bodyParamType(data); // manually try/catching since bodyParamType could easily be a Struct
          } catch (e) {
            throw new TypeError(`HTTPAPI: Invalid \`data\` (body) provided for ${method} ${url}`);
          }
        }

        const headers = {};

        if (['post', 'put', 'patch'].indexOf(method) !== -1) {
          headers['Content-Type'] = 'application/json';
        }

        // optionally add cache control headers
        if (method === 'get') {
          headers.Pragma = 'no-cache';
          headers['Cache-Control'] = 'no-cache, no-store';
        }

        if (process.env.NODE_ENV !== 'production' && authenticated && !token) {
          warn(`No token provided for authenticated ${method} ${url}`);
        }

        if (token) {
          headers.Authorization = `Token token="${token}"`;
        }

        return axiosInstance({
          method,
          url,
          params: queryParams,
          headers,
          data,
          transformResponse: [v => v], // skip default transform response
          timeout
        }).then(
          ({ data }) => (returnType.fromAPI ? returnType.fromAPI : returnType)(
            unwrapApiResponse(data)
          )
        );
      }
    };
  });

  return impls.reduce((ac, { methodName, impl }) => {
    if (ac[methodName]) {
      warn(`Overriding api method '${methodName}'`);
    }
    return { ...ac, [methodName]: impl };
  }, {});
}
