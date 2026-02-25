/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as compliance from "../compliance.js";
import type * as emailVerification from "../emailVerification.js";
import type * as lib_address from "../lib/address.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_matching from "../lib/matching.js";
import type * as maps from "../maps.js";
import type * as matches from "../matches.js";
import type * as notifications from "../notifications.js";
import type * as parcels from "../parcels.js";
import type * as reviews from "../reviews.js";
import type * as shipments from "../shipments.js";
import type * as tripSessions from "../tripSessions.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  compliance: typeof compliance;
  emailVerification: typeof emailVerification;
  "lib/address": typeof lib_address;
  "lib/geo": typeof lib_geo;
  "lib/matching": typeof lib_matching;
  maps: typeof maps;
  matches: typeof matches;
  notifications: typeof notifications;
  parcels: typeof parcels;
  reviews: typeof reviews;
  shipments: typeof shipments;
  tripSessions: typeof tripSessions;
  trips: typeof trips;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
