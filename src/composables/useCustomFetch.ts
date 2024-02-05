import { MaybeRef, toValue } from "vue";
import { BeforeFetchContext, createFetch } from "@vueuse/core";

export interface UseCustomFetchOptions {
  /**
   * isBearerTokenRequired : If true, then the token will be added to the request header
   * @default false
   */
  isBearerTokenRequired?: boolean;

  /**
   * query : Query parameters to be added to the request
   * @default {}
   */
  query?: MaybeRef<Record<string, any>>;

  /**
   * json: JSON data to be sent with the request
   * @default {}
   */
  json?: MaybeRef<Record<string, any>>;
}

export type UseCustomFetchOptionsKey = UseCustomFetchOptions[keyof UseCustomFetchOptions];

export const useCustomFetch = () => {
  const useApi = (options: UseCustomFetchOptions) =>
    createFetch({
      baseUrl: `${import.meta.env.VITE_APP_API}`,
      options: {
        timeout: 30000,
        immediate: false,
        beforeFetch: getBeforeFetch(options)
      }
    });

  /**
   * getBeforeFetch: A function to curry the beforeFetch functions
   *
   * @param options: UseCustomFetchOptions
   * @returns (ctx: BeforeFetchContext) => BeforeFetchContext
   */
  const getBeforeFetch = (options: UseCustomFetchOptions): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    const { isBearerTokenRequired, query } = options;
    return (ctx: BeforeFetchContext) =>
      fetchCurryFn(ctx, [getAuthorizationBeforeFetch(isBearerTokenRequired), getQueryBeforeFetch(query)]);
  };

  /**
   * fetchCurryFn: A function to curry the beforeFetch functions
   * @param ctx: BeforeFetchContext
   * @param fnList: Array of beforeFetch functions
   */
  const fetchCurryFn = (
    ctx: BeforeFetchContext,
    fnList: ((ctx: BeforeFetchContext) => BeforeFetchContext)[]
  ): BeforeFetchContext => {
    return fnList.reduce((acc, fn) => fn(acc), ctx);
  };

  /**
   * getAuthorization: Add token to the request header
   *
   * @param ctx: BeforeFetchContext
   * @returns BeforeFetchContext
   */
  const getAuthorizationBeforeFetch = (
    isBearerTokenRequired: boolean = false
  ): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    if (!isBearerTokenRequired) return noActionContext;
    return (ctx: BeforeFetchContext) => {
      // ... get token from authStore in pinia or localStorage
      const token = "<token>";
      // ...
      // if token is not available, cancel the request immediately
      if (!token) {
        ctx.cancel();
        return ctx;
      }
      ctx.options.headers = {
        ...ctx.options.headers,
        Authorization: `Bearer ${token}`
      };
      return ctx;
    };
  };

  /**
   * getQueryBeforeFetch: Add query parameters to the request
   *
   * @param query: MaybeRef<Record<string, any>>
   * @returns (ctx: BeforeFetchContext) => BeforeFetchContext
   */
  const getQueryBeforeFetch = (query?: MaybeRef<Record<string, any>>): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    const currentQuery = toValue(query);
    if (!currentQuery) return noActionContext;
    return (ctx: BeforeFetchContext): BeforeFetchContext => {
      ctx.url += generateQueryString(currentQuery);
      return ctx;
    };
  };

  /**
   * generateQueryString: Generate the query string from the query data
   *
   * @param queryData: Record<string, any>
   * @returns string
   */
  const generateQueryString = (queryData: Record<string, any>) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(queryData)) {
      if (Array.isArray(value)) {
        value.forEach(el => query.append(key, el.toString()));
        continue;
      }
      if (value) {
        query.append(key, value.toString());
      }
    }

    const queryString = query.toString();
    return queryString.length > 0 ? `?${queryString}` : "";
  };

  /**
   * noActionContext: A function to return the context as it is
   *
   * @param ctx: BeforeFetchContext
   */
  const noActionContext = (ctx: BeforeFetchContext): BeforeFetchContext => ctx;

  return {
    useApi
  };
};

export type UseCustomFetch = typeof useCustomFetch;
