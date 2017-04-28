import find from 'lodash/find';
import axios from 'axios';
import t from 'tcomb';
import _LocalDate from 'local-date';

const __DEV = process.env.NODE_ENV !== 'production';

const warn = message => {
  if (__DEV) {
    console.warn(`HTTPAPI: ${message}`); // eslint-disable-line no-console
  }
};

const matchDateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3}Z)?$/;
const DateTime = {
  test: v => matchDateTime.exec(v) ? v : false,
  parse: v => new Date(v)
};

const LocalDate = {
  test: v => _LocalDate.test(v) ? v : null,
  parse: v => new _LocalDate(v)
};

export default function HTTPAPI({
  apiRoutes,

  apiEndpoint,

  timeout = 60000,

  unwrapApiResponse = resp => resp && resp.data ? resp.data : null,

  parsers = [LocalDate, DateTime],

  parseError = err => {
    const { errors = [] } = (() => {
      try {
        return JSON.parse(err.data);
      } catch (e) {
        return {};
      }
    })();

    return { status: err.status, errors };
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
    returnType,
    authenticated
  }) => {
    const methodName = name.join('_');
    return {
      methodName,
      impl: ({
        token = null,
        params: urlParams = [],
        data = {},
        query: queryParams = {}
      } = {}) => {
        if (__DEV) {
          urlParams.forEach((p, i) => {
            t.assert(
              routeParamTypes[i].is(p),
              `HTTPAPI: Invalid path  param[${i}]=${p} provided to ${methodName}`
            );
          });
        }

        if (__DEV) {
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

        const headers = {};

        if (['post', 'put', 'patch'].indexOf(method) !== -1) {
          headers['Content-Type'] = 'application/json';
        }

        // optionally add cache control headers
        if (method === 'get') {
          headers.Pragma = 'no-cache';
          headers['Cache-Control'] = 'no-cache, no-store';
        }

        if (__DEV && authenticated && !token) {
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
