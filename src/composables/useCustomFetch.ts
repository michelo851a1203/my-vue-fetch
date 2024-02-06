import * as zod from "zod";
import { MaybeRef, toValue } from "vue";
import { AfterFetchContext, BeforeFetchContext, OnFetchErrorContext, createFetch } from "@vueuse/core";

export type RequestInput = string | number | boolean;
export type RequestInputs = RequestInput | RequestInput[];

export enum ApiErrorStatus {
  TYPE_ERROR = "TYPE_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  ABORT_ERROR = "ABORT_ERROR"
}

export interface CustomFetchErrorCtx {
  data: any;
  response: Response | null;
  error: ApiErrorStatus;
}

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
  query?: MaybeRef<Record<string, RequestInputs>>;

  /**
   * json: JSON data to be sent with the request
   * @default {}
   */
  json?: MaybeRef<Record<string, RequestInputs>>;

  /**
   * responseSchema: trigger when get status code 2xx
   * @default undefined
   */
  responseSchema?: zod.ZodTypeAny;

  /**
   * errorResponseSchema : only trigger when get status code 4xx or 5xx
   * @default undefined
   */
  errorResponseSchema?: zod.ZodTypeAny;
}

export type UseCustomFetchOptionsKey = UseCustomFetchOptions[keyof UseCustomFetchOptions];

/**
 * useCustomFetch.ts
 * @author Michael Ho <michael.h.@nexusplay.tw>
 */
export const useCustomFetch = () => {
  const useApi = (options: UseCustomFetchOptions) =>
    createFetch({
      baseUrl: `${import.meta.env.VITE_APP_API}`,
      options: {
        timeout: 30000,
        immediate: false,
        beforeFetch: getBeforeFetch(options),
        afterFetch: getAfterFetch(options),
        onFetchError: getOnFetchError(options)
      },
      fetchOptions: {
        mode: "cors"
      }
    });

  // ===================================================
  // beforeFetch functions
  /**
   * getBeforeFetch: A function to curry the beforeFetch functions
   *
   * @param options: UseCustomFetchOptions
   * @returns (ctx: BeforeFetchContext) => BeforeFetchContext
   */
  const getBeforeFetch = (options: UseCustomFetchOptions): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    const { isBearerTokenRequired, query, json } = options;
    return (ctx: BeforeFetchContext) =>
      fetchCurryFn<BeforeFetchContext>(ctx, [
        getAuthorizationBeforeFetch(isBearerTokenRequired),
        getQueryBeforeFetch(query),
        getJsonFormatBeforeFetch(json)
      ]);
  };

  /**
   * curry: A function to curry
   * @param input: T any type
   * @param fnList: Array of beforeFetch/afterFetch functions
   */
  const fetchCurryFn = <T extends BeforeFetchContext | AfterFetchContext | CustomFetchErrorCtx>(
    ctx: T,
    fnList: ((ctx: T) => T)[]
  ): T => fnList.reduce((acc, fn) => fn(acc), ctx);

  /**
   * getAuthorization: Add token to the request header
   *
   * @param ctx: BeforeFetchContext
   * @returns BeforeFetchContext
   */
  const getAuthorizationBeforeFetch = (
    isBearerTokenRequired: boolean = false
  ): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    if (!isBearerTokenRequired) return noActionContext<BeforeFetchContext>;
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
   * @param query: MaybeRef<Record<string, T | T[]>>
   * @returns (ctx: BeforeFetchContext) => BeforeFetchContext
   */
  const getQueryBeforeFetch = <T extends string | number | boolean>(
    query?: MaybeRef<Record<string, T | T[]>>
  ): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    const currentQuery = toValue(query);
    if (!currentQuery) return noActionContext<BeforeFetchContext>;
    if (Object.keys(currentQuery).length === 0) return noActionContext<BeforeFetchContext>;
    return (ctx: BeforeFetchContext): BeforeFetchContext => {
      ctx.url += generateQueryString(currentQuery);
      return ctx;
    };
  };

  /**
   * generateQueryString: Generate the query string from the query data
   *
   * @param queryData: Record<string, T | T[]>
   * @returns string
   */
  const generateQueryString = <T extends string | number | boolean>(queryData: Record<string, T | T[]>): string => {
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
   * getJsonFormatBeforeFetch: Format the JSON data to be sent with the request
   *
   * @param MaybeRef<Record<string, T | T[]>> jsonInput
   * @returns ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
   */
  const getJsonFormatBeforeFetch = <T extends string | number | boolean>(
    jsonInput?: MaybeRef<Record<string, T | T[]>>
  ): ((ctx: BeforeFetchContext) => BeforeFetchContext) => {
    const currentRawData = toValue(jsonInput);
    if (!currentRawData) return noActionContext<BeforeFetchContext>;
    return (ctx: BeforeFetchContext): BeforeFetchContext => {
      ctx.options.headers = {
        ...ctx.options.headers,
        "Content-Type": "application/json"
      };
      ctx.options.body = JSON.stringify(removeNullishInObject(currentRawData));
      return ctx;
    };
  };

  /**
   * function removeNullishInObject: Remove undefined, null, empty string in object
   *
   * @param obj
   */
  const removeNullishInObject = <T>(obj: Record<string, T>) =>
    Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== "" && v !== undefined && v !== null));

  // ===================================================

  /**
   * getAfterFetch : A function to curry the afterFetch functions
   *
   * @param UseCustomFetchOptions options
   * @returns (ctx: AfterFetchContext) => AfterFetchContext
   */
  const getAfterFetch = (options: UseCustomFetchOptions): ((ctx: AfterFetchContext) => AfterFetchContext) => {
    const { responseSchema, errorResponseSchema } = options;
    return (ctx: AfterFetchContext) =>
      fetchCurryFn<AfterFetchContext>(ctx, [
        responseSchemaAfterFetch(responseSchema),
        errorSchemaAfterFetch(errorResponseSchema)
      ]);
  };

  /**
   * errorSchemaAfterFetch : if response.ok is false, validate the error response schema
   *
   * @param zod.ZodTypeAny errorResponseSchema
   * @returns (ctx: AfterFetchContext) => AfterFetchContext
   */
  const errorSchemaAfterFetch = (errorResponseSchema?: zod.ZodTypeAny): ((ctx: AfterFetchContext) => AfterFetchContext) => {
    if (!errorResponseSchema) return noActionContext<AfterFetchContext>;
    return (ctx: AfterFetchContext) => {
      if (ctx.response.ok) return ctx;
      const validatedError = errorResponseSchema.safeParse(ctx.data);
      if (!validatedError.success) {
        if (import.meta.env.MODE !== "production") {
          console.group("%c [api error] type error", "color: yellow;");
          console.log(validatedError.error);
          console.groupEnd();
        }
        throw new TypeError(ApiErrorStatus.TYPE_ERROR);
      }
      return ctx;
    };
  };

  /**
   * responseSchemaAfterFetch : if response.ok is true, validate the response schema
   *
   * @param zod.ZodTypeAny responseSchema
   * @returns (ctx: AfterFetchContext) => AfterFetchContext
   */
  const responseSchemaAfterFetch = (responseSchema?: zod.ZodTypeAny): ((ctx: AfterFetchContext) => AfterFetchContext) => {
    if (!responseSchema) return noActionContext<AfterFetchContext>;
    return (ctx: AfterFetchContext) => {
      if (!ctx.response.ok) return ctx;
      const validatedResponse = responseSchema.safeParse(ctx.data);
      if (!validatedResponse.success) {
        if (import.meta.env.MODE !== "production") {
          console.group("%c [api response] type error", "color: yellow;");
          console.log(validatedResponse.error);
          console.groupEnd();
        }
        throw new TypeError(ApiErrorStatus.TYPE_ERROR);
      }
      return ctx;
    };
  };

  // ===================================================

  /**
   * getOnFetchError : A function to curry the onFetchError functions
   *
   * @param UseCustomFetchOptions options
   * @returns (ctx: CustomFetchErrorCtx) => Promise<Partial<OnFetchErrorContext>> | Partial<OnFetchErrorContext>
   */
  const getOnFetchError = (
    options: UseCustomFetchOptions
  ): ((ctx: CustomFetchErrorCtx) => Promise<Partial<OnFetchErrorContext>> | Partial<OnFetchErrorContext>) => {
    const { errorResponseSchema } = options;
    return (ctx: CustomFetchErrorCtx) =>
      fetchCurryFn<CustomFetchErrorCtx>(ctx, [
        typeErrorOnFetchError(),
        timeOutErrorOnFetchError(),
        responseNullOnFetchError(),
        errorSchemaOnFetchError(errorResponseSchema)
      ]);
  };

  /**
   * typeErrorOnFetchError : type error not the same as responseSchema
   *
   * @returns (ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx
   */
  const typeErrorOnFetchError = (): ((ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx) => {
    return (ctx: CustomFetchErrorCtx) => {
      if (ctx.error === ApiErrorStatus.TYPE_ERROR) {
        // type error do something
        return ctx;
      }
      return ctx;
    };
  };

  /**
   * timeOutErrorOnFetchError : timeout error (call: abortController)
   *
   * @returns (ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx
   */
  const timeOutErrorOnFetchError = (): ((ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx) => {
    return (ctx: CustomFetchErrorCtx) => {
      if (ctx.error === ApiErrorStatus.ABORT_ERROR) {
        // type error do something
        return ctx;
      }
      return ctx;
    };
  };

  /**
   * responseNullOnFetchError : response null mean 500
   *
   * @returns (ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx
   */
  const responseNullOnFetchError = (): ((ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx) => {
    return (ctx: CustomFetchErrorCtx) => {
      // response is null mean 500
      if (ctx.response === null) {
        // type error do something
        return ctx;
      }
      return ctx;
    };
  };

  /**
   * errorSchemaOnFetchError : A function to validate the error response schema
   *
   * @param zod.ZodTypeAny errorResponseSchema
   * @returns (ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx
   */
  const errorSchemaOnFetchError = (errorResponseSchema?: zod.ZodTypeAny): ((ctx: CustomFetchErrorCtx) => CustomFetchErrorCtx) => {
    if (!errorResponseSchema) return noActionContext<CustomFetchErrorCtx>;
    return (ctx: CustomFetchErrorCtx) => {
      const responseData = typeof ctx.data === "string" ? JSON.parse(ctx.data) : ctx.data;
      const validatedError = errorResponseSchema.safeParse(responseData);
      if (!validatedError.success) {
        if (import.meta.env.MODE !== "production") {
          console.group("%c [api error] type error", "color: yellow;");
          console.log(validatedError.error);
          console.groupEnd();
        }
        // show error message or do something (unknown error)
      }
      return ctx;
    };
  };

  /**
   * noActionContext: A function to return the context without any action
   *
   * @param T ctx
   * @returns T ctx
   */
  const noActionContext = <T extends BeforeFetchContext | AfterFetchContext | CustomFetchErrorCtx>(ctx: T): T => ctx;

  return {
    useApi
  };
};

export type UseCustomFetch = typeof useCustomFetch;
